"use client";

import { useCallback } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import {
  type RegistryPair,
  displaySymbol,
} from "@/lib/registry";
import {
  ERC20_BALANCE_ABI,
  FAUCET_CLAIM_UNITS,
  sepoliaTxUrl,
} from "@/lib/faucet";
import { useFaucetClaim } from "@/hooks/useFaucetClaim";
import {
  DropletIcon,
  LockIcon,
  SpinnerIcon,
  CheckIcon,
  ExternalLinkIcon,
  AlertIcon,
} from "./icons";

/** Live public ERC-20 balance for the connected wallet + the Claim flow. */
export function FaucetPanel({ pair }: { pair: RegistryPair }) {
  const symbol = displaySymbol(pair.token);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;
  const decimals = pair.token.decimals;

  const balanceQuery = useReadContract({
    address: pair.token.address,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: isConnected && onSepolia && !!address && pair.faucetable,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  });

  const onSuccess = useCallback(() => {
    void balanceQuery.refetch();
  }, [balanceQuery]);

  const claim = useFaucetClaim({
    token: pair.token.address,
    decimals,
    onSuccess,
  });

  // Restricted (real tGBP, steakcUSDC): never a broken button.
  if (!pair.faucetable) {
    return (
      <div className="mt-1 flex flex-col gap-2 border-t border-hairline pt-4">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 text-sm font-medium text-faint"
        >
          <LockIcon className="h-4 w-4" />
          Minting restricted
        </button>
        <p className="text-xs text-faint">
          Not claimable. This is a real token, not a faucet mock.
        </p>
      </div>
    );
  }

  const formattedBalance =
    balanceQuery.data !== undefined && decimals !== null
      ? formatUnits(balanceQuery.data as bigint, decimals)
      : null;

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-hairline pt-4">
      {/* Live balance */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-faint">Your balance</span>
        {!isConnected || !onSepolia ? (
          <span className="text-faint">
            {isConnected ? "Switch to Sepolia" : "Connect wallet"}
          </span>
        ) : balanceQuery.isLoading ? (
          <span className="h-4 w-20 animate-pulse rounded bg-white/10" />
        ) : balanceQuery.isError ? (
          <span className="text-faint">Unavailable</span>
        ) : (
          <span
            className="font-mono text-muted"
            title={formattedBalance ?? undefined}
          >
            {formattedBalance
              ? `${trimAmount(formattedBalance)} ${symbol}`
              : `0 ${symbol}`}
          </span>
        )}
      </div>

      {/* Action button (state-driven) */}
      <ClaimButton claim={claim} symbol={symbol} />

      {/* Feedback area */}
      {claim.phase === "mining" && claim.hash && (
        <TxLink hash={claim.hash} label="Transaction submitted. View on Etherscan" />
      )}
      {claim.phase === "success" && (
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-1.5 text-sm text-gold">
            <CheckIcon className="h-4 w-4" />
            Claimed 100 {symbol}. Balance updated.
          </p>
          {claim.hash && <TxLink hash={claim.hash} label="View on Etherscan" />}
        </div>
      )}
      {claim.phase === "error" && claim.error && (
        <p className="inline-flex items-start gap-1.5 text-sm text-danger">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{claim.error}</span>
        </p>
      )}

      {/* Soft nudge — a friendly hint only. Never blocks or throttles claiming. */}
      {isConnected &&
        onSepolia &&
        typeof balanceQuery.data === "bigint" &&
        balanceQuery.data > 0n &&
        formattedBalance && (
          <p className="text-xs text-faint">
            You already have {trimAmount(formattedBalance)} {symbol}. Try
            wrapping some before claiming more.
          </p>
        )}
    </div>
  );
}

function ClaimButton({
  claim,
  symbol,
}: {
  claim: ReturnType<typeof useFaucetClaim>;
  symbol: string;
}) {
  const base =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";

  if (claim.needsConnect) {
    return (
      <button
        type="button"
        onClick={claim.connect}
        className={`${base} cursor-pointer border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20`}
      >
        Connect wallet to claim
      </button>
    );
  }

  if (claim.needsSwitch) {
    return (
      <button
        type="button"
        onClick={claim.switchToSepolia}
        disabled={claim.busy}
        className={`${base} cursor-pointer border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {claim.busy ? (
          <>
            <SpinnerIcon className="h-4 w-4 animate-spin" />
            Switching…
          </>
        ) : (
          "Switch to Sepolia"
        )}
      </button>
    );
  }

  const label =
    claim.phase === "confirming"
      ? "Confirm in wallet…"
      : claim.phase === "mining"
        ? "Claiming…"
        : claim.phase === "success"
          ? "Claim again"
          : claim.phase === "error"
            ? "Try again"
            : `Claim ${FAUCET_CLAIM_UNITS} ${symbol}`;

  return (
    <button
      type="button"
      onClick={claim.claim}
      disabled={claim.busy}
      aria-busy={claim.busy}
      className={`${base} bg-gold text-void shadow-[0_10px_40px_-14px_rgba(255,210,8,0.6)] hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-80 ${
        claim.busy ? "cursor-wait" : "cursor-pointer"
      }`}
    >
      {claim.busy ? (
        <>
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          {label}
        </>
      ) : (
        <>
          <DropletIcon className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}

function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={sepoliaTxUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted underline-offset-2 transition-colors duration-200 hover:text-gold hover:underline"
    >
      {label}
      <ExternalLinkIcon className="h-3.5 w-3.5" />
    </a>
  );
}

/** Show a compact amount (up to 4 decimal places) without losing whole units. */
function trimAmount(value: string): string {
  if (!value.includes(".")) return value;
  const [whole, frac] = value.split(".");
  const short = frac.replace(/0+$/, "").slice(0, 4);
  return short.length ? `${whole}.${short}` : whole;
}
