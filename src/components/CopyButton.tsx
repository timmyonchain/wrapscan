"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CopyIcon, CheckIcon } from "./icons";

/** Copy-to-clipboard icon button with success feedback and an accessible label. */
export function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* give up silently */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }, [value]);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-hairline bg-white/[0.02] text-faint transition-colors duration-200 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-gold" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
}
