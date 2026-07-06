"use client";

/**
 * Phase 1 Layer B — browser SDK wiring (isolated spike code).
 *
 * Builds a real @zama-fhe/sdk instance in the browser using the `web()` relayer
 * (Web Worker + WASM loaded at runtime from cdn.zama.org). Single-threaded by
 * default => no SharedArrayBuffer => no COOP/COEP cross-origin isolation
 * required, and no webpack asyncWebAssembly config (the .wasm is never bundled).
 */
import type { PublicClient, WalletClient } from "viem";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

export function createBrowserSdk(
  publicClient: PublicClient,
  walletClient: WalletClient,
): ZamaSDK {
  const config = createConfig({
    chains: [zamaSepolia],
    // Default web() = single WASM thread; do NOT pass `threads` (that would
    // need COOP/COEP and break the cross-origin CDN worker fetch).
    relayers: { [zamaSepolia.id]: web() },
    publicClient,
    walletClient,
    ethereum:
      typeof window !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).ethereum ?? undefined)
        : undefined,
  });
  return new ZamaSDK(config);
}
