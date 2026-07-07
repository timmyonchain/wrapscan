This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

Wrapscan ships a large, honest automated test suite (Vitest) that runs partly
against Zama's **live** Confidential Wrappers Registry and real token/wrapper
contracts on Ethereum Sepolia — this real coverage is the differentiator.

```bash
npm test            # run the full suite (unit + live Sepolia integration)
npm run test:report # run + regenerate the branded HTML report
```

- **Layer 1 — live integration:** for each of the 9 registry pairs, asserts
  address validity, deployed bytecode, `isValid` flag, ERC-20 + ERC-7984
  metadata, registry linkage both directions, ERC-7984 `supportsInterface`, and
  the faucet-able vs restricted classification (7 vs 2, 0 revoked). Includes a
  gated full round-trip (faucet → wrap → decrypt → unwrap → decrypt) that needs
  a funded test EOA (`SPIKE_PRIVATE_KEY` in `.env.local`); it self-skips with a
  clear reason if unfunded.
- **Layer 2 — unit:** error-mapping, amount/decimals math, registry loader
  (incl. malformed metadata), flow state machine (never stuck), and the proxy
  route handlers (correct forwarding, and the RPC key is never leaked).

**Visual report:** `public/test-report.html` (also served live at
`/test-report.html`) — on-brand summary of the real pass/skip counts, the 9
pairs covered, and which tests ran live on Sepolia. The numbers are generated
from the actual Vitest run, not a mockup.

Env for integration tests: `SEPOLIA_RPC_URL` (falls back to a public endpoint),
and optionally `SPIKE_PRIVATE_KEY` for the funded round-trip.
