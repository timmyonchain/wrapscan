/** Loading placeholder that reserves the same space as a real PairCard. */
export function PairCardSkeleton() {
  return (
    <div className="glass flex animate-pulse flex-col gap-5 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-2">
          <div className="h-5 w-24 rounded bg-white/10" />
          <div className="h-4 w-40 rounded bg-white/[0.06]" />
        </div>
        <div className="h-6 w-28 rounded-full bg-white/[0.06]" />
      </div>
      <div className="h-16 rounded-xl border border-hairline bg-black/20" />
      <div className="flex gap-6">
        <div className="h-4 w-20 rounded bg-white/[0.06]" />
        <div className="h-4 w-20 rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-3 border-t border-hairline pt-4">
        <div className="h-8 rounded bg-white/[0.04]" />
        <div className="h-8 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}
