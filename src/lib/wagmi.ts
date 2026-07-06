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
 * Sepolia RPC endpoint. Read from env per project convention; falls back to a
 * public endpoint so the app still boots if the env var is unset.
 */
const sepoliaRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = getDefaultConfig({
  appName: "Wrapscan",
  projectId: walletConnectProjectId || "wrapscan-dev-placeholder",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
  ssr: true,
});
