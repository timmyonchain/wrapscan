/**
 * Headless end-to-end test of the Phase 3 faucet.
 *
 * Mirrors exactly what the FaucetPanel does in the browser: pick a faucet-able
 * mock from the on-chain ground truth, call the verified public
 * `mint(address, 100 * 10^decimals)`, wait for the receipt, and assert the
 * wallet's public ERC-20 balance increased by exactly that amount. Real
 * on-chain mint on Sepolia — no mock/demo fallback.
 *
 * Uses the same throwaway EOA as the spike (SPIKE_PRIVATE_KEY in .env.local,
 * never logged) and the direct SEPOLIA_RPC_URL (server-side).
 *
 * Run: npm run faucet-test
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
const BAL_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const CLAIM_UNITS = 100n;

interface GroundTruthEntry {
  token: { address: string; symbol: string | null; decimals: number | null };
  isValid: boolean;
  faucet: { faucetable: boolean };
}

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.SPIKE_PRIVATE_KEY as Hex | undefined;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL missing in .env.local");
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk))
    throw new Error("SPIKE_PRIVATE_KEY missing/invalid in .env.local");

  const gt = JSON.parse(
    readFileSync(resolve(ROOT, "public", "registry-ground-truth.json"), "utf8"),
  ) as { entries: GroundTruthEntry[] };

  const target = gt.entries.find(
    (e) => e.isValid && e.faucet.faucetable && typeof e.token.decimals === "number",
  );
  if (!target) throw new Error("No faucet-able token found in ground truth.");

  const token = getAddress(target.token.address) as Address;
  const decimals = target.token.decimals as number;
  const symbol = target.token.symbol ?? "TOKEN";
  const amount = CLAIM_UNITS * 10n ** BigInt(decimals);

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

  console.log("=== Phase 3 faucet headless test ===");
  console.log(`account: ${account.address}`);
  console.log(`token:   ${symbol} (${token}, ${decimals} decimals)`);

  const eth = await publicClient.getBalance({ address: account.address });
  console.log(`ETH:     ${formatUnits(eth, 18)}`);
  if (eth < 500_000_000_000_000n) {
    console.log(
      `\nFund ${account.address} with a little Sepolia ETH, then re-run: npm run faucet-test\n`,
    );
    process.exit(0);
  }

  const read = () =>
    publicClient.readContract({
      address: token,
      abi: BAL_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

  const before = await read();
  console.log(`\nbalance before: ${formatUnits(before, decimals)} ${symbol}`);
  console.log(`claiming ${CLAIM_UNITS} ${symbol} (mint ${amount})...`);

  const hash = await walletClient.writeContract({
    address: token,
    abi: MINT_ABI,
    functionName: "mint",
    args: [account.address, amount],
  });
  console.log(`tx hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`mined in block ${receipt.blockNumber} (status: ${receipt.status})`);

  const after = await read();
  console.log(`balance after:  ${formatUnits(after, decimals)} ${symbol}`);

  const delta = after - before;
  console.log(`\n=== RESULT ===`);
  console.log(`delta: ${formatUnits(delta, decimals)} ${symbol} (raw ${delta})`);
  if (delta === amount) {
    console.log(
      `PASS ✓ real on-chain mint of ${CLAIM_UNITS} ${symbol} confirmed. tx: ${hash}`,
    );
  } else {
    console.log(`FAIL ✗ expected +${amount}, got +${delta}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\n=== FAUCET TEST FAILED ===");
  console.error(err);
  process.exit(1);
});
