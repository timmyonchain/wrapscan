import type { RegistryPair } from "@/lib/registry";

/**
 * Custom / dev-only pairs, merged on top of the LIVE on-chain registry by
 * `resolveRegistry()` in `src/lib/registry.ts`.
 *
 * You do NOT need this for pairs Zama registers on-chain: those appear
 * automatically because the app reads the official Wrappers Registry live. Use
 * this only to surface an UNREGISTERED or work-in-progress ERC-20 to ERC-7984
 * wrapper locally.
 *
 * How it behaves once added:
 *  - deduped against the on-chain registry by confidential-token address
 *    (on-chain always wins),
 *  - rendered as a normal card with a small "Custom" badge,
 *  - its faucet / wrap / unwrap / decrypt actions run against the real addresses
 *    you provide (faucet only if the underlying has a public mint).
 *
 * `index` just needs to be unique and not collide with on-chain indices (they
 * are 0..8 today), so use something like 1000+.
 */
export const localPairs: RegistryPair[] = [
  // Example: uncomment and fill in real Sepolia addresses to show a custom pair.
  // {
  //   index: 1000,
  //   token: {
  //     address: "0xYourUnderlyingErc20Address",
  //     symbol: "MYTKN",
  //     name: "My Token (Mock)",
  //     decimals: 18,
  //   },
  //   confidentialToken: {
  //     address: "0xYourErc7984WrapperAddress",
  //     symbol: "cMYTKN",
  //     name: "Confidential My Token",
  //     decimals: 6,
  //   },
  //   isValid: true,
  //   faucetable: true, // true ONLY if the underlying exposes public mint(address,uint256)
  //   chainId: 11155111,
  //   network: "Sepolia",
  // },
];
