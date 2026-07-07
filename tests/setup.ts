import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local so integration tests can use SEPOLIA_RPC_URL (and the funded
// test EOA key, if present) exactly like the app scripts do. Never committed.
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
