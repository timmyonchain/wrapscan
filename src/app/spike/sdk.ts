"use client";

/**
 * Phase 1 Layer B — browser SDK wiring (isolated spike code).
 *
 * Builds a real @zama-fhe/sdk instance in the browser using the `web()` relayer
 * (Web Worker + WASM loaded at runtime from cdn.zama.org). Single-threaded by
 * default => no SharedArrayBuffer => no COOP/COEP required.
 *
 * CORS FIX (#1): the browser can't call Zama's relayer directly. We point the
 * chain's `relayerUrl` at our SAME-ORIGIN proxy (`/api/relayer/<chainId>`) and
 * pin `relayerRouteVersion: 2` (non-Zama URL can't sniff the version).
 *
 * KEY-MATERIAL FIX (#2): the relayer's /keyurl points to the actual FHE public
 * key (~33 KB) and CRS (~4.4 MB) hosted on S3
 * (zama-mpc-testnet-public-*.s3.eu-west-1.amazonaws.com). Those blobs send
 * `Access-Control-Allow-Origin: *`, so the browser fetches them DIRECTLY (the
 * SDK does not route them through relayerUrl). They are large, and the SDK's
 * GET_PUBLIC_KEY worker request has a hardcoded 30s timeout that is NOT
 * configurable via the public API. Two mitigations, so we never proxy the big
 * blobs and the cost is one-time:
 *   1. `warmRelayerKeyMaterial()` downloads the blobs from the MAIN thread
 *      (no 30s worker cap) BEFORE SDK init; the S3 objects carry
 *      Last-Modified/ETag and no `cache-control`, so heuristic HTTP caching
 *      serves the worker's later same-URL GET from cache — near-instant.
 *   2. `fheArtifactStorage: indexedDBStorage` persists the fetched public key +
 *      params across sessions, and `storage: indexedDBStorage` caches
 *      credentials/permits — so after the first load nothing is refetched.
 *
 * The headless node() path is untouched (direct, works).
 */
import type { PublicClient, WalletClient } from "viem";
import { ZamaSDK, indexedDBStorage } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

/** Same-origin relayer proxy base for this chain, e.g. `${origin}/api/relayer/11155111`. */
export function relayerProxyBase(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/relayer/${zamaSepolia.id}`;
}

/**
 * Sepolia RPC used for the SDK's own chain reads. Points at our same-origin
 * `/api/rpc` proxy (absolute URL so it also resolves inside the Web Worker),
 * so the provider key never ships to the browser.
 */
function sdkNetworkRpc(): string {
  return typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : "http://localhost/api/rpc";
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
    // The SDK's own RPC for this chain (Alchemy if provided via env, else public).
    network: sdkNetworkRpc(),
  };

  const config = createConfig({
    chains: [browserChain],
    // Default web() = single WASM thread (no COOP/COEP). Persist the fetched
    // FHE public key + params in IndexedDB so the ~4.4 MB CRS is a one-time cost.
    relayers: {
      [zamaSepolia.id]: web({ fheArtifactStorage: indexedDBStorage }),
    },
    publicClient,
    walletClient,
    // Persist credentials/permits so the EIP-712 permit is reused across reloads.
    storage: indexedDBStorage,
    ethereum:
      typeof window !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).ethereum ?? undefined)
        : undefined,
  });
  return new ZamaSDK(config);
}

export interface WarmResult {
  publicKeyUrl: string;
  crsUrl: string;
  publicKeyBytes: number;
  crsBytes: number;
  ms: number;
}

/**
 * Pre-warm the browser HTTP cache with the FHE public key + CRS blobs, from the
 * MAIN thread (no 30s worker-request cap). Parses the material URLs from the
 * same-origin /keyurl proxy, then fetches the (CORS-enabled) S3 blobs directly.
 * After this resolves, the SDK worker's own GET of the same URLs is served from
 * cache, so GET_PUBLIC_KEY completes well within its 30s budget.
 *
 * Throws loudly on any failure — no mock/fallback.
 */
export async function warmRelayerKeyMaterial(): Promise<WarmResult> {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const res = await fetch(`${relayerProxyBase()}/keyurl`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`keyurl proxy returned HTTP ${res.status}`);
  }
  type KeyInfoEntry = {
    fhePublicKey?: { urls?: string[] };
    fhe_public_key?: { urls?: string[] };
  };
  const json = (await res.json()) as {
    response?: {
      fheKeyInfo?: KeyInfoEntry[];
      fhe_key_info?: KeyInfoEntry[];
      crs?: Record<string, { urls?: string[] }>;
    };
  };
  const r = json.response ?? {};
  const ki: KeyInfoEntry[] = r.fheKeyInfo ?? r.fhe_key_info ?? [];
  const first = ki[0];
  const publicKeyUrl =
    first?.fhePublicKey?.urls?.[0] ?? first?.fhe_public_key?.urls?.[0];
  const crsUrl = r.crs?.["2048"]?.urls?.[0];
  if (!publicKeyUrl || !crsUrl) {
    throw new Error("keyurl response missing public-key/CRS urls");
  }

  const [pkRes, crsRes] = await Promise.all([
    fetch(publicKeyUrl),
    fetch(crsUrl),
  ]);
  if (!pkRes.ok) throw new Error(`public-key blob HTTP ${pkRes.status}`);
  if (!crsRes.ok) throw new Error(`CRS blob HTTP ${crsRes.status}`);
  const [pkBuf, crsBuf] = await Promise.all([
    pkRes.arrayBuffer(),
    crsRes.arrayBuffer(),
  ]);

  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    publicKeyUrl,
    crsUrl,
    publicKeyBytes: pkBuf.byteLength,
    crsBytes: crsBuf.byteLength,
    ms: Math.round(t1 - t0),
  };
}
