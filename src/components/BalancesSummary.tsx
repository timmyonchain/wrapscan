"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import {
  type RegistryPair,
  type Address,
  displaySymbol,
} from "@/lib/registry";
import { trimAmount } from "@/lib/amounts";
import { ERC20_BALANCE_ABI } from "@/lib/faucet";
import { EyeIcon, EyeOffIcon, SpinnerIcon, AlertIcon } from "./icons";

const MASK = "•••••";
// Hard ceiling so the widget can never sit in "loading" forever.
const LOAD_TIMEOUT_MS = 8000;

interface Holding {
  symbol: string;
  amount: string; // already trimmed for display
}

/**
 * Compact summary of the connected wallet's PUBLIC ERC-20 balances for the
 * registry's underlying tokens, with a hide/show privacy toggle.
 *
 * Public balances ONLY. This never reads confidential ERC-7984 balances and
 * never triggers an EIP-712 signature, so it is instant and cannot stall.
 */
export function BalancesSummary({ pairs }: { pairs: RegistryPair[] }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const [hidden, setHidden] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Unique underlying ERC-20s with known decimals.
  const tokens = useMemo(() => {
    const seen = new Set<string>();
    const list: { address: Address; symbol: string; decimals: number }[] = [];
    for (const p of pairs) {
      const a = p.token.address.toLowerCase();
      if (seen.has(a) || p.token.decimals === null) continue;
      seen.add(a);
      list.push({
        address: p.token.address,
        symbol: displaySymbol(p.token),
        decimals: p.token.decimals,
      });
    }
    return list;
  }, [pairs]);

  const enabled = isConnected && onSepolia && !!address && tokens.length > 0;

  const { data, isLoading, isError, refetch, isFetching } = useReadContracts({
    query: {
      enabled,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    contracts: tokens.map((t) => ({
      address: t.address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
      chainId: sepolia.id,
    })),
  });

  // Time-box: if still loading after the ceiling, drop to a friendly fallback.
  useEffect(() => {
    if (!enabled || !isLoading) {
      setTimedOut(false);
      return;
    }
    const id = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [enabled, isLoading]);

  const holdings: Holding[] = useMemo(() => {
    if (!data) return [];
    const out: Holding[] = [];
    data.forEach((res, i) => {
      if (res.status !== "success") return;
      const bal = res.result as bigint;
      if (bal > 0n) {
        out.push({
          symbol: tokens[i].symbol,
          amount: trimAmount(formatUnits(bal, tokens[i].decimals)),
        });
      }
    });
    return out;
  }, [data, tokens]);

  return (
    <div className="glass w-full rounded-2xl p-4 sm:w-72">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          Your public balances
        </span>
        <div className="flex items-center gap-1">
          {enabled && (
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh balances"
              title="Refresh"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-hairline text-faint transition-colors duration-200 hover:border-gold/40 hover:text-gold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <SpinnerIcon className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Show balances" : "Hide balances"}
            aria-pressed={hidden}
            title={hidden ? "Show" : "Hide"}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-hairline text-faint transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            {hidden ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <Body
        isConnected={isConnected}
        onSepolia={onSepolia}
        switching={switching}
        onConnect={() => openConnectModal?.()}
        onSwitch={() => void switchChainAsync({ chainId: sepolia.id })}
        loading={enabled && isLoading && !timedOut}
        failed={(isError || timedOut) && holdings.length === 0}
        onRetry={() => {
          setTimedOut(false);
          void refetch();
        }}
        holdings={holdings}
        hidden={hidden}
      />
    </div>
  );
}

function Body({
  isConnected,
  onSepolia,
  switching,
  onConnect,
  onSwitch,
  loading,
  failed,
  onRetry,
  holdings,
  hidden,
}: {
  isConnected: boolean;
  onSepolia: boolean;
  switching: boolean;
  onConnect: () => void;
  onSwitch: () => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  holdings: Holding[];
  hidden: boolean;
}) {
  if (!isConnected) {
    return (
      <MiniAction label="Connect wallet to see balances" onClick={onConnect} />
    );
  }
  if (!onSepolia) {
    return (
      <MiniAction
        label={switching ? "Switching…" : "Switch to Sepolia"}
        onClick={onSwitch}
        disabled={switching}
      />
    );
  }
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm text-faint">
        <span className="inline-flex items-center gap-1.5">
          <AlertIcon className="h-4 w-4" />
          Couldn&apos;t load balances
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-medium text-gold underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }
  if (holdings.length === 0) {
    return (
      <p className="text-sm text-muted">
        No registry tokens yet. Claim from the faucet below.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        You hold {holdings.length} registry{" "}
        {holdings.length === 1 ? "token" : "tokens"}
      </p>
      <ul className="flex flex-col gap-1.5">
        {holdings.map((h) => (
          <li
            key={h.symbol}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-muted">{h.symbol}</span>
            <span className="shrink-0 font-mono text-text">
              {hidden ? MASK : h.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      {label}
    </button>
  );
}
