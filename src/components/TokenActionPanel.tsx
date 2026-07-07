"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import {
  type RegistryPair,
  displaySymbol,
  displayName,
} from "@/lib/registry";
import { parseAmount, trimAmount } from "@/lib/amounts";
import { ERC20_BALANCE_ABI, sepoliaTxUrl } from "@/lib/faucet";
import { useZamaToken } from "@/hooks/useZamaToken";
import { useTxFlow, type TxFlow } from "@/hooks/useTxFlow";
import {
  XIcon,
  ShieldIcon,
  ArrowRightIcon,
  EyeIcon,
  SpinnerIcon,
  CheckIcon,
  AlertIcon,
  ExternalLinkIcon,
} from "./icons";

export function TokenActionPanel({
  pair,
  titleId,
  onClose,
}: {
  pair: RegistryPair;
  titleId: string;
  onClose: () => void;
}) {
  const erc20Symbol = displaySymbol(pair.token);
  const confSymbol = displaySymbol(pair.confidentialToken);
  // Public balance + wrap use the UNDERLYING decimals; the confidential balance
  // + unwrap use the CONFIDENTIAL token's own decimals (the wrapper applies a
  // rate, so these commonly differ, e.g. WETH 18 -> cWETH 6).
  const decimals = pair.token.decimals;
  const confDecimals = pair.confidentialToken.decimals;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const { ensureReady, initState } = useZamaToken(pair.confidentialToken.address);

  // Public ERC-20 balance (live).
  const publicBal = useReadContract({
    address: pair.token.address,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: isConnected && onSepolia && !!address,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });
  const publicBalance =
    publicBal.data !== undefined ? (publicBal.data as bigint) : undefined;

  // Confidential balance is decrypted on demand.
  const [revealed, setRevealed] = useState<bigint | undefined>();
  const [balanceStale, setBalanceStale] = useState(false);

  const revealFlow = useTxFlow();
  const wrapFlow = useTxFlow();
  const unwrapFlow = useTxFlow();
  const anyBusy =
    revealFlow.busy || wrapFlow.busy || unwrapFlow.busy || initState === "warming";

  const [wrapInput, setWrapInput] = useState("");
  const [unwrapInput, setUnwrapInput] = useState("");

  const refreshBalances = useCallback(async () => {
    await publicBal.refetch();
    setRevealed(undefined);
    setBalanceStale(true);
  }, [publicBal]);

  // ---- reveal ----
  const onReveal = () =>
    revealFlow.run(
      async ({ setLabel }) => {
        if (!address) throw new Error("Connect your wallet first.");
        setLabel("Preparing confidential engine…");
        const wrapped = await ensureReady();
        setLabel("Revealing balance. Sign the request in your wallet…");
        const clear = await wrapped.balanceOf(address);
        setRevealed(clear);
        setBalanceStale(false);
      },
      { startLabel: "Preparing…", timeoutMs: 120_000 },
    );

  // ---- wrap ----
  const wrapAmount =
    decimals !== null ? parseAmount(wrapInput, decimals) : null;
  const wrapError =
    wrapAmount !== null &&
    publicBalance !== undefined &&
    wrapAmount > publicBalance
      ? "More than your balance."
      : undefined;
  const canWrap =
    isConnected &&
    onSepolia &&
    decimals !== null &&
    wrapAmount !== null &&
    wrapAmount > 0n &&
    !wrapError &&
    !anyBusy;

  const onWrap = () =>
    wrapFlow.run(
      async ({ setLabel, addStep }) => {
        if (!address || wrapAmount === null) throw new Error("Enter an amount.");
        setLabel("Preparing confidential engine…");
        const wrapped = await ensureReady();
        setLabel("Encrypting amount…");
        await wrapped.shield(wrapAmount, {
          onApprovalSubmitted: (h) => {
            addStep("Approve", h);
            setLabel(
              "Step 1 of 2 submitted (approve). Confirm step 2 (wrap) in your wallet…",
            );
          },
          onShieldSubmitted: (h) => {
            addStep("Wrap", h);
            setLabel("Wrapping on-chain…");
          },
        });
        setWrapInput("");
        await refreshBalances();
      },
      {
        startLabel:
          "Preparing wrap. You may see two prompts: approve, then wrap.",
        timeoutMs: 240_000,
      },
    );

  // ---- unwrap ---- (confidential decimals, not the underlying's)
  const unwrapAmount =
    confDecimals !== null ? parseAmount(unwrapInput, confDecimals) : null;
  const unwrapError =
    unwrapAmount !== null && revealed !== undefined && unwrapAmount > revealed
      ? "More than your confidential balance."
      : undefined;
  const canUnwrap =
    isConnected &&
    onSepolia &&
    decimals !== null &&
    revealed !== undefined &&
    unwrapAmount !== null &&
    unwrapAmount > 0n &&
    !unwrapError &&
    !anyBusy;

  const onUnwrap = () =>
    unwrapFlow.run(
      async ({ setLabel, addStep }) => {
        if (!address || unwrapAmount === null) throw new Error("Enter an amount.");
        setLabel("Preparing confidential engine…");
        const wrapped = await ensureReady();

        let submitted = false;
        const callbacks = {
          onUnwrapSubmitted: (h: `0x${string}`) => {
            submitted = true;
            addStep("Unwrap request", h);
            setLabel("Unwrap requested. Finalizing…");
          },
          onFinalizing: () => setLabel("Finalizing unwrap…"),
          onFinalizeSubmitted: (h: `0x${string}`) => {
            addStep("Finalize", h);
            setLabel("Finalizing on-chain…");
          },
        };

        const isFull = revealed !== undefined && unwrapAmount === revealed;
        if (isFull) {
          // Full balance: uses the on-chain encrypted balance handle directly —
          // NO client-side encryption / relayer input-proof, so no 30s cap.
          setLabel("Unwrapping your full balance. Confirm in your wallet…");
          await wrapped.unshieldAll(callbacks);
        } else {
          // Partial: must encrypt the amount (relayer input-proof, ~10-25s).
          // That can occasionally exceed the SDK's hard 30s encrypt timeout, so
          // retry a couple of times — it usually lands on a faster response.
          const MAX = 3;
          for (let attempt = 1; ; attempt++) {
            try {
              setLabel(
                attempt === 1
                  ? "Preparing secure unwrap. Encrypting the amount, this can take up to ~25s…"
                  : `The confidential engine was slow. Retrying (attempt ${attempt} of ${MAX})…`,
              );
              await wrapped.unshield(unwrapAmount, {
                skipBalanceCheck: true,
                ...callbacks,
              });
              break;
            } catch (e) {
              const msg = String(
                (e as { message?: unknown })?.message ?? e,
              ).toLowerCase();
              const retriable =
                !submitted &&
                attempt < MAX &&
                (msg.includes("timed out") ||
                  msg.includes("timeout") ||
                  msg.includes("encrypt"));
              if (!retriable) throw e;
            }
          }
        }

        setUnwrapInput("");
        await refreshBalances();
      },
      { startLabel: "Preparing unwrap…", timeoutMs: 300_000 },
    );

  const setWrapMax = () => {
    if (publicBalance !== undefined && decimals !== null)
      setWrapInput(formatUnits(publicBalance, decimals));
  };
  const setUnwrapMax = () => {
    if (revealed !== undefined && confDecimals !== null)
      setUnwrapInput(formatUnits(revealed, confDecimals));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold text-text">
            {erc20Symbol}
          </h2>
          <p className="truncate text-sm text-muted">
            {displayName(pair.token)} · {pair.network}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-hairline text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Gate */}
      {!isConnected ? (
        <GateCard
          message="Connect your wallet to see balances and wrap or unwrap."
          actionLabel="Connect wallet"
          onAction={() => openConnectModal?.()}
        />
      ) : !onSepolia ? (
        <GateCard
          message="You're on the wrong network."
          actionLabel={switching ? "Switching…" : "Switch to Sepolia"}
          onAction={() => void switchChainAsync({ chainId: sepolia.id })}
          disabled={switching}
        />
      ) : decimals === null || confDecimals === null ? (
        <GateCard message="This token has unsupported metadata, so amounts can't be computed safely." />
      ) : (
        <>
          {/* Balances */}
          <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-black/20 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-faint">Public {erc20Symbol}</span>
              {publicBal.isLoading ? (
                <span className="h-4 w-24 animate-pulse rounded bg-white/10" />
              ) : (
                <span className="font-mono text-text">
                  {publicBalance !== undefined
                    ? `${trimAmount(formatUnits(publicBalance, decimals))} ${erc20Symbol}`
                    : `0 ${erc20Symbol}`}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-faint">
                <ShieldIcon className="h-3.5 w-3.5 text-gold" />
                Confidential {confSymbol}
              </span>
              {revealed !== undefined && confDecimals !== null ? (
                <span className="font-mono text-text">
                  {trimAmount(formatUnits(revealed, confDecimals))} {confSymbol}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onReveal}
                  disabled={anyBusy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  {revealFlow.busy ? (
                    <>
                      <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                      Revealing…
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-3.5 w-3.5" />
                      •••• Reveal
                    </>
                  )}
                </button>
              )}
            </div>
            {revealFlow.busy && revealFlow.label && (
              <StatusLine>{revealFlow.label}</StatusLine>
            )}
            {revealFlow.phase === "error" && revealFlow.error && (
              <ErrorLine>{revealFlow.error}</ErrorLine>
            )}
            {balanceStale && revealed === undefined && (
              <p className="text-xs text-faint">
                Your confidential balance changed. Reveal again to see the new
                amount.
              </p>
            )}
          </section>

          {/* Wrap */}
          <ActionSection
            title="Wrap"
            subtitle={`Turn public ${erc20Symbol} into confidential ${confSymbol}.`}
            direction={`${erc20Symbol} → ${confSymbol}`}
          >
            <AmountField
              value={wrapInput}
              onChange={setWrapInput}
              onMax={setWrapMax}
              suffix={erc20Symbol}
              disabled={anyBusy}
              error={wrapError}
            />
            <ActionButton
              onClick={onWrap}
              disabled={!canWrap}
              busy={wrapFlow.busy}
              idleLabel={`Wrap ${erc20Symbol}`}
              busyLabel="Wrapping…"
            />
            <FlowFeedback flow={wrapFlow} successText={`Wrapped into ${confSymbol}.`} />
          </ActionSection>

          {/* Unwrap */}
          <ActionSection
            title="Unwrap"
            subtitle={`Turn confidential ${confSymbol} back into public ${erc20Symbol}.`}
            direction={`${confSymbol} → ${erc20Symbol}`}
          >
            {revealed === undefined ? (
              <p className="text-sm text-muted">
                Reveal your confidential balance first to unwrap.{" "}
                <button
                  type="button"
                  onClick={onReveal}
                  disabled={anyBusy}
                  className="cursor-pointer font-medium text-gold underline-offset-2 hover:underline disabled:opacity-70"
                >
                  Reveal now
                </button>
              </p>
            ) : (
              <>
                <AmountField
                  value={unwrapInput}
                  onChange={setUnwrapInput}
                  onMax={setUnwrapMax}
                  suffix={confSymbol}
                  disabled={anyBusy}
                  error={unwrapError}
                />
                <ActionButton
                  onClick={onUnwrap}
                  disabled={!canUnwrap}
                  busy={unwrapFlow.busy}
                  idleLabel={`Unwrap ${confSymbol}`}
                  busyLabel="Unwrapping…"
                />
                <p className="text-xs text-faint">
                  Tip: unwrapping your full balance (Max) is fastest. It skips
                  the encryption step.
                </p>
              </>
            )}
            <FlowFeedback
              flow={unwrapFlow}
              successText={`Unwrapped to public ${erc20Symbol}.`}
            />
          </ActionSection>
        </>
      )}
    </div>
  );
}

function GateCard({
  message,
  actionLabel,
  onAction,
  disabled,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-black/20 p-4">
      <p className="text-sm text-muted">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ActionSection({
  title,
  subtitle,
  direction,
  children,
}: {
  title: string;
  subtitle: string;
  direction: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] text-faint">
          {direction}
          <ArrowRightIcon className="h-3 w-3 text-gold" />
        </span>
      </div>
      {children}
    </section>
  );
}

function AmountField({
  value,
  onChange,
  onMax,
  suffix,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
  suffix: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-black/20 px-3 py-2.5 transition-colors ${
          error ? "border-danger/50" : "border-hairline focus-within:border-gold/40"
        }`}
      >
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className="min-w-0 flex-1 bg-transparent font-mono text-text outline-none placeholder:text-faint disabled:opacity-60"
        />
        <span className="shrink-0 text-sm text-faint">{suffix}</span>
        <button
          type="button"
          onClick={onMax}
          disabled={disabled}
          className="shrink-0 cursor-pointer rounded-md border border-hairline px-2 py-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          Max
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  busy,
  idleLabel,
  busyLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-void shadow-[0_10px_40px_-14px_rgba(255,210,8,0.6)] transition-colors duration-200 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
        busy ? "cursor-wait" : "cursor-pointer"
      }`}
    >
      {busy ? (
        <>
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          {busyLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function FlowFeedback({ flow, successText }: { flow: TxFlow; successText: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {flow.busy && flow.label && <StatusLine>{flow.label}</StatusLine>}
      {flow.steps.map((s, i) =>
        s.hash ? (
          <a
            key={`${s.hash}-${i}`}
            href={sepoliaTxUrl(s.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted underline-offset-2 transition-colors duration-200 hover:text-gold hover:underline"
          >
            {s.label} submitted. View on Etherscan
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        ) : null,
      )}
      {flow.phase === "success" && (
        <p className="inline-flex items-center gap-1.5 text-sm text-gold">
          <CheckIcon className="h-4 w-4" />
          {successText}
        </p>
      )}
      {flow.phase === "error" && flow.error && <ErrorLine>{flow.error}</ErrorLine>}
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-muted">
      <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
      {children}
    </p>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="inline-flex items-start gap-1.5 text-sm text-danger">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
