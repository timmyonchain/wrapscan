/**
 * Zama Sepolia ground-truth configuration.
 *
 * IMPORTANT: We do NOT hardcode any Zama infrastructure address or URL here.
 * Every value is sourced directly from the official SDK's own exported chain
 * config (`@zama-fhe/sdk/chains` -> `sepolia`). If Zama updates their
 * infrastructure, bumping the SDK version updates these values automatically.
 *
 * Source of truth: `@zama-fhe/sdk` v3.2.0, export `./chains` -> `sepolia`.
 * Cross-checked against https://docs.zama.org (Sepolia addresses page).
 */
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";

export const SEPOLIA_CHAIN_ID = 11155111 as const;

if (zamaSepolia.id !== SEPOLIA_CHAIN_ID) {
  throw new Error(
    `Unexpected Zama chain id: got ${zamaSepolia.id}, expected ${SEPOLIA_CHAIN_ID}`,
  );
}

/**
 * The raw, resolved Zama config object exactly as the SDK ships it for Sepolia.
 * This is re-exported so the rest of the app and the dev scripts read from a
 * single, SDK-derived source.
 */
export const zamaSepoliaConfig = zamaSepolia;

/**
 * A flattened, labelled view used for printing / display. Each entry records
 * the resolved value and where it came from.
 */
export interface ResolvedConfigValue {
  key: string;
  value: string | number;
  source: string;
}

const SDK_SOURCE = "@zama-fhe/sdk@3.2.0 -> ./chains -> sepolia";

export const resolvedZamaSepoliaValues: ResolvedConfigValue[] = [
  { key: "chainId", value: zamaSepolia.id, source: SDK_SOURCE },
  { key: "gatewayChainId", value: zamaSepolia.gatewayChainId, source: SDK_SOURCE },
  { key: "relayerUrl", value: zamaSepolia.relayerUrl, source: SDK_SOURCE },
  { key: "defaultNetworkRpc", value: zamaSepolia.network, source: SDK_SOURCE },
  { key: "aclContractAddress", value: zamaSepolia.aclContractAddress, source: SDK_SOURCE },
  { key: "kmsContractAddress", value: zamaSepolia.kmsContractAddress, source: SDK_SOURCE },
  {
    key: "inputVerifierContractAddress",
    value: zamaSepolia.inputVerifierContractAddress,
    source: SDK_SOURCE,
  },
  {
    key: "verifyingContractAddressDecryption",
    value: zamaSepolia.verifyingContractAddressDecryption,
    source: SDK_SOURCE,
  },
  {
    key: "verifyingContractAddressInputVerification",
    value: zamaSepolia.verifyingContractAddressInputVerification,
    source: SDK_SOURCE,
  },
  {
    key: "wrappersRegistryAddress",
    value: zamaSepolia.registryAddress ?? "(none)",
    source: `${SDK_SOURCE} (cross-checked: docs.zama.org Sepolia addresses)`,
  },
];

/**
 * The Wrappers Registry address for Sepolia, taken from the SDK chain config.
 * Verified equal to the value published on docs.zama.org:
 * 0x2f0750Bbb0A246059d80e94c454586a7F27a128e
 */
export const WRAPPERS_REGISTRY_ADDRESS = zamaSepolia.registryAddress as `0x${string}`;

/**
 * Server-side Sepolia RPC (direct upstream). Read from the server-only
 * `SEPOLIA_RPC_URL`; falls back to the SDK's default public endpoint. Used by
 * server code (the /api/rpc proxy upstream, /api/registry, ground-truth script)
 * — never the browser, which talks to the same-origin /api/rpc proxy instead.
 */
export function getSepoliaRpcUrl(): string {
  return process.env.SEPOLIA_RPC_URL || zamaSepolia.network;
}
