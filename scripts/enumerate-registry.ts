/**
 * Dev-only ground-truth script.
 *
 * Connects to Sepolia via our RPC (NEXT_PUBLIC_SEPOLIA_RPC_URL), enumerates the
 * Wrappers Registry, resolves ERC-20 + ERC-7984 metadata for every pair, labels
 * validity and faucet-ability, and writes a clean JSON snapshot to
 * public/registry-ground-truth.json. Also prints the resolved Zama config with
 * sources and the cUSDT sanity-check result.
 *
 * Run: npm run ground-truth
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Minimal .env.local loader (no runtime dep) so the script honors our RPC var.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

import { enumerateRegistry } from "../src/lib/enumerateRegistry";
import { resolvedZamaSepoliaValues } from "../src/lib/zamaConfig";

async function main() {
  console.log("\n=== Resolved Zama Sepolia config (each with source) ===\n");
  for (const row of resolvedZamaSepoliaValues) {
    console.log(`${row.key.padEnd(42)} ${String(row.value)}`);
    console.log(`${"".padEnd(42)}   ↳ source: ${row.source}`);
  }

  console.log("\n=== Enumerating Wrappers Registry on Sepolia... ===\n");
  const data = await enumerateRegistry();

  const outDir = resolve(__dirname, "..", "public");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "registry-ground-truth.json");
  writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(`RPC:              ${data.meta.rpcUrl}`);
  console.log(`Registry:         ${data.meta.registryAddress}`);
  console.log(`Total pairs:      ${data.meta.totalPairs}\n`);

  for (const e of data.entries) {
    const u = e.token;
    const c = e.confidentialToken;
    console.log(
      `#${e.index}  ${u.symbol ?? "?"} (${u.name ?? "?"}, dec ${u.decimals ?? "?"}) ` +
        `-> ${c.symbol ?? "?"} (${c.name ?? "?"})`,
    );
    console.log(`     underlying:    ${u.address}`);
    console.log(`     confidential:  ${c.address}`);
    console.log(
      `     isValid: ${e.isValid}  |  faucet-able: ${e.faucet.faucetable} ` +
        `(selector:${e.faucet.selectorPresent} call:${e.faucet.callSucceeds})`,
    );
  }

  console.log("\n=== cUSDT sanity check ===");
  console.log(`reference:  ${data.cusdtSanityCheck.referenceAddress}`);
  console.log(`found:      ${data.cusdtSanityCheck.foundInRegistry}`);
  console.log(`index:      ${data.cusdtSanityCheck.matchedIndex}`);
  console.log(`isValid:    ${data.cusdtSanityCheck.isValid}`);
  console.log(`note:       ${data.cusdtSanityCheck.note}`);

  console.log(`\nWrote ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
