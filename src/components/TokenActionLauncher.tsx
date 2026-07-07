"use client";

import { useId, useState } from "react";
import type { RegistryPair } from "@/lib/registry";
import { Modal } from "./Modal";
import { TokenActionPanel } from "./TokenActionPanel";
import { ArrowRightIcon } from "./icons";

/**
 * "Manage" affordance on a card. Opens an independent, focused modal panel for
 * this pair (wrap / unwrap / reveal). Each card owns its own launcher, so panels
 * operate independently.
 */
export function TokenActionLauncher({ pair }: { pair: RegistryPair }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 text-sm font-semibold text-text transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        Wrap, unwrap or reveal
        <ArrowRightIcon className="h-4 w-4 text-gold transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledById={titleId}>
        <TokenActionPanel
          pair={pair}
          titleId={titleId}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
