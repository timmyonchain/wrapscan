"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// WebGL background — client-only (dynamic import, no SSR) so it never breaks the build.
const Beams = dynamic(() => import("./Beams"), { ssr: false });

/**
 * Fixed, full-viewport gold Beams layer that sits BEHIND all content.
 * - pointer-events: none so it never intercepts clicks/scroll.
 * - Fewer beams on small viewports to keep it light.
 * - Respects prefers-reduced-motion: renders a static warm gradient instead of
 *   the animated WebGL canvas.
 */
export function BeamsBackground() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 768px)");
    const sync = () => {
      setReducedMotion(motion.matches);
      setIsMobile(mobile.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void"
    >
      {/* Static fallback: warm near-black with a faint gold glow. Always painted
          so there's no flash before the canvas mounts, and it is the full
          experience when reduced motion is requested. */}
      <div className="absolute inset-0 bg-void" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(255,210,8,0.10), transparent 70%)",
        }}
      />
      {mounted && !reducedMotion && (
        <div className="absolute inset-0">
          <Beams
            beamWidth={2}
            beamHeight={15}
            beamNumber={isMobile ? 7 : 12}
            lightColor="#FFD208"
            speed={2}
            noiseIntensity={1.75}
            scale={0.2}
            rotation={0}
          />
        </div>
      )}
      {/* Bottom vignette so cards near the fold stay legible over bright beams. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(to top, rgba(11,10,8,0.85), transparent)",
        }}
      />
    </div>
  );
}
