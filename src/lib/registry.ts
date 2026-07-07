/**
 * Registry data access — the single source of truth for the front page.
 *
 * Today this reads the registry LIVE from chain (via `/api/registry`, which
 * enumerates the on-chain Wrappers Registry and resolves ERC-20 + ERC-7984
 * metadata server-side). The shape below is deliberately decoupled from the API
 * response so we can later merge a local, curated config on top of the on-chain
 * data (a hybrid source) WITHOUT changing any UI. That merge seam is
 * `resolveRegistry(sources)` — for now it takes only the on-chain source.
 */

import { localPairs } from "@/config/localPairs";

export type Address = `0x${string}`;

export interface TokenMetadata {
  address: Address;
  /** Null when the token doesn't expose the field or the read failed. */
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}

export interface RegistryPair {
  index: number;
  /** Underlying public ERC-20. */
  token: TokenMetadata;
  /** Confidential ERC-7984 wrapper (the wrapper contract is the confidential token). */
  confidentialToken: TokenMetadata;
  /** Registry validity flag — false means revoked/superseded. */
  isValid: boolean;
  /** Underlying exposes a public mint() — a faucet-able mock a user can claim. */
  faucetable: boolean;
  chainId: number;
  /** Human network label, e.g. "Sepolia". */
  network: string;
  /** True for pairs injected from the local config (not the on-chain registry). */
  custom?: boolean;
}

export interface RegistrySnapshot {
  pairs: RegistryPair[];
  registryAddress: Address | null;
  chainId: number;
  generatedAt: string;
}

const CHAIN_LABELS: Record<number, string> = {
  11155111: "Sepolia",
  1: "Ethereum",
};

function networkLabel(chainId: number): string {
  return CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;
}

/** Raw shape returned by GET /api/registry (see src/lib/enumerateRegistry.ts). */
export interface ApiTokenMeta {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}
export interface ApiEntry {
  index: number;
  token: ApiTokenMeta;
  confidentialToken: ApiTokenMeta;
  isValid: boolean;
  faucet: { faucetable: boolean };
}
interface ApiResponse {
  meta: { chainId: number; registryAddress: string; generatedAt: string };
  entries: ApiEntry[];
}

/**
 * Pure parser: map one raw API entry to a display RegistryPair. Exported so
 * tests can feed it malformed/odd metadata and assert graceful handling.
 */
export function parsePair(entry: ApiEntry, chainId: number): RegistryPair {
  const mapMeta = (m: ApiTokenMeta): TokenMetadata => ({
    address: m.address as Address,
    symbol: m.symbol ?? null,
    name: m.name ?? null,
    decimals: typeof m.decimals === "number" ? m.decimals : null,
  });
  return {
    index: entry.index,
    token: mapMeta(entry.token),
    confidentialToken: mapMeta(entry.confidentialToken),
    isValid: Boolean(entry.isValid),
    faucetable: Boolean(entry.faucet?.faucetable),
    chainId,
    network: networkLabel(chainId),
  };
}

/**
 * The on-chain source: fetches the live registry snapshot from our API.
 * `signal` lets callers cancel on unmount.
 */
export async function fetchOnchainRegistry(
  signal?: AbortSignal,
): Promise<RegistrySnapshot> {
  const res = await fetch("/api/registry", {
    signal,
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`Registry read failed (HTTP ${res.status}) ${detail}`.trim());
  }
  const data = (await res.json()) as ApiResponse;
  if (!data?.entries || !Array.isArray(data.entries)) {
    throw new Error("Registry response was malformed (no entries).");
  }
  const chainId = data.meta?.chainId ?? 11155111;
  return {
    pairs: data.entries.map((e) => parsePair(e, chainId)),
    registryAddress: (data.meta?.registryAddress as Address) ?? null,
    chainId,
    generatedAt: data.meta?.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * Merge custom/dev-only pairs on top of the on-chain pairs. Local pairs are
 * deduped by confidential token address (on-chain always wins) and tagged
 * `custom: true`. Pure + exported so it is unit tested.
 */
export function mergeLocalPairs(
  onchain: RegistryPair[],
  local: RegistryPair[],
): RegistryPair[] {
  const seen = new Set(
    onchain.map((p) => p.confidentialToken.address.toLowerCase()),
  );
  const extra = local
    .filter((p) => !seen.has(p.confidentialToken.address.toLowerCase()))
    .map((p) => ({ ...p, custom: true }));
  return [...onchain, ...extra];
}

/**
 * Resolve the registry the UI renders — the HYBRID source.
 *
 * Source of truth is the live on-chain Wrappers Registry (`fetchOnchainRegistry`).
 * On top of it we merge `src/config/localPairs.ts` for custom/unregistered pairs.
 * Pairs Zama registers on-chain therefore appear automatically with no code
 * change; the local config is only for pairs that are not (yet) registered.
 */
export async function resolveRegistry(
  signal?: AbortSignal,
): Promise<RegistrySnapshot> {
  const onchain = await fetchOnchainRegistry(signal);
  const pairs = mergeLocalPairs(onchain.pairs, localPairs);
  return { ...onchain, pairs };
}

/** Split pairs into the active list and revoked list (kept, not discarded). */
export function partitionByValidity(pairs: RegistryPair[]): {
  active: RegistryPair[];
  revoked: RegistryPair[];
} {
  const active: RegistryPair[] = [];
  const revoked: RegistryPair[] = [];
  for (const p of pairs) (p.isValid ? active : revoked).push(p);
  return { active, revoked };
}

/** Safe display symbol — never blank/crash on odd metadata. */
export function displaySymbol(meta: TokenMetadata): string {
  const s = meta.symbol?.trim();
  if (s) return s;
  return `${meta.address.slice(0, 6)}…${meta.address.slice(-4)}`;
}

export function displayName(meta: TokenMetadata): string {
  return meta.name?.trim() || "Unknown token";
}

export function displayDecimals(meta: TokenMetadata): string {
  return typeof meta.decimals === "number" ? String(meta.decimals) : "n/a";
}
