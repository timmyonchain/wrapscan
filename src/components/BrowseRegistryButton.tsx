"use client";

import { useCallback } from "react";
import { ArrowRightIcon } from "./icons";

/** Gold primary CTA that smooth-scrolls to the registry section. */
export function BrowseRegistryButton() {
  const onClick = useCallback(() => {
    const el = document.getElementById("registry");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-void shadow-[0_10px_40px_-12px_rgba(255,210,8,0.6)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
    >
      Browse the registry
      <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </button>
  );
}
