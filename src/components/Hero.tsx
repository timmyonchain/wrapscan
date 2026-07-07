import { BrowseRegistryButton } from "./BrowseRegistryButton";
import { ScrollCue } from "./ScrollCue";
import { ShieldIcon } from "./icons";

/**
 * Full-bleed hero — the first screen. Sits over the fixed gold Beams. One
 * deliberate entrance (staggered rise), generous type scale, no clutter.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 pb-24 pt-24 text-center sm:px-6">
      {/* Dark halo purely for text legibility over bright beams. */}
      <div aria-hidden className="hero-scrim pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        {/* Brand lockup */}
        <div
          className="rise-in mb-7 flex items-center gap-2.5"
          style={{ animationDelay: "0ms" }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <ShieldIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-text">
            Wrapscan
          </span>
        </div>

        {/* Eyebrow */}
        <p
          className="rise-in mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold"
          style={{ animationDelay: "80ms" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Live on Sepolia · read on-chain
        </p>

        {/* Headline */}
        <h1
          className="rise-in text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-text sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "150ms" }}
        >
          The home for Zama&apos;s confidential wrapper registry.
        </h1>

        {/* Subhead */}
        <p
          className="rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted sm:text-xl"
          style={{ animationDelay: "240ms" }}
        >
          Browse, wrap, unwrap, and decrypt confidential ERC-7984 tokens on
          Sepolia. Every wrapper, read live from chain.
        </p>

        {/* CTAs */}
        <div
          className="rise-in mt-9 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: "330ms" }}
        >
          <BrowseRegistryButton />
          <a
            href="/spike"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-white/[0.02] px-5 py-3 text-sm font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Live decrypt demo
          </a>
        </div>
      </div>

      <ScrollCue />
    </section>
  );
}
