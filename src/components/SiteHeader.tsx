"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ShieldIcon } from "./icons";

/** Network pill: subtle when on Sepolia, danger when on the wrong chain. */
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
        className={`h-1.5 w-1.5 rounded-full ${onSepolia ? "bg-gold" : "bg-danger"}`}
      />
      {onSepolia ? "Sepolia" : "Wrong network"}
    </span>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-hairline bg-void/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
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
          <Link
            href="/decrypt"
            className="glow-btn hidden items-center gap-1.5 sm:inline-flex"
          >
            Decrypt any token
          </Link>
          <Link
            href="/spike"
            className="glow-btn hidden items-center gap-1.5 md:inline-flex"
          >
            Live decrypt demo
          </Link>
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
