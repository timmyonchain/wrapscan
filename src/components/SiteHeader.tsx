"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ShieldIcon } from "./icons";

/** Network pill: green-ish when on Sepolia, gold warning otherwise. */
function NetworkIndicator() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  if (!isConnected) return null;
  const onSepolia = chainId === sepolia.id;
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
        onSepolia
          ? "border-hairline bg-white/[0.03] text-muted"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          onSepolia ? "bg-gold" : "bg-danger"
        }`}
      />
      {onSepolia ? "Sepolia" : "Wrong network"}
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-void/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-text">
            Wrapscan
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <NetworkIndicator />
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="none"
          />
        </div>
      </div>
    </header>
  );
}
