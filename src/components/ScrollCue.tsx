/** Subtle "scroll" affordance at the bottom of the hero. */
export function ScrollCue() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-faint">
      <span className="text-[11px] uppercase tracking-[0.2em]">Scroll</span>
      <span className="cue-bob">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}
