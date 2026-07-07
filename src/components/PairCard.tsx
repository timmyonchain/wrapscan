import {
  type RegistryPair,
  displaySymbol,
  displayName,
  displayDecimals,
} from "@/lib/registry";
import { AddressRow } from "./AddressRow";
import { FaucetBadge, RevokedBadge } from "./Badge";
import { FaucetPanel } from "./FaucetPanel";
import { ShieldIcon, ArrowRightIcon } from "./icons";

/** A single registry pair as a dark translucent glass card. */
export function PairCard({ pair }: { pair: RegistryPair }) {
  const erc20 = displaySymbol(pair.token);
  const conf = displaySymbol(pair.confidentialToken);

  return (
    <article
      className={`glass group relative flex flex-col gap-5 rounded-2xl p-5 transition-colors duration-200 hover:border-gold/25 sm:p-6 ${
        pair.isValid ? "" : "opacity-60"
      }`}
    >
      {/* Header: token identity + status badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-text" title={displayName(pair.token)}>
            {erc20}
          </h3>
          <p className="truncate text-sm text-muted" title={displayName(pair.token)}>
            {displayName(pair.token)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {pair.isValid ? (
            <FaucetBadge faucetable={pair.faucetable} />
          ) : (
            <RevokedBadge />
          )}
        </div>
      </div>

      {/* Wrap relationship: ERC-20 -> ERC-7984 */}
      <div className="flex items-center gap-3 rounded-xl border border-hairline bg-black/20 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-faint">
            Public ERC-20
          </div>
          <div className="truncate font-medium text-text">{erc20}</div>
        </div>
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-gold" />
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[11px] uppercase tracking-wide text-faint">
            Confidential ERC-7984
          </div>
          <div className="flex items-center justify-end gap-1.5 font-medium text-text">
            <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="truncate">{conf}</span>
          </div>
        </div>
      </div>

      {/* Facts */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-faint">Decimals</dt>
          <dd className="font-mono text-muted">{displayDecimals(pair.token)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-faint">Network</dt>
          <dd className="text-muted">{pair.network}</dd>
        </div>
      </dl>

      {/* Addresses */}
      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        <AddressRow label="ERC-20" address={pair.token.address} />
        <AddressRow label="ERC-7984" address={pair.confidentialToken.address} />
      </div>

      {/* Faucet action + live balance. Wrap/unwrap will join this slot later. */}
      {pair.isValid && <FaucetPanel pair={pair} />}
    </article>
  );
}
