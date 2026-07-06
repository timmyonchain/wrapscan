/**
 * PHASE 1 — LAYER A: headless decryption vertical slice.
 *
 * Proves the full private round-trip on ONE token with REAL encryption, no UI:
 *   faucet-mint USDTMock -> shield (wrap) into cUSDTMock -> user-decrypt the
 *   confidential balance (EIP-712) -> unshield (unwrap) -> decrypt again.
 *
 * Exact @zama-fhe/sdk v3.2.0 API used (confirmed from the SDK's own .d.ts and
 * docs.zama.org/protocol/sdk):
 *   - new ZamaSDK(createConfig({ chains, relayers:{ [id]: node() }, publicClient, walletClient }))
 *   - sdk.createWrappedToken(addr)  -> WrappedToken
 *   - wrapped.shield(amount)        -> wrap  (auto approve+wrap; { txHash, receipt })
 *   - wrapped.balanceOf(owner)      -> DECRYPT confidential balance to bigint (EIP-712)
 *   - wrapped.unshield(amount)      -> unwrap (orchestrates unshield -> finalize)
 *
 * FAIL LOUDLY: if the SDK cannot truly encrypt/decrypt (WASM/relayer error),
 * this throws with the exact error. There is NO mock/fallback that fakes a
 * decrypted value.
 *
 * Key handling: a throwaway EOA private key lives ONLY in .env.local
 * (gitignored). The key is NEVER logged or committed — only its address.
 *
 * Run: npm run spike
 */
import {
  existsSync,
  readFileSync,
  appendFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";

import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node } from "@zama-fhe/sdk/node";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env.local");

// --- target: registry pair index 1 (cUSDTMock wrapper over USDTMock) ---
const CUSDT_WRAPPER: Address = getAddress(
  "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
);

const MIN_ETH_WEI = 3_000_000_000_000_000n; // 0.003 ETH — enough for ~5 txs

// Public faucet mint on the mock ERC-20: mint(address,uint256)
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

const ERC20_READ_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

function loadEnvLocal() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function rpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || zamaSepolia.network
  );
}

/** Load the throwaway key, or generate + persist one and stop for funding. */
function getPrivateKeyOrBootstrap(): Hex {
  const existing = process.env.SPIKE_PRIVATE_KEY as Hex | undefined;
  if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) return existing;

  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  appendFileSync(
    ENV_PATH,
    `\n# Phase 1 spike throwaway EOA — DO NOT COMMIT. Generated ${new Date().toISOString()}\nSPIKE_PRIVATE_KEY=${pk}\n`,
  );
  console.log("\n=== Generated a fresh throwaway EOA for the spike ===");
  console.log(`ADDRESS: ${account.address}`);
  console.log("(private key stored in .env.local only — never logged/committed)");
  console.log(
    `\nACTION REQUIRED: fund this address with a little Sepolia ETH (>= ${formatUnits(
      MIN_ETH_WEI,
      18,
    )} ETH), then re-run:  npm run spike`,
  );
  console.log("Faucets: https://sepoliafaucet.com  |  https://www.alchemy.com/faucets/ethereum-sepolia\n");
  process.exit(0);
}

async function main() {
  loadEnvLocal();
  const pk = getPrivateKeyOrBootstrap();
  const account = privateKeyToAccount(pk);
  const RPC = rpcUrl();

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC),
  });

  console.log("=== Phase 1 Layer A — headless spike ===");
  console.log(`account: ${account.address}`);
  console.log(`rpc:     ${RPC}`);
  console.log(`wrapper: ${CUSDT_WRAPPER} (cUSDTMock)`);

  // --- gate on ETH balance ---
  const ethWei = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance: ${formatUnits(ethWei, 18)} ETH`);
  if (ethWei < MIN_ETH_WEI) {
    console.log(
      `\nACTION REQUIRED: fund ${account.address} with >= ${formatUnits(
        MIN_ETH_WEI,
        18,
      )} Sepolia ETH, then re-run: npm run spike\n`,
    );
    process.exit(0);
  }

  // --- build the SDK (REAL encryption via node worker pool + Zama relayer) ---
  const config = createConfig({
    chains: [zamaSepolia],
    relayers: { [zamaSepolia.id]: node() },
    publicClient,
    walletClient,
  });
  const sdk = new ZamaSDK(config);

  try {
    const wrapped = sdk.createWrappedToken(CUSDT_WRAPPER);

    // Resolve the underlying ERC-20 from the wrapper itself (ground truth).
    const underlying = await wrapped.underlying();
    const [dec, sym] = await Promise.all([
      publicClient.readContract({
        address: underlying,
        abi: ERC20_READ_ABI,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: underlying,
        abi: ERC20_READ_ABI,
        functionName: "symbol",
      }),
    ]);
    const decimals = Number(dec);
    console.log(`underlying: ${underlying} (${sym}, ${decimals} decimals)`);

    const readPublic = () =>
      publicClient.readContract({
        address: underlying,
        abi: ERC20_READ_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
    const fmt = (v: bigint) => `${formatUnits(v, decimals)} ${sym}`;

    // ---------- 1) FAUCET MINT ----------
    const pubBefore = await readPublic();
    console.log(`\n[1] public ERC-20 balance before mint: ${fmt(pubBefore)}`);
    const mintAmount = 100n * 10n ** BigInt(decimals); // 100 USDT
    const mintHash = await walletClient.writeContract({
      address: underlying,
      abi: MINT_ABI,
      functionName: "mint",
      args: [account.address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    const pubAfterMint = await readPublic();
    console.log(`    mint tx: ${mintHash}`);
    console.log(`    public balance after mint: ${fmt(pubAfterMint)}`);

    // ---------- 2) WRAP (shield) ----------
    const shieldAmount = mintAmount; // shield all 100
    console.log(`\n[2] shield (wrap) ${fmt(shieldAmount)} -> cUSDTMock ...`);
    const shieldRes = await wrapped.shield(shieldAmount);
    console.log(`    shield tx: ${shieldRes.txHash}`);
    const pubAfterWrap = await readPublic();
    console.log(`    public balance after wrap: ${fmt(pubAfterWrap)}`);

    // ---------- 3) DECRYPT confidential balance (EIP-712) ----------
    console.log(`\n[3] user-decrypting confidential balance (EIP-712 + relayer) ...`);
    const encAfterWrap = await wrapped.confidentialBalanceOf(account.address);
    console.log(`    encrypted handle: ${encAfterWrap}`);
    const clearAfterWrap = await wrapped.balanceOf(account.address);
    console.log(`    >>> DECRYPTED cleartext after WRAP: ${clearAfterWrap}`);
    if (clearAfterWrap <= 0n) {
      throw new Error(
        `Decrypted balance after wrap is ${clearAfterWrap} — expected > 0. Aborting (no faked values).`,
      );
    }

    // ---------- 4) UNWRAP (unshield) half ----------
    const unshieldAmount = clearAfterWrap / 2n;
    console.log(`\n[4] unshield (unwrap) ${unshieldAmount} confidential units ...`);
    const unshieldRes = await wrapped.unshield(unshieldAmount);
    console.log(`    unshield/finalize tx: ${unshieldRes.txHash}`);
    const pubAfterUnwrap = await readPublic();
    console.log(`    public balance after unwrap: ${fmt(pubAfterUnwrap)}`);

    // ---------- 5) DECRYPT again (should have dropped) ----------
    console.log(`\n[5] user-decrypting confidential balance again ...`);
    const clearAfterUnwrap = await wrapped.balanceOf(account.address);
    console.log(`    >>> DECRYPTED cleartext after UNWRAP: ${clearAfterUnwrap}`);

    // ---------- verdict ----------
    console.log(`\n=== RESULT ===`);
    console.log(`decrypted after wrap:   ${clearAfterWrap}`);
    console.log(`decrypted after unwrap: ${clearAfterUnwrap}`);
    const dropped = clearAfterUnwrap < clearAfterWrap;
    console.log(
      dropped
        ? `PASS ✓ private balance dropped by ${clearAfterWrap - clearAfterUnwrap} — real encryption round-trip proven.`
        : `FAIL ✗ private balance did not drop as expected.`,
    );
    if (!dropped) process.exitCode = 1;
  } finally {
    sdk.terminate();
  }
}

main().catch((err) => {
  console.error("\n=== SPIKE FAILED (loud, honest failure — no mock fallback) ===");
  console.error(err);
  process.exit(1);
});
