"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
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

export function useFaucetClaim(opts: {
  token: Address;
  decimals: number | null;
  onSuccess?: () => void;
}): FaucetClaim {
  const { token, decimals, onSuccess } = opts;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

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
      return; // let the user click Claim again once on Sepolia
    }
    if (decimals === null) {
      setPhase("error");
      setError("This token's decimals are unknown, so a safe amount can't be minted.");
      return;
    }
    if (!publicClient) {
      setPhase("error");
      setError("No RPC client available. Reload and try again.");
      return;
    }
    try {
      setPhase("confirming");
      const txHash = await writeContractAsync({
        address: token,
        abi: MINT_ABI,
        functionName: "mint",
        args: [address, claimAmount(decimals)],
        chainId: sepolia.id,
      });
      setHash(txHash);
      setPhase("mining");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
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
    publicClient,
    writeContractAsync,
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
