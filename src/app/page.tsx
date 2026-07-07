import { SiteHeader } from "@/components/SiteHeader";
import { RegistryBrowser } from "@/components/RegistryBrowser";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <SiteHeader />
      <main>
        <RegistryBrowser />
      </main>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:px-6">
          <p>
            Wrapscan · Zama confidential wrapper registry · Sepolia testnet
          </p>
          <nav className="flex items-center gap-5">
            <a
              className="cursor-pointer transition-colors duration-200 hover:text-gold"
              href="/spike"
            >
              Decryption spike
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
