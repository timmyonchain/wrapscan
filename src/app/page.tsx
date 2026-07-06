"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import Link from "next/link";

export default function Home() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Zama · Season 3 Bounty Track · Sepolia
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">Wrapscan</h1>
        <p className="max-w-xl text-neutral-400">
          Explorer for Zama&apos;s Confidential Token Wrappers Registry. This is
          the Phase&nbsp;0 skeleton: wallet connection and locked-down onchain
          ground truth.
        </p>
      </header>

      <section className="flex flex-col items-start gap-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-6">
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
        <div className="font-mono text-sm text-neutral-400">
          {isConnected ? (
            <div className="flex flex-col gap-1">
              <span>Connected: {address}</span>
              <span className={onSepolia ? "text-emerald-400" : "text-amber-400"}>
                Network:{" "}
                {onSepolia
                  ? "Ethereum Sepolia (11155111) ✓"
                  : `Wrong network (${chainId}) — switch to Sepolia`}
              </span>
            </div>
          ) : (
            <span>Not connected — connect a wallet to Sepolia.</span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-neutral-300">Ground truth (dev)</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/config"
            className="rounded-md border border-neutral-800 px-3 py-2 font-mono text-neutral-300 hover:border-neutral-600"
          >
            → Resolved Zama Sepolia config
          </Link>
          <Link
            href="/api/registry"
            className="rounded-md border border-neutral-800 px-3 py-2 font-mono text-neutral-300 hover:border-neutral-600"
          >
            → Registry ground-truth JSON
          </Link>
        </div>
      </section>
    </main>
  );
}
