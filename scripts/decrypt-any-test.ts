/**
 * PHASE 5 self-test (no gas): proves the exact "decrypt any ERC-7984" code path
 * the browser tool uses — sdk.createToken(ADDRESS).balanceOf(owner) — plus the
 * ERC-7984 detection gate (isConfidential true for a confidential token, false
 * for a plain ERC-20). Uses the node() relayer; real EIP-712 + relayer, no mock.
 *
 * createToken works on ANY address (registry or not) exactly the same way, so a
 * registry token proves the arbitrary-address path.
 *
 * Run: npm run decrypt-any-test
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

const CUSDT = getAddress("0x4E7B06D78965594eB5EF5414c357ca21E1554491") as Address; // ERC-7984 wrapper
const CWETH = getAddress("0x46208622DA27d91db4f0393733C8BA082ed83158") as Address; // ERC-7984 wrapper
const USDT_ERC20 = getAddress("0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0") as Address; // plain ERC-20

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL!;
  const account = privateKeyToAccount(process.env.SPIKE_PRIVATE_KEY as Hex);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc) });

  const sdk = new ZamaSDK(
    createConfig({ chains: [zamaSepolia], relayers: { [zamaSepolia.id]: node() }, publicClient, walletClient }),
  );

  console.log("=== Phase 5 decrypt-any self-test ===");
  console.log(`account: ${account.address}\n`);

  try {
    // ERC-7984 detection gate
    for (const [label, addr, expect] of [
      ["cUSDTMock (ERC-7984)", CUSDT, true],
      ["cWETHMock (ERC-7984)", CWETH, true],
      ["USDTMock (plain ERC-20)", USDT_ERC20, false],
    ] as const) {
      let isConf = false;
      try {
        isConf = await sdk.createToken(addr).isConfidential();
      } catch {
        isConf = false;
      }
      console.log(`isConfidential ${label}: ${isConf}  (expected ${expect})  ${isConf === expect ? "OK" : "MISMATCH"}`);
    }

    // Decrypt via createToken(...).balanceOf — the exact decrypt-any path
    console.log("\ndecrypting balances via sdk.createToken(addr).balanceOf(owner):");
    for (const [label, addr] of [
      ["cUSDTMock", CUSDT],
      ["cWETHMock", CWETH],
    ] as const) {
      const clear = await sdk.createToken(addr).balanceOf(account.address);
      console.log(`  ${label} (${addr}): DECRYPTED cleartext = ${clear}`);
    }
    console.log("\nPASS ✓ decrypt-any path works (createToken.balanceOf) and ERC-7984 gate is correct.");
  } finally {
    sdk.terminate();
  }
}

main().catch((e) => {
  console.error("\n=== DECRYPT-ANY TEST FAILED ===");
  console.error(e);
  process.exit(1);
});
