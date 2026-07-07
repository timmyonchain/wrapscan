"use client";

import { useEffect, useState } from "react";
import {
  resolveRegistry,
  partitionByValidity,
  type RegistrySnapshot,
} from "@/lib/registry";
import { PairCard } from "./PairCard";
import { PairCardSkeleton } from "./PairCardSkeleton";
import { AlertIcon } from "./icons";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: RegistrySnapshot };

export function RegistryBrowser() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState({ status: "loading" });
    resolveRegistry(ac.signal)
      .then((snapshot) => setState({ status: "ready", snapshot }))
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => ac.abort();
  }, [reloadKey]);

  if (state.status === "loading") {
    return (
      <Section
        eyebrow="Live from the on-chain registry"
        title="Confidential token wrappers"
        subtitle="Reading every registered pair from the Wrappers Registry on Sepolia…"
      >
        <CardGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <PairCardSkeleton key={i} />
          ))}
        </CardGrid>
      </Section>
    );
  }

  if (state.status === "error") {
    return (
      <Section
        eyebrow="Live from the on-chain registry"
        title="Confidential token wrappers"
      >
        <div className="glass mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
            <AlertIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-medium text-text">
              Couldn&apos;t read the registry
            </p>
            <p className="mt-1 break-words text-sm text-muted">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors duration-200 hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Try again
          </button>
        </div>
      </Section>
    );
  }

  const { active, revoked } = partitionByValidity(state.snapshot.pairs);
  const faucetCount = active.filter((p) => p.faucetable).length;
  const restrictedCount = active.length - faucetCount;

  return (
    <Section
      eyebrow="Live from the on-chain registry"
      title="Confidential token wrappers"
      subtitle={`${active.length} active ${
        active.length === 1 ? "pair" : "pairs"
      } on Sepolia · ${faucetCount} faucet-able mock${
        faucetCount === 1 ? "" : "s"
      } · ${restrictedCount} restricted · ${revoked.length} revoked`}
    >
      {active.length === 0 ? (
        <div className="glass mx-auto max-w-xl rounded-2xl p-8 text-center text-muted">
          No active wrappers are currently registered.
        </div>
      ) : (
        <CardGrid>
          {active.map((pair) => (
            <PairCard key={`${pair.index}-${pair.confidentialToken.address}`} pair={pair} />
          ))}
        </CardGrid>
      )}

      {revoked.length > 0 ? (
        <div className="mt-14">
          <h3 className="text-sm font-medium uppercase tracking-wide text-faint">
            Revoked ({revoked.length})
          </h3>
          <p className="mb-5 mt-1 max-w-2xl text-sm text-muted">
            These pairs are recorded in the on-chain registry but flagged
            invalid (superseded or de-registered). Shown for transparency and
            dimmed. No faucet, wrap or unwrap actions are offered on them.
          </p>
          <CardGrid>
            {revoked.map((pair) => (
              <PairCard
                key={`${pair.index}-${pair.confidentialToken.address}`}
                pair={pair}
              />
            ))}
          </CardGrid>
        </div>
      ) : (
        <p className="mt-10 text-sm text-faint">
          The registry currently reports no revoked entries. Any that appear
          will be listed here, clearly marked and read-only.
        </p>
      )}
    </Section>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-content px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <div className="mb-8 max-w-2xl sm:mb-10">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
          {eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
