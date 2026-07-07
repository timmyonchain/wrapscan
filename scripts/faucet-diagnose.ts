/**
 * Diagnostic (read-only, no gas): for every faucet-able mock in the ground
 * truth, (a) check the deployed bytecode contains the mint(address,uint256)
 * selector 0x40c10f19, and (b) eth_call-simulate mint(USER, 100*10^dec) from the
 * ACTUAL connected user address so we learn per-token whether the mint would
 * succeed or revert for that caller. No state change, no gas.
 *
 * Run: npm run faucet-diagnose
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  http,
  getAddress,
  toFunctionSelector,
  type Address,
} from "viem";
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

// Public mints are caller-independent; simulate as a real, valid address.
const USER = getAddress("0x917707C1daF2Cf93Cd273457aF728a7E5D3C10de");

interface Entry {
  token: { address: string; symbol: string | null; decimals: number | null };
  isValid: boolean;
  faucet: { faucetable: boolean };
}

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL!;
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 30_000, retryCount: 3 }),
  });
  const sel = toFunctionSelector("mint(address,uint256)"); // 0x40c10f19
  console.log(`mint(address,uint256) selector: ${sel}`);
  console.log(`simulating as USER ${USER}\n`);

  const gt = JSON.parse(
    readFileSync(resolve(ROOT, "public", "registry-ground-truth.json"), "utf8"),
  ) as { entries: Entry[] };
  const faucetable = gt.entries.filter((e) => e.isValid && e.faucet.faucetable);

  for (const e of faucetable) {
    const token = getAddress(e.token.address) as Address;
    const dec = e.token.decimals ?? 18;
    const amount = 100n * 10n ** BigInt(dec);
    const code = (await client.getBytecode({ address: token })) ?? "0x";
    const hasSelector = code.toLowerCase().includes(sel.slice(2).toLowerCase());
    let sim = "OK (would succeed)";
    try {
      await client.simulateContract({
        address: token,
        abi: MINT_ABI,
        functionName: "mint",
        args: [USER, amount],
        account: USER,
      });
    } catch (err) {
      const m =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: unknown }).shortMessage)
          : err instanceof Error
            ? err.message.split("\n")[0]
            : String(err);
      sim = `REVERT: ${m}`;
    }
    console.log(
      `${(e.token.symbol ?? "?").padEnd(10)} ${token}  dec=${dec}  selector=${
        hasSelector ? "yes" : "NO"
      }  simulate=${sim}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
