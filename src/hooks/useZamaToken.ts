"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { ZamaSDK, WrappedToken } from "@zama-fhe/sdk";
import { createBrowserSdk, warmRelayerKeyMaterial } from "@/app/spike/sdk";
import type { Address } from "@/lib/registry";

/**
 * Reuses the EXACT proven /spike browser SDK init: warm the FHE public key +
 * CRS into cache, build the web() relayer SDK (same-origin /api/relayer proxy,
 * IndexedDB caching), and hand back a WrappedToken for the confidential token.
 *
 * `ensureReady()` is idempotent and lazy — call it right before any FHE action
 * (wrap encrypts the amount, unwrap/reveal decrypt), so opening the panel is
 * cheap and the ~4.4 MB CRS only loads on the first confidential action.
 */
export type ZamaInitState = "idle" | "warming" | "ready" | "error";

export function useZamaToken(confidentialToken: Address) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const sdkRef = useRef<ZamaSDK | null>(null);
  const wrappedRef = useRef<WrappedToken | null>(null);
  const warmedRef = useRef(false);

  const [initState, setInitState] = useState<ZamaInitState>("idle");
  const [initError, setInitError] = useState<string | undefined>();

  useEffect(
    () => () => {
      try {
        sdkRef.current?.terminate();
      } catch {
        /* ignore */
      }
      sdkRef.current = null;
      wrappedRef.current = null;
      warmedRef.current = false;
    },
    [],
  );

  const ensureReady = useCallback(async (): Promise<WrappedToken> => {
    if (!publicClient) throw new Error("No RPC client. Reload and try again.");
    if (!walletClient)
      throw new Error("Wallet isn't ready yet. Give it a second and try again.");
    if (wrappedRef.current && sdkRef.current) return wrappedRef.current;

    try {
      setInitState("warming");
      setInitError(undefined);
      if (!warmedRef.current) {
        await warmRelayerKeyMaterial();
        warmedRef.current = true;
      }
      if (!sdkRef.current) {
        sdkRef.current = createBrowserSdk(publicClient, walletClient);
      }
      wrappedRef.current = sdkRef.current.createWrappedToken(confidentialToken);
      setInitState("ready");
      return wrappedRef.current;
    } catch (e) {
      setInitState("error");
      setInitError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [publicClient, walletClient, confidentialToken]);

  return { ensureReady, initState, initError };
}
