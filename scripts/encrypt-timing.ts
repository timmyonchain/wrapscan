/**
 * Diagnostic (no gas): time the FHE encrypt for a single euint64 bound to the
 * cWETHMock wrapper — the exact op unshield/unwrap does. node() is multi-threaded,
 * so this isolates the relayer /input-proof round-trip latency: if node total is
 * small, the browser problem is purely single-threaded local proof-gen (threads
 * fix it); if node total is large, the relayer verification is the bottleneck.
 *
 * Run: npm run encrypt-timing
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, getAddress, type Hex, type Address } from "viem";
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
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL!;
  const account = privateKeyToAccount(process.env.SPIKE_PRIVATE_KEY as Hex);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
  const CWETH = getAddress("0x46208622DA27d91db4f0393733C8BA082ed83158") as Address;

  const sdk = new ZamaSDK(
    createConfig({ chains: [zamaSepolia], relayers: { [zamaSepolia.id]: node() }, publicClient, walletClient }),
  );

  console.log("Timing sdk.encrypt (euint64) bound to cWETHMock, node() multi-threaded relayer...\n");
  try {
    for (let i = 1; i <= 3; i++) {
      const t0 = performance.now();
      const res = (await sdk.encrypt({
        values: [{ value: 1_000_000n, type: "euint64" }],
        contractAddress: CWETH,
        userAddress: account.address,
      })) as unknown as { inputProof?: { length?: number } };
      const ms = Math.round(performance.now() - t0);
      console.log(`attempt ${i}: ${ms} ms  (proof bytes=${res.inputProof?.length ?? "?"})`);
    }
  } finally {
    sdk.terminate();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
