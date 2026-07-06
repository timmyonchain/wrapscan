"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";

/**
 * WalletConnect Cloud project id. Required by RainbowKit's WalletConnect
 * connector. Provided via env; a public placeholder keeps local dev working
 * without WalletConnect-based wallets.
 */
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * Same-origin JSON-RPC endpoint. The browser never sees the provider URL/key —
 * it talks to our `/api/rpc` route, which forwards to `SEPOLIA_RPC_URL`
 * server-side. Absolute (origin-based) URL so it also works inside the SDK's
 * Web Worker. SSR placeholder is never used for client RPC calls.
 */
const sepoliaRpcUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : "http://localhost/api/rpc";

export const wagmiConfig = getDefaultConfig({
  appName: "Wrapscan",
  projectId: walletConnectProjectId || "wrapscan-dev-placeholder",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
  ssr: true,
});
