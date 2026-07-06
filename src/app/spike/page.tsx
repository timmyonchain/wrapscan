"use client";

/**
 * Phase 1 Layer B — minimal, unstyled in-browser decryption spike.
 *
 * Four actions on the cUSDTMock wrapper (registry pair #1): Mint, Wrap,
 * Decrypt, Unwrap. Decrypt triggers a REAL EIP-712 signature in the wallet and
 * returns the real cleartext. No demo-mode fallback — real errors surface in
 * the UI.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits, getAddress, type Address } from "viem";
import type { ZamaSDK } from "@zama-fhe/sdk";
import type { WrappedToken } from "@zama-fhe/sdk";
import { createBrowserSdk, relayerProxyBase, warmRelayerKeyMaterial } from "./sdk";

const CUSDT_WRAPPER = getAddress("0x4E7B06D78965594eB5EF5414c357ca21E1554491");
const DECIMALS = 6; // USDTMock
const SYMBOL = "USDT";

const MINT_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
const ERC20_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export default function SpikePage() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [publicBal, setPublicBal] = useState<string>("—");
  const [privateBal, setPrivateBal] = useState<string>("—");
  const [encHandle, setEncHandle] = useState<string>("—");

  const sdkRef = useRef<ZamaSDK | null>(null);
  const wrappedRef = useRef<WrappedToken | null>(null);
  const underlyingRef = useRef<Address | null>(null);
  const warmedRef = useRef<boolean>(false);

  const onSepolia = chainId === sepolia.id;
  const ready = isConnected && onSepolia && !!walletClient && !!publicClient;

  const say = useCallback((line: string) => {
    setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  const getWrapped = useCallback((): WrappedToken => {
    if (!publicClient || !walletClient)
      throw new Error("Wallet/public client not ready.");
    if (!sdkRef.current) {
      say("initializing SDK (web relayer + WASM worker)…");
      sdkRef.current = createBrowserSdk(publicClient, walletClient);
    }
    if (!wrappedRef.current) {
      wrappedRef.current = sdkRef.current.createWrappedToken(CUSDT_WRAPPER);
    }
    return wrappedRef.current;
  }, [publicClient, walletClient, say]);

  const refreshPublic = useCallback(async () => {
    if (!publicClient || !address) return;
    const wrapped = getWrapped();
    if (!underlyingRef.current) {
      underlyingRef.current = await wrapped.underlying();
    }
    const bal = await publicClient.readContract({
      address: underlyingRef.current,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    setPublicBal(`${formatUnits(bal, DECIMALS)} ${SYMBOL}`);
  }, [publicClient, address, getWrapped]);

  const run = useCallback(
    async (name: string, fn: () => Promise<void>) => {
      setBusy(name);
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        say(`ERROR (${name}): ${msg}`);
        console.error(err);
      } finally {
        setBusy(null);
      }
    },
    [say],
  );

  // Pre-warm the FHE public key + CRS into the browser HTTP cache (main thread,
  // no 30s worker cap) so the SDK's worker init hits cache. Runs at most once.
  const ensureWarmed = useCallback(async () => {
    if (warmedRef.current) return;
    say("warming FHE key material (public key + CRS) into HTTP cache…");
    const w = await warmRelayerKeyMaterial();
    warmedRef.current = true;
    say(
      `✓ warmed: public key ${(w.publicKeyBytes / 1024).toFixed(0)} KB, CRS ${(
        w.crsBytes /
        1024 /
        1024
      ).toFixed(2)} MB in ${w.ms} ms (host ${new URL(w.crsUrl).host}).`,
    );
  }, [say]);

  // Diagnostic: run the FULL SDK public-key init (not just the raw /keyurl
  // fetch) and log how long it takes. No wallet signature (no EIP-712) needed.
  const onCheckRelayer = () =>
    run("check-relayer", async () => {
      const base = relayerProxyBase();
      say(`resolved relayer URL (same-origin proxy): ${base}`);

      // 1) Same-origin /keyurl (the previously CORS-blocked call) + warm blobs.
      await ensureWarmed();

      // 2) Full SDK public-key init through the worker (needs a wallet client
      //    to build the SDK, but triggers NO signature).
      if (!publicClient || !walletClient) {
        say(
          "(connect a wallet to run the full SDK init; the warm step above already confirms the relayer + key-material fetch works)",
        );
        return;
      }
      if (!sdkRef.current)
        sdkRef.current = createBrowserSdk(publicClient, walletClient);

      const t0 = performance.now();
      say("initializing SDK worker + fetching FHE public key & CRS via SDK…");
      const key = await sdkRef.current.relayer.fetchFheEncryptionKeyBytes();
      // Force the CRS/public-params path too, to prove full init (no signature).
      await sdkRef.current.relayer.getPublicParams(2048);
      const ms = Math.round(performance.now() - t0);
      if (!key) throw new Error("SDK returned a null FHE public key.");
      say(
        `✓ FULL public-key init completed via SDK in ${ms} ms — no timeout, no signature. ` +
          `Cached in IndexedDB for next time.`,
      );
    });

  const onMint = () =>
    run("mint", async () => {
      if (!walletClient || !address) throw new Error("Connect wallet first.");
      const wrapped = getWrapped();
      if (!underlyingRef.current)
        underlyingRef.current = await wrapped.underlying();
      const amount = 100n * 10n ** BigInt(DECIMALS);
      say(`minting 100 ${SYMBOL}…`);
      const hash = await walletClient.writeContract({
        address: underlyingRef.current,
        abi: MINT_ABI,
        functionName: "mint",
        args: [address, amount],
        chain: sepolia,
        account: address,
      });
      say(`mint tx: ${hash}`);
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshPublic();
      say("mint confirmed.");
    });

  const onWrap = () =>
    run("wrap", async () => {
      if (!address) throw new Error("Connect wallet first.");
      const wrapped = getWrapped();
      const bal = await publicClient!.readContract({
        address: (underlyingRef.current ??= await wrapped.underlying()),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      if (bal <= 0n) throw new Error("No public balance to wrap — Mint first.");
      await ensureWarmed();
      say(`shield (wrap) ${formatUnits(bal, DECIMALS)} ${SYMBOL}…`);
      const res = await wrapped.shield(bal);
      say(`shield tx: ${res.txHash}`);
      await refreshPublic();
      say("wrap confirmed. Now Decrypt to read the private balance.");
    });

  const onDecrypt = () =>
    run("decrypt", async () => {
      if (!address) throw new Error("Connect wallet first.");
      const wrapped = getWrapped();
      await ensureWarmed();
      say("reading encrypted handle…");
      const handle = await wrapped.confidentialBalanceOf(address);
      setEncHandle(handle);
      say(`encrypted handle: ${handle}`);
      say("user-decrypting (expect an EIP-712 signature prompt)…");
      const clear = await wrapped.balanceOf(address);
      setPrivateBal(clear.toString());
      say(`>>> DECRYPTED cleartext balance: ${clear.toString()}`);
    });

  const onUnwrap = () =>
    run("unwrap", async () => {
      if (!address) throw new Error("Connect wallet first.");
      const wrapped = getWrapped();
      await ensureWarmed();
      say("decrypting current balance to size the unwrap…");
      const clear = await wrapped.balanceOf(address);
      if (clear <= 0n) throw new Error("Private balance is 0 — Wrap first.");
      const amount = clear / 2n;
      say(`unshield (unwrap) ${amount} confidential units…`);
      const res = await wrapped.unshield(amount);
      say(`unshield/finalize tx: ${res.txHash}`);
      await refreshPublic();
      const after = await wrapped.balanceOf(address);
      setPrivateBal(after.toString());
      say(`>>> DECRYPTED cleartext after unwrap: ${after.toString()}`);
    });

  const disabled = !ready || busy !== null;

  const status = useMemo(() => {
    if (!isConnected) return "not connected";
    if (!onSepolia) return `wrong network (${chainId}) — switch to Sepolia`;
    if (!walletClient) return "loading wallet client…";
    return busy ? `busy: ${busy}` : "ready";
  }, [isConnected, onSepolia, chainId, walletClient, busy]);

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "ui-monospace, monospace" }}>
      <h1>Phase 1 spike — cUSDTMock decryption round-trip</h1>
      <p style={{ color: "#888" }}>
        Wrapper {CUSDT_WRAPPER} on Sepolia. Real encryption via Zama relayer +
        browser WASM. No demo-mode fallback.
      </p>

      <div style={{ margin: "16px 0" }}>
        <ConnectButton />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button onClick={onCheckRelayer} disabled={busy !== null}>
          Check relayer (no signature)
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <button onClick={onMint} disabled={disabled}>1. Mint</button>
        <button onClick={onWrap} disabled={disabled}>2. Wrap</button>
        <button onClick={onDecrypt} disabled={disabled}>3. Decrypt</button>
        <button onClick={onUnwrap} disabled={disabled}>4. Unwrap</button>
        <button onClick={() => run("refresh", refreshPublic)} disabled={disabled}>
          Refresh public
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", margin: "12px 0" }}>
        <tbody>
          <tr><td style={cell}>status</td><td style={cell}>{status}</td></tr>
          <tr><td style={cell}>account</td><td style={cell}>{address ?? "—"}</td></tr>
          <tr><td style={cell}>public ERC-20 balance</td><td style={cell}>{publicBal}</td></tr>
          <tr><td style={cell}>encrypted handle</td><td style={{ ...cell, wordBreak: "break-all" }}>{encHandle}</td></tr>
          <tr><td style={cell}><b>DECRYPTED private balance</b></td><td style={cell}><b>{privateBal}</b></td></tr>
        </tbody>
      </table>

      <pre style={{ background: "#111", color: "#0f0", padding: 12, minHeight: 160, overflow: "auto", whiteSpace: "pre-wrap" }}>
        {log.length ? log.join("\n") : "logs will appear here…"}
      </pre>
    </main>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #333",
  padding: "4px 10px",
};
