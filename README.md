# Wrapscan

Wrapscan is the home for Zama's Confidential Wrapper Registry: browse every registered ERC-20 and its confidential ERC-7984 wrapper, then faucet, wrap, unwrap, and reveal your confidential balance, on Ethereum Sepolia.

## Live

- App: https://wrapscan-one.vercel.app
- Decrypt any ERC-7984 token: https://wrapscan-one.vercel.app/decrypt
- Live decrypt demo (developer spike page): https://wrapscan-one.vercel.app/spike
- Test report (real results): https://wrapscan-one.vercel.app/test-report.html

## What it does

- Browse the on-chain Confidential Wrappers Registry as glass cards, with copy and Etherscan links for both the ERC-20 and the ERC-7984 addresses.
- Faucet: claim official mock test tokens (public mint) for the faucet-able pairs.
- Wrap (shield): turn public ERC-20 into confidential ERC-7984.
- Unwrap (unshield): turn confidential back into public.
- Reveal: decrypt your own confidential balance with a real EIP-712 signature.
- Decrypt any ERC-7984: paste any confidential token address (in the registry or not) and decrypt your balance, with clear "in official registry" vs "unverified" labeling.
- Surfaces revoked (isValid=false) registry entries, dimmed and read-only, so the full on-chain state is visible.

Every action is real on-chain or a real relayer call. There is no mock or demo-mode fallback anywhere.

## Feature checklist (bounty mapping)

| Requirement | Status | Where |
| --- | --- | --- |
| Browse the confidential wrapper registry | Done | `/` home, `src/components/RegistryBrowser.tsx` |
| Registry read from the official on-chain source | Done | `src/lib/enumerateRegistry.ts`, `/api/registry` |
| Faucet mock test tokens | Done | `src/components/FaucetPanel.tsx`, `src/hooks/useFaucetClaim.ts` |
| Wrap (shield) | Done | `src/components/TokenActionPanel.tsx` (`shield`) |
| Unwrap (unshield) | Done | `src/components/TokenActionPanel.tsx` (`unshield` / `unshieldAll`) |
| Reveal confidential balance (EIP-712 decrypt) | Done | `TokenActionPanel` reveal, `src/hooks/useZamaToken.ts` |
| Decrypt any ERC-7984 (registry or not) | Done | `/decrypt`, `src/components/DecryptAnyTool.tsx` |
| Revoked / isValid handling | Done | `partitionByValidity` in `src/lib/registry.ts`, RegistryBrowser |
| Faucet-able vs restricted classification | Done | `src/lib/enumerateRegistry.ts` (mint detection) |
| Add a new pair (extensibility) | Done | `src/config/localPairs.ts` + live registry (see below) |
| Automated tests against live Sepolia | Done | `tests/`, `npm test`, `/test-report.html` |
| Works on Sepolia (shield/unshield/decrypt) | Done | proven headless and in-browser |

## Supported network

Ethereum Sepolia (chain id `11155111`). Wrap (shield), unwrap (unshield), and confidential balance decryption all work on Sepolia through Zama's official relayer and coprocessor. Wallet connection is gated to Sepolia, with a switch-network prompt when needed.

## How the registry is sourced (hybrid)

The registry is a hybrid source with a clear order of precedence:

1. Source of truth: the official on-chain Zama Confidential Wrappers Registry.
   - Contract on Sepolia: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`.
   - This address and all Zama infrastructure values are read from the SDK's own chain config (`@zama-fhe/sdk` -> `./chains` -> `sepolia`) in `src/lib/zamaConfig.ts`. They are not hardcoded from memory or a tutorial.
   - `src/lib/enumerateRegistry.ts` calls `getTokenConfidentialTokenPairs()` on the registry, then resolves ERC-20 and ERC-7984 metadata (symbol, name, decimals) for every pair. It is served live at `GET /api/registry`.
2. Local overlay: `src/config/localPairs.ts` for custom or unregistered pairs, merged on top of the on-chain result (see the next section).

Correctness handling that the UI demonstrates:

- isValid / revoked: revoked entries are not silently dropped. They are shown in a separate, dimmed, read-only section with a "Revoked" badge, and no faucet or wrap actions are offered on them. Today the registry reports 9 pairs, all valid (0 revoked); the UI states this explicitly.
- Faucet-able vs restricted: for each underlying ERC-20 the app checks whether a public `mint(address,uint256)` exists (selector present in bytecode plus a static-call simulation that does not revert on access control). Today that yields 7 faucet-able mocks and 2 restricted tokens (the real tGBP and steakcUSDC), each badged accordingly. A restricted token shows a disabled, clearly labeled faucet button rather than a broken one.

## How to add a new ERC-20 to ERC-7984 pair

There are two realities, and both are honest and working:

### A. A pair Zama registers on-chain: zero code changes

Because the app reads the official registry live, any pair added to the on-chain registry appears automatically on next load, fully functional (browse, faucet if mintable, wrap, unwrap, decrypt). You do not edit anything.

### B. A custom or not-yet-registered pair: one file

Add it to `src/config/localPairs.ts`. `resolveRegistry()` in `src/lib/registry.ts` merges these on top of the on-chain pairs (deduped by confidential-token address, so on-chain always wins), tags them `custom: true`, and the card renders with a small "Custom (local)" badge. Its faucet, wrap, unwrap, and decrypt actions run against the real addresses you provide.

Real, copy-pasteable example (fill in real Sepolia addresses):

```ts
// src/config/localPairs.ts
import type { RegistryPair } from "@/lib/registry";

export const localPairs: RegistryPair[] = [
  {
    index: 1000, // unique, does not collide with on-chain indices (0..8 today)
    token: {
      address: "0xYourUnderlyingErc20Address",
      symbol: "MYTKN",
      name: "My Token (Mock)",
      decimals: 18,
    },
    confidentialToken: {
      address: "0xYourErc7984WrapperAddress",
      symbol: "cMYTKN",
      name: "Confidential My Token",
      decimals: 6,
    },
    isValid: true,
    // true ONLY if the underlying exposes a public mint(address,uint256)
    faucetable: true,
    chainId: 11155111,
    network: "Sepolia",
  },
];
```

Notes that reflect the real behavior:

- Public balance and wrap use the underlying `token.decimals`; confidential balance and unwrap use `confidentialToken.decimals`. The wrapper applies a rate, so these often differ (for example WETH is 18 decimals, its wrapper cWETH is 6). Set both correctly.
- If a pair with the same confidential-token address is already registered on-chain, the on-chain entry wins and your local copy is ignored (no duplicates).
- The merge is covered by unit tests in `tests/unit/registry-loader.test.ts`.

## Architecture (how it works)

- Framework: Next.js 14 (App Router), TypeScript strict, Tailwind CSS.
- Wallet and chain: wagmi + viem + RainbowKit, gated to Sepolia.
- Confidential operations: `@zama-fhe/sdk` (v3.2.0), the current high-level Zama SDK. `WrappedToken.shield` wraps, `WrappedToken.unshield` / `unshieldAll` unwraps, and `Token.balanceOf` performs EIP-712 user-decryption.
- Same-origin relayer proxy `app/api/relayer/[...path]/route.ts`. Why: the browser cannot call Zama's relayer directly (cross-origin), and the relayer stays server-side. The proxy forwards `keyurl`, `input-proof`, `user-decrypt` and the other relayer routes to the upstream from `zamaConfig` (`https://relayer.testnet.zama.org/v2`). It carries a higher `maxDuration` because the input-proof (zero-knowledge) verification is the slow relayer step.
- Same-origin RPC proxy `app/api/rpc/route.ts`. Why: the Alchemy RPC key lives only in the server-side `SEPOLIA_RPC_URL` and never ships to the browser. The wagmi client and the SDK's per-chain transport point at `/api/rpc`.
- Browser FHE: the SDK loads its WASM and relayer bundle from Zama's CDN in a Web Worker, warms the public key and CRS into cache, and persists them in IndexedDB. Cross-origin isolation (COOP + COEP credentialless) is enabled so the encrypt path can run multi-threaded. Decryption is a real EIP-712 user-decryption round-trip through the relayer.

## Testing

Wrapscan ships a large, honest automated test suite (Vitest). Part of it runs against Zama's live Confidential Wrappers Registry and real token and wrapper contracts on Sepolia. That real coverage is the differentiator, and it is stated plainly here because it is verifiable.

```bash
npm test            # full suite (unit + live Sepolia integration)
npm run test:report # run and regenerate the branded HTML report
```

- Totals: 137 tests, 136 pass, 1 skipped. The one skip is the gas-spending end-to-end mutation round-trip (faucet, wrap, decrypt, unwrap, decrypt); it self-skips with a clear reason when no funded test wallet is available. All read-only live assertions run unconditionally.
- Live coverage: 82 tests run live against Sepolia (not mocks). For each of the 9 registry pairs: valid checksummed addresses, deployed bytecode, the isValid flag, ERC-20 and ERC-7984 metadata, registry linkage in both directions, ERC-7984 `supportsInterface`, and faucet-able vs restricted classification. Plus live ERC-7984 detection used by `/decrypt`.
- Unit coverage: error mapping, amount and decimals math (including edge cases), the registry loader with malformed metadata, the flow state machine (never stuck), and the proxy route handlers (correct forwarding, and an explicit assertion that the RPC key never appears in a response).
- Visual report: `public/test-report.html`, served at `/test-report.html`. The numbers are generated from the real Vitest run, not a mockup.

## Local development

Prerequisites: Node.js 18+ and npm.

```bash
git clone https://github.com/timmyonchain/wrapscan.git
cd wrapscan
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

Environment variables (`.env.local`, never committed):

```bash
# Server-only Sepolia RPC (no NEXT_PUBLIC_ prefix). Used by the /api/rpc proxy,
# /api/registry, and the test scripts. Never shipped to the browser.
SEPOLIA_RPC_URL="https://your-provider/sepolia-endpoint"

# WalletConnect Cloud project id (optional; injected wallets work without it).
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""

# Optional: a throwaway funded test EOA private key, used ONLY by the
# gas-spending headless scripts and the one live end-to-end test. Never commit.
# SPIKE_PRIVATE_KEY="0x..."
```

Useful scripts:

```bash
npm run build          # production build
npm run ground-truth   # enumerate the live registry to public/registry-ground-truth.json
npm run spike          # headless wrap/decrypt/unwrap round-trip (needs a funded EOA)
npm test               # test suite
```

## Deployment

Deployed on Vercel. `SEPOLIA_RPC_URL` is set as a server-side environment variable (production, preview, development); it is never a `NEXT_PUBLIC_` value, so the RPC key does not reach the browser. Cross-origin isolation headers are configured in `next.config.mjs`.

## Security notes

- The RPC key lives only in `SEPOLIA_RPC_URL` (server-side) and is proxied through `/api/rpc`. It is never in the client bundle. A unit test asserts the key is never present in a proxy response.
- The Zama relayer is proxied server-side through `/api/relayer`, so no credentials or relayer internals are exposed to the browser.
- No mock or demo-mode fallbacks. Every faucet, wrap, unwrap, and decryption is a real on-chain transaction or a real relayer call. Failures surface real, specific error messages and never hang.
- No secrets are committed. `.env.local`, the test results artifact, and coverage are gitignored.

## Open source

Licensed under the MIT License. See [LICENSE](./LICENSE).

Contributions are welcome. Please keep the constraints this project holds itself to: real on-chain and relayer behavior only (no mock fallbacks), TypeScript strict, no secrets in the repo, and no em dashes in user-facing copy. Run `npm test` and `npm run build` before opening a pull request.
