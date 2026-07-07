/**
 * PHASE 4 self-test (headless, real on-chain + real relayer).
 *
 * For each target confidential token: ensure the underlying balance (mint mock
 * if needed) -> WRAP (shield) -> REVEAL (balanceOf decrypt) -> UNWRAP (unshield)
 * -> REVEAL again. Uses the SAME high-level @zama-fhe/sdk methods the browser
 * panel uses (shield / balanceOf / unshield), via the node() relayer. Prints
 * every tx hash and the real decrypted cleartext balances. No mock/demo values.
 *
 * Run: npm run panel-test
 */
import { existsSync, readFileSync } from "node:fs";
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
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node } from "@zama-fhe/sdk/node";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
for (const line of existsSync(resolve(ROOT, ".env.local"))
  ? readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")
  : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined)
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

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

// cWETHMock verifies the confidential-decimals fix (WETH 18 -> cWETH 6).
// cUSDTMock was proven in the prior run; add it back here to re-prove both.
const TARGET_SYMBOLS = ["cWETHMock"];

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL!;
  const pk = process.env.SPIKE_PRIVATE_KEY as Hex;
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 30_000, retryCount: 5 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc, { timeout: 30_000, retryCount: 5 }),
  });

  const gt = JSON.parse(
    readFileSync(resolve(ROOT, "public", "registry-ground-truth.json"), "utf8"),
  ) as {
    entries: {
      confidentialToken: { address: string; symbol: string | null };
    }[];
  };
  const wrappers = TARGET_SYMBOLS.map((sym) => {
    const e = gt.entries.find((x) => x.confidentialToken.symbol === sym);
    if (!e) throw new Error(`Ground truth has no ${sym}`);
    return getAddress(e.confidentialToken.address) as Address;
  });

  const sdk = new ZamaSDK(
    createConfig({
      chains: [zamaSepolia],
      relayers: { [zamaSepolia.id]: node() },
      publicClient,
      walletClient,
    }),
  );

  console.log("=== Phase 4 panel self-test ===");
  console.log(`account: ${account.address}`);
  console.log(`ETH: ${formatUnits(await publicClient.getBalance({ address: account.address }), 18)}\n`);

  try {
    for (const wrapperAddr of wrappers) {
      const wrapped = sdk.createWrappedToken(wrapperAddr);
      const underlying = await wrapped.underlying();
      const [dec, sym] = await Promise.all([
        publicClient.readContract({ address: underlying, abi: ERC20_ABI, functionName: "decimals" }),
        publicClient.readContract({ address: underlying, abi: ERC20_ABI, functionName: "symbol" }),
      ]);
      const decimals = Number(dec);
      // Confidential token has its OWN decimals (wrapper rate), read it directly.
      const confDecimals = Number(
        await publicClient.readContract({
          address: wrapperAddr,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
      );
      const wrapAmt = 20n * 10n ** BigInt(decimals); // underlying units
      const unwrapAmt = 10n * 10n ** BigInt(confDecimals); // confidential units

      console.log(
        `\n########## ${sym} -> ${wrapperAddr} (underlying dec ${decimals}, confidential dec ${confDecimals}) ##########`,
      );

      // ensure underlying balance
      let pub = (await publicClient.readContract({
        address: underlying, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
      })) as bigint;
      if (pub < wrapAmt) {
        const mintHash = await walletClient.writeContract({
          address: underlying, abi: MINT_ABI, functionName: "mint",
          args: [account.address, wrapAmt],
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });
        console.log(`  mint ${formatUnits(wrapAmt, decimals)} ${sym}: ${mintHash}`);
        pub = (await publicClient.readContract({
          address: underlying, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
        })) as bigint;
      }
      console.log(`  public balance: ${formatUnits(pub, decimals)} ${sym}`);

      // WRAP
      console.log(`  WRAP ${formatUnits(wrapAmt, decimals)} ...`);
      const wrapRes = await wrapped.shield(wrapAmt, {
        onApprovalSubmitted: (h) => console.log(`    approve tx: ${h}`),
        onShieldSubmitted: (h) => console.log(`    wrap tx:    ${h}`),
      });
      console.log(`    wrap result tx: ${wrapRes.txHash}`);

      // REVEAL after wrap
      const afterWrap = await wrapped.balanceOf(account.address);
      console.log(`  >>> DECRYPTED confidential balance after WRAP: ${afterWrap} (${formatUnits(afterWrap, confDecimals)} ${sym})`);
      if (afterWrap <= 0n) throw new Error("Confidential balance after wrap is 0 - aborting (no faked values).");

      // UNWRAP
      console.log(`  UNWRAP ${formatUnits(unwrapAmt, decimals)} ...`);
      const unwrapRes = await wrapped.unshield(unwrapAmt, {
        onUnwrapSubmitted: (h) => console.log(`    unwrap tx:   ${h}`),
        onFinalizeSubmitted: (h) => console.log(`    finalize tx: ${h}`),
      });
      console.log(`    unshield result tx: ${unwrapRes.txHash}`);

      // REVEAL after unwrap
      const afterUnwrap = await wrapped.balanceOf(account.address);
      console.log(`  >>> DECRYPTED confidential balance after UNWRAP: ${afterUnwrap} (${formatUnits(afterUnwrap, confDecimals)} ${sym})`);

      const dropped = afterUnwrap < afterWrap;
      console.log(
        `  ${dropped ? "PASS ✓" : "FAIL ✗"} ${sym}: wrap->reveal->unwrap->reveal, confidential dropped by ${afterWrap - afterUnwrap}`,
      );
      if (!dropped) process.exitCode = 1;
    }
  } finally {
    sdk.terminate();
  }
  console.log("\n=== done ===");
}

main().catch((err) => {
  console.error("\n=== PANEL TEST FAILED (honest failure, no mock fallback) ===");
  console.error(err);
  process.exit(1);
});
