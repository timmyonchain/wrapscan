"use client";

/**
 * Phase 1 Layer B — browser SDK wiring (isolated spike code).
 *
 * Builds a real @zama-fhe/sdk instance in the browser using the `web()` relayer
 * (Web Worker + WASM loaded at runtime from cdn.zama.org). Single-threaded by
 * default => no SharedArrayBuffer => no COOP/COEP required, and no webpack
 * asyncWebAssembly config (the .wasm is never bundled).
 *
 * CORS FIX: the browser cannot call Zama's relayer directly (cross-origin
 * blocked). We point the chain's `relayerUrl` at our SAME-ORIGIN proxy
 * (`/api/relayer/<chainId>`), which forwards to the real relayer server-side.
 * Because that proxy URL is NOT a recognized Zama URL, the relayer-sdk cannot
 * infer the API version from a `/v2` suffix, so we pin `relayerRouteVersion: 2`
 * explicitly (an official FhevmInstanceConfig field, passed through to
 * createInstance). The headless node() path is left untouched (direct, works).
 */
import type { PublicClient, WalletClient } from "viem";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

/** Same-origin relayer proxy base for this chain, e.g. `${origin}/api/relayer/11155111`. */
export function relayerProxyBase(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/relayer/${zamaSepolia.id}`;
}

export function createBrowserSdk(
  publicClient: PublicClient,
  walletClient: WalletClient,
): ZamaSDK {
  const browserChain = {
    ...zamaSepolia,
    // Route relayer traffic through our same-origin proxy (CORS-safe).
    relayerUrl: relayerProxyBase(),
    // Non-Zama URL => the SDK can't sniff the version from the path; pin v2.
    relayerRouteVersion: 2 as const,
  };

  const config = createConfig({
    chains: [browserChain],
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
