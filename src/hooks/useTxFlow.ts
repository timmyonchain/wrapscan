"use client";

import { useCallback, useState } from "react";
import { mapTxError } from "@/lib/faucet";

/**
 * Reusable multi-step action flow (wrap / unwrap / reveal). Same discipline as
 * the Phase 3 faucet fix: real pending only while the worker runs, an overall
 * timeout so nothing can hang forever, and specific mapped error messages.
 */
export type FlowPhase = "idle" | "pending" | "success" | "error";

export interface FlowStep {
  label: string;
  hash?: `0x${string}`;
}

export interface FlowHelpers {
  setLabel: (label: string) => void;
  addStep: (label: string, hash?: `0x${string}`) => void;
}

export interface TxFlow {
  phase: FlowPhase;
  label: string;
  steps: FlowStep[];
  error?: string;
  busy: boolean;
  run: (
    worker: (helpers: FlowHelpers) => Promise<void>,
    opts?: { startLabel?: string; timeoutMs?: number; timeoutMsg?: string },
  ) => Promise<void>;
  reset: () => void;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

export function useTxFlow(): TxFlow {
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [label, setLabel] = useState("");
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [error, setError] = useState<string | undefined>();

  const reset = useCallback(() => {
    setPhase("idle");
    setLabel("");
    setSteps([]);
    setError(undefined);
  }, []);

  const run = useCallback<TxFlow["run"]>(async (worker, opts) => {
    setPhase("pending");
    setError(undefined);
    setSteps([]);
    setLabel(opts?.startLabel ?? "Working…");
    const helpers: FlowHelpers = {
      setLabel,
      addStep: (l, hash) => setSteps((s) => [...s, { label: l, hash }]),
    };
    try {
      await withTimeout(
        worker(helpers),
        opts?.timeoutMs ?? 180_000,
        opts?.timeoutMsg ??
          "This took too long. Check your wallet and Etherscan, then try again.",
      );
      setPhase("success");
    } catch (e) {
      setPhase("error");
      setError(mapTxError(e));
    }
  }, []);

  return {
    phase,
    label,
    steps,
    error,
    busy: phase === "pending",
    run,
    reset,
  };
}
