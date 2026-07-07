import type { ReactNode } from "react";
import { DropletIcon, LockIcon, AlertIcon } from "./icons";

type Tone = "gold" | "muted" | "danger";

const toneClasses: Record<Tone, string> = {
  gold: "border-gold/30 bg-gold/10 text-gold",
  muted: "border-hairline bg-white/[0.03] text-muted",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

function Badge({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${toneClasses[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Claimable mock (public mint) vs restricted, plus a revoked marker. */
export function FaucetBadge({ faucetable }: { faucetable: boolean }) {
  return faucetable ? (
    <Badge tone="gold" icon={<DropletIcon className="h-3.5 w-3.5" />}>
      Faucet-able mock
    </Badge>
  ) : (
    <Badge tone="muted" icon={<LockIcon className="h-3.5 w-3.5" />}>
      Restricted
    </Badge>
  );
}

export function RevokedBadge() {
  return (
    <Badge tone="danger" icon={<AlertIcon className="h-3.5 w-3.5" />}>
      Revoked
    </Badge>
  );
}

/** Marks a pair injected from the local config (not the on-chain registry). */
export function CustomBadge() {
  return (
    <Badge tone="muted" icon={<AlertIcon className="h-3.5 w-3.5" />}>
      Custom (local)
    </Badge>
  );
}
