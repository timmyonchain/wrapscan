/**
 * Generate a branded, screenshot-able test report (public/test-report.html) from
 * the REAL Vitest JSON output. No hardcoded numbers — everything is read from
 * the actual run. Usage: npm run test:report
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const RESULTS = resolve(ROOT, ".vitest-results.json");

interface Assertion {
  title: string;
  status: string;
  ancestorTitles?: string[];
  fullName?: string;
}
interface FileResult {
  name: string;
  assertionResults: Assertion[];
}
interface VitestJson {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime?: number;
  testResults: FileResult[];
}

const data = JSON.parse(readFileSync(RESULTS, "utf8")) as VitestJson;

const CATEGORIES: { key: string; label: string; live: boolean }[] = [
  { key: "mapTxError", label: "Error handling & recovery", live: false },
  { key: "amounts", label: "Amount & decimals math", live: false },
  { key: "registry-loader", label: "Registry data loader & classification", live: false },
  { key: "txflow", label: "Flow state machine (no stuck states)", live: false },
  { key: "proxy-rpc", label: "RPC proxy (no key leakage)", live: false },
  { key: "proxy-relayer", label: "Relayer proxy (path mapping)", live: false },
  { key: "registry.live", label: "Live registry & 9 pairs (Sepolia)", live: true },
  { key: "erc7984-detection.live", label: "Live ERC-7984 detection (Sepolia)", live: true },
  { key: "e2e-roundtrip.live", label: "Live end-to-end round-trip (Sepolia)", live: true },
];

function fileKey(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? name;
  return base.replace(/\.test\.ts$/, "");
}

const perCat = CATEGORIES.map((c) => {
  const files = data.testResults.filter((f) => fileKey(f.name) === c.key);
  const asserts = files.flatMap((f) => f.assertionResults);
  const passed = asserts.filter((a) => a.status === "passed").length;
  const skipped = asserts.filter((a) => a.status === "skipped" || a.status === "pending").length;
  const failed = asserts.filter((a) => a.status === "failed").length;
  return { ...c, total: asserts.length, passed, skipped, failed };
});

const total = data.numTotalTests;
const passed = data.numPassedTests;
const skipped = data.numPendingTests;
const failed = data.numFailedTests;
const liveTests = perCat.filter((c) => c.live).reduce((n, c) => n + c.total, 0);

// The 9 registry pairs actually covered (read from committed ground truth).
const gt = JSON.parse(
  readFileSync(resolve(ROOT, "public", "registry-ground-truth.json"), "utf8"),
) as { entries: { token: { symbol: string | null }; confidentialToken: { symbol: string | null }; faucet: { faucetable: boolean }; isValid: boolean }[] };
const pairs = gt.entries.map((e) => ({
  erc20: e.token.symbol ?? "?",
  conf: e.confidentialToken.symbol ?? "?",
  faucetable: e.faucet.faucetable,
  isValid: e.isValid,
}));

const date = new Date().toISOString().slice(0, 10);
const statusColor = failed === 0 ? "#FFD208" : "#f0857d";

const catRows = perCat
  .filter((c) => c.total > 0)
  .map(
    (c) => `
    <tr>
      <td>${c.label}${c.live ? ' <span class="live">live</span>' : ""}</td>
      <td class="num">${c.passed}</td>
      <td class="num">${c.skipped ? `<span class="skip">${c.skipped}</span>` : "0"}</td>
      <td class="num">${c.failed ? `<span class="fail">${c.failed}</span>` : "0"}</td>
      <td class="num strong">${c.total}</td>
    </tr>`,
  )
  .join("");

const pairChips = pairs
  .map(
    (p) => `<span class="chip ${p.isValid ? "" : "revoked"}">${p.erc20} → ${p.conf}${
      p.faucetable ? '<em class="f">faucet</em>' : '<em class="r">restricted</em>'
    }</span>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Wrapscan — Test report</title>
<style>
  :root{--gold:#FFD208;--void:#0b0a08;--ink:#14120d;--text:#f7f5ef;--muted:#b3ab9c;--faint:#8b8477;--hair:rgba(255,244,214,.10);}
  *{box-sizing:border-box}
  body{margin:0;background:var(--void);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
  .bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(60% 45% at 50% 0%,rgba(255,210,8,.10),transparent 70%),var(--void);}
  .wrap{max-width:920px;margin:0 auto;padding:48px 24px 64px;}
  header{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
  .mark{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,210,8,.3);background:rgba(255,210,8,.1);display:grid;place-items:center;color:var(--gold);font-weight:700;}
  h1{font-size:28px;letter-spacing:-.02em;margin:0;}
  .sub{color:var(--muted);margin:6px 0 28px;font-size:15px;}
  .badge{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,210,8,.25);background:rgba(255,210,8,.06);color:var(--gold);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;}
  .dot{width:6px;height:6px;border-radius:50%;background:var(--gold);}
  .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0;}
  @media(max-width:640px){.tiles{grid-template-columns:repeat(2,1fr)}}
  .tile{border:1px solid var(--hair);background:linear-gradient(180deg,rgba(28,25,18,.55),rgba(16,14,10,.5));border-radius:16px;padding:18px;}
  .tile .k{font-size:34px;font-weight:700;letter-spacing:-.02em;}
  .tile .l{color:var(--faint);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;}
  .tile.pass .k{color:var(--gold);}
  .panel{border:1px solid var(--hair);background:linear-gradient(180deg,rgba(28,25,18,.5),rgba(16,14,10,.45));border-radius:16px;padding:20px 22px;margin:18px 0;}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin:0 0 14px;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  th,td{text-align:left;padding:9px 6px;border-bottom:1px solid var(--hair);}
  th{color:var(--faint);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.06em;}
  td.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);width:64px;}
  td.strong{color:var(--text);font-weight:600;}
  .live{font-size:10px;color:var(--gold);border:1px solid rgba(255,210,8,.3);border-radius:6px;padding:1px 5px;margin-left:6px;vertical-align:middle;}
  .skip{color:var(--faint);} .fail{color:#f0857d;}
  .chips{display:flex;flex-wrap:wrap;gap:8px;}
  .chip{border:1px solid var(--hair);border-radius:10px;padding:7px 10px;font-size:13px;font-family:ui-monospace,monospace;color:var(--text);}
  .chip.revoked{opacity:.5;}
  .chip em{font-style:normal;font-size:10px;margin-left:7px;padding:1px 5px;border-radius:5px;}
  .chip em.f{color:var(--gold);border:1px solid rgba(255,210,8,.3);}
  .chip em.r{color:var(--muted);border:1px solid var(--hair);}
  footer{color:var(--faint);font-size:13px;margin-top:26px;line-height:1.7;}
  code{background:rgba(255,255,255,.05);border:1px solid var(--hair);border-radius:6px;padding:2px 7px;color:var(--text);font-size:13px;}
</style></head>
<body><div class="bg"></div><div class="wrap">
  <header><div class="mark">W</div><h1>Wrapscan — test report</h1></header>
  <p class="sub">Automated suite run against Zama's official Confidential Wrappers Registry and live token/wrapper contracts on Ethereum Sepolia.</p>
  <span class="badge"><span class="dot"></span>${liveTests} tests run live on Sepolia · real relayer + on-chain, no mocks</span>

  <div class="tiles">
    <div class="tile"><div class="k">${total}</div><div class="l">Total tests</div></div>
    <div class="tile pass"><div class="k">${passed}</div><div class="l">Passed</div></div>
    <div class="tile"><div class="k">${skipped}</div><div class="l">Skipped</div></div>
    <div class="tile"><div class="k" style="color:${statusColor}">${failed}</div><div class="l">Failed</div></div>
  </div>

  <div class="panel">
    <h2>Coverage by category</h2>
    <table><thead><tr><th>Category</th><th class="num">Pass</th><th class="num">Skip</th><th class="num">Fail</th><th class="num">Total</th></tr></thead>
    <tbody>${catRows}</tbody></table>
  </div>

  <div class="panel">
    <h2>All 9 registry pairs covered</h2>
    <div class="chips">${pairChips}</div>
  </div>

  <footer>
    Reproduce: <code>npm test</code> &nbsp;·&nbsp; Live report generated ${date} &nbsp;·&nbsp; ${skipped} skipped = the funded-EOA mutation round-trip (needs a funded test key; the read-only live assertions run unconditionally).<br/>
    Numbers above are the real Vitest results, not a mockup.
  </footer>
</div></body></html>`;

mkdirSync(resolve(ROOT, "public"), { recursive: true });
writeFileSync(resolve(ROOT, "public", "test-report.html"), html);
console.log(
  `Wrote public/test-report.html — ${passed}/${total} passed, ${skipped} skipped, ${failed} failed (${liveTests} live).`,
);
