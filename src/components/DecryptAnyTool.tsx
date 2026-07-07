"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { formatUnits, getAddress, isAddress, type Address } from "viem";
import { resolveRegistry } from "@/lib/registry";
import { useZamaSdk } from "@/hooks/useZamaSdk";
import { useTxFlow } from "@/hooks/useTxFlow";
import { CopyButton } from "./CopyButton";
import {
  ShieldIcon,
  EyeIcon,
  SpinnerIcon,
  CheckIcon,
  AlertIcon,
  ExternalLinkIcon,
} from "./icons";

const META_ABI = [
  { type: "function", stateMutability: "view", name: "name", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", stateMutability: "view", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const;

interface RegistryHit {
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  underlyingSymbol: string | null;
}
interface DecryptResult {
  token: Address;
  clear: bigint;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  registryHit: RegistryHit | null;
}

function trimAmount(value: string): string {
  if (!value.includes(".")) return value;
  const [whole, frac] = value.split(".");
  const short = frac.replace(/0+$/, "").slice(0, 6);
  return short.length ? `${whole}.${short}` : whole;
}

export function DecryptAnyTool() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { ensureSdk } = useZamaSdk();
  const flow = useTxFlow();

  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<DecryptResult | null>(null);
  const [registry, setRegistry] = useState<Map<string, RegistryHit>>(new Map());
  const [examples, setExamples] = useState<{ symbol: string; address: Address }[]>([]);

  // Load the registry once for verified/unverified labeling + example chips.
  useEffect(() => {
    const ac = new AbortController();
    resolveRegistry(ac.signal)
      .then((snap) => {
        const m = new Map<string, RegistryHit>();
        for (const p of snap.pairs) {
          m.set(p.confidentialToken.address.toLowerCase(), {
            symbol: p.confidentialToken.symbol,
            name: p.confidentialToken.name,
            decimals: p.confidentialToken.decimals,
            underlyingSymbol: p.token.symbol,
          });
        }
        setRegistry(m);
        setExamples(
          snap.pairs
            .filter((p) => p.isValid)
            .slice(0, 3)
            .map((p) => ({
              symbol: p.confidentialToken.symbol ?? "token",
              address: p.confidentialToken.address,
            })),
        );
      })
      .catch(() => {
        /* labeling is best-effort; decrypt still works */
      });
    return () => ac.abort();
  }, []);

  const trimmed = input.trim();
  const addressValid = trimmed === "" || isAddress(trimmed);
  const canSubmit =
    isConnected && onSepolia && isAddress(trimmed) && !flow.busy;

  const readMeta = useCallback(
    async (token: Address) => {
      if (!publicClient) return { symbol: null, name: null, decimals: null };
      const res = await publicClient.multicall({
        allowFailure: true,
        contracts: [
          { address: token, abi: META_ABI, functionName: "symbol" },
          { address: token, abi: META_ABI, functionName: "name" },
          { address: token, abi: META_ABI, functionName: "decimals" },
        ],
      });
      const [s, n, d] = res;
      return {
        symbol: s.status === "success" ? (s.result as string) : null,
        name: n.status === "success" ? (n.result as string) : null,
        decimals: d.status === "success" ? Number(d.result as number) : null,
      };
    },
    [publicClient],
  );

  const onDecrypt = () => {
    setResult(null);
    flow.run(
      async ({ setLabel }) => {
        if (!address) throw new Error("Connect your wallet first.");
        if (!isAddress(trimmed))
          throw new Error("That doesn't look like a valid contract address.");
        const token = getAddress(trimmed);

        setLabel("Preparing confidential engine…");
        const sdk = await ensureSdk();
        const t = sdk.createToken(token);

        setLabel("Checking the token…");
        let isConf = false;
        try {
          isConf = await t.isConfidential();
        } catch {
          isConf = false;
        }
        if (!isConf) {
          // Fallback: a real ERC-7984 answers confidentialBalanceOf with a handle.
          try {
            await t.confidentialBalanceOf(address);
            isConf = true;
          } catch {
            isConf = false;
          }
        }
        if (!isConf) {
          throw new Error(
            "This doesn't look like a confidential ERC-7984 token. Check the address and try again.",
          );
        }

        const meta = await readMeta(token);
        const registryHit = registry.get(token.toLowerCase()) ?? null;
        const decimals = registryHit?.decimals ?? meta.decimals;

        setLabel("Decrypting your balance. Sign the request in your wallet…");
        const clear = await t.balanceOf(address);

        setResult({
          token,
          clear,
          symbol: registryHit?.symbol ?? meta.symbol,
          name: registryHit?.name ?? meta.name,
          decimals,
          registryHit,
        });
      },
      { startLabel: "Preparing…", timeoutMs: 120_000 },
    );
  };

  return (
    <div className="glass mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-2xl p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <EyeIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-text">
            Decrypt any confidential token
          </h2>
          <p className="mt-1 text-sm text-muted">
            Paste any ERC-7984 confidential token address to reveal your own
            balance. Works for tokens outside the official registry too.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="erc7984-address"
          className="text-xs font-medium uppercase tracking-wide text-faint"
        >
          ERC-7984 token address
        </label>
        <input
          id="erc7984-address"
          value={input}
          spellCheck={false}
          autoComplete="off"
          placeholder="0x…"
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !addressValid}
          className={`w-full rounded-xl border bg-black/20 px-3.5 py-3 font-mono text-sm text-text outline-none transition-colors placeholder:text-faint ${
            touched && !addressValid
              ? "border-danger/50"
              : "border-hairline focus:border-gold/40"
          }`}
        />
        {touched && !addressValid && (
          <p role="alert" className="text-xs text-danger">
            That doesn&apos;t look like a valid contract address.
          </p>
        )}
        {examples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-faint">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex.address}
                type="button"
                onClick={() => {
                  setInput(ex.address);
                  setTouched(false);
                }}
                className="cursor-pointer rounded-md border border-hairline px-2 py-1 text-xs text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                {ex.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action / gate */}
      {!isConnected ? (
        <GateButton label="Connect wallet to decrypt" onClick={() => openConnectModal?.()} />
      ) : !onSepolia ? (
        <GateButton
          label={switching ? "Switching…" : "Switch to Sepolia"}
          onClick={() => void switchChainAsync({ chainId: sepolia.id })}
          disabled={switching}
        />
      ) : (
        <button
          type="button"
          onClick={onDecrypt}
          disabled={!canSubmit}
          aria-busy={flow.busy}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-void shadow-[0_10px_40px_-14px_rgba(255,210,8,0.6)] transition-colors duration-200 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
            flow.busy ? "cursor-wait" : "cursor-pointer"
          }`}
        >
          {flow.busy ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              {flow.label || "Decrypting…"}
            </>
          ) : (
            <>
              <EyeIcon className="h-4 w-4" />
              Decrypt my balance
            </>
          )}
        </button>
      )}

      {flow.phase === "error" && flow.error && (
        <p role="alert" className="inline-flex items-start gap-1.5 text-sm text-danger">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{flow.error}</span>
        </p>
      )}

      {result && (
        <ResultCard result={result} />
      )}
    </div>
  );
}

function ResultCard({ result }: { result: DecryptResult }) {
  const verified = !!result.registryHit;
  const symbol =
    result.symbol ?? `${result.token.slice(0, 6)}…${result.token.slice(-4)}`;
  const cleartext =
    result.decimals !== null
      ? `${trimAmount(formatUnits(result.clear, result.decimals))} ${symbol}`
      : `${result.clear.toString()} (raw)`;
  const explorer = `https://sepolia.etherscan.io/address/${result.token}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 shrink-0 text-gold" />
            <span className="truncate font-semibold text-text">{symbol}</span>
          </div>
          {result.name && (
            <p className="truncate text-sm text-muted">{result.name}</p>
          )}
        </div>
        {verified ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
            <CheckIcon className="h-3.5 w-3.5" />
            In official registry
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted">
            <AlertIcon className="h-3.5 w-3.5" />
            Unverified token
          </span>
        )}
      </div>

      {!verified && (
        <p className="text-xs text-faint">
          Not in the official registry. Metadata is read directly from the
          contract and may be unverified.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-faint">
            Your decrypted balance
          </div>
          <div className="font-mono text-lg font-semibold text-text">
            {cleartext}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-faint">Token</div>
          <div className="truncate font-mono text-[13px] text-muted" title={result.token}>
            {result.token.slice(0, 10)}…{result.token.slice(-8)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CopyButton value={result.token} label="token address" />
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View token on Sepolia Etherscan"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-hairline bg-white/[0.02] text-faint transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function GateButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-medium text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      {label}
    </button>
  );
}
