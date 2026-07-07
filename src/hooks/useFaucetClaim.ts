"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { MINT_ABI, claimAmount, mapTxError } from "@/lib/faucet";
import type { Address } from "@/lib/registry";

/**
 * Generic on-chain-action phase machine. Reused by the faucet now; the same
 * shape (idle → confirming → mining → success | error) will back wrap/unwrap.
 */
export type TxPhase = "idle" | "confirming" | "mining" | "success" | "error";

export interface FaucetClaim {
  phase: TxPhase;
  hash?: `0x${string}`;
  error?: string;
  /** True while the wallet prompt is open or the tx is mining. */
  busy: boolean;
  needsConnect: boolean;
  needsSwitch: boolean;
  ready: boolean;
  connect: () => void;
  switchToSepolia: () => Promise<void>;
  claim: () => Promise<void>;
  reset: () => void;
}

// The wallet may never open a prompt (locked, popup blocked, extension asleep).
// Cap the wait so the button can ALWAYS recover instead of spinning forever.
const SIGNATURE_TIMEOUT_MS = 90_000;
const RECEIPT_TIMEOUT_MS = 150_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function useFaucetClaim(opts: {
  token: Address;
  decimals: number | null;
  onSuccess?: () => void;
}): FaucetClaim {
  const { token, decimals, onSuccess } = opts;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  // The viem WalletClient bound to the CONNECTED connector/account (Rabby, etc.).
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const onSepolia = chainId === sepolia.id;
  const needsConnect = !isConnected;
  const needsSwitch = isConnected && !onSepolia;
  const ready = isConnected && onSepolia && decimals !== null;
  const busy = phase === "confirming" || phase === "mining" || switching;

  const reset = useCallback(() => {
    setPhase("idle");
    setHash(undefined);
    setError(undefined);
  }, []);

  const connect = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const switchToSepolia = useCallback(async () => {
    setError(undefined);
    try {
      await switchChainAsync({ chainId: sepolia.id });
    } catch (e) {
      setError(mapTxError(e));
    }
  }, [switchChainAsync]);

  const claim = useCallback(async () => {
    setError(undefined);

    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (!onSepolia) {
      await switchToSepolia();
      return; // user clicks Claim again once actually on Sepolia
    }
    if (decimals === null) {
      setPhase("error");
      setError("This token's decimals are unknown, so a safe amount can't be minted.");
      return;
    }
    if (!walletClient) {
      setPhase("error");
      setError("Wallet isn't ready yet. Give it a second and try again.");
      return;
    }
    if (!publicClient) {
      setPhase("error");
      setError("No RPC client available. Reload and try again.");
      return;
    }

    try {
      // Dispatch the mint straight to the connected wallet. No simulate/prepare
      // step, no chainId param (we're already gated on Sepolia) — just the
      // signature request, time-boxed so it can never hang.
      setPhase("confirming");
      const txHash = await withTimeout(
        walletClient.writeContract({
          address: token,
          abi: MINT_ABI,
          functionName: "mint",
          args: [address, claimAmount(decimals)],
          account: address,
          chain: sepolia,
        }),
        SIGNATURE_TIMEOUT_MS,
        "Your wallet didn't open a confirmation. Make sure it's unlocked and no popup was blocked, then try again.",
      );

      setHash(txHash);
      setPhase("mining");
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      setPhase("success");
      onSuccess?.();
    } catch (e) {
      setPhase("error");
      setError(mapTxError(e));
    }
  }, [
    address,
    isConnected,
    onSepolia,
    decimals,
    walletClient,
    publicClient,
    openConnectModal,
    switchToSepolia,
    token,
    onSuccess,
  ]);

  return {
    phase,
    hash,
    error,
    busy,
    needsConnect,
    needsSwitch,
    ready,
    connect,
    switchToSepolia,
    claim,
    reset,
  };
}
