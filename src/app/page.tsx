import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { RegistryBrowser } from "@/components/RegistryBrowser";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <SiteHeader />

      <main>
        <Hero />

        {/* Registry section — CTA in the hero smooth-scrolls here.
            scroll-mt clears the fixed header. */}
        <div id="registry" className="scroll-mt-16">
          <RegistryBrowser />
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:px-6">
          <p>Wrapscan · Zama confidential wrapper registry · Sepolia testnet</p>
          <nav className="flex items-center gap-5">
            <a
              className="cursor-pointer transition-colors duration-200 hover:text-gold"
              href="/spike"
            >
              Live decrypt demo
            </a>
            <a
              className="cursor-pointer transition-colors duration-200 hover:text-gold"
              href="/config"
            >
              Zama config
            </a>
            <a
              className="cursor-pointer transition-colors duration-200 hover:text-gold"
              href="/api/registry"
            >
              Registry JSON
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
