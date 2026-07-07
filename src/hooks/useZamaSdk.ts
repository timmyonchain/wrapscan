"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { ZamaSDK } from "@zama-fhe/sdk";
import { createBrowserSdk, warmRelayerKeyMaterial } from "@/app/spike/sdk";

/**
 * Shared browser SDK, not bound to a specific token. Reuses the EXACT proven
 * /spike init (warm public key + CRS, web() relayer via /api/relayer proxy,
 * IndexedDB). Used by the "decrypt any ERC-7984" tool, which calls
 * `sdk.createToken(address).balanceOf(owner)` on an arbitrary address.
 */
export type ZamaInitState = "idle" | "warming" | "ready" | "error";

export function useZamaSdk() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const sdkRef = useRef<ZamaSDK | null>(null);
  const warmedRef = useRef(false);
  const [initState, setInitState] = useState<ZamaInitState>("idle");

  useEffect(
    () => () => {
      try {
        sdkRef.current?.terminate();
      } catch {
        /* ignore */
      }
      sdkRef.current = null;
      warmedRef.current = false;
    },
    [],
  );

  const ensureSdk = useCallback(async (): Promise<ZamaSDK> => {
    if (!publicClient) throw new Error("No RPC client. Reload and try again.");
    if (!walletClient)
      throw new Error("Wallet isn't ready yet. Give it a second and try again.");
    if (sdkRef.current) return sdkRef.current;

    setInitState("warming");
    if (!warmedRef.current) {
      await warmRelayerKeyMaterial();
      warmedRef.current = true;
    }
    const sdk = createBrowserSdk(publicClient, walletClient);
    // Same proven init /spike uses (public key for the decrypt transport).
    await sdk.relayer.fetchFheEncryptionKeyBytes();
    sdkRef.current = sdk;
    setInitState("ready");
    return sdk;
  }, [publicClient, walletClient]);

  return { ensureSdk, initState };
}
