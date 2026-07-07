import { CopyButton } from "./CopyButton";
import { ExternalLinkIcon } from "./icons";
import type { Address } from "@/lib/registry";

function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** One labelled address line: mono address + copy + Etherscan link. */
export function AddressRow({
  label,
  address,
}: {
  label: string;
  address: Address;
}) {
  const explorer = `https://sepolia.etherscan.io/address/${address}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-faint">
          {label}
        </div>
        <div className="truncate font-mono text-[13px] text-muted" title={address}>
          {shorten(address)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CopyButton value={address} label={`${label} address`} />
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${label} on Sepolia Etherscan`}
          title="View on Sepolia Etherscan"
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-hairline bg-white/[0.02] text-faint transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
