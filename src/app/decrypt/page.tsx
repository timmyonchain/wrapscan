import { SiteHeader } from "@/components/SiteHeader";
import { DecryptAnyTool } from "@/components/DecryptAnyTool";

export const metadata = {
  title: "Decrypt any ERC-7984 · Wrapscan",
  description:
    "Decrypt your balance of any ERC-7984 confidential token on Sepolia, including tokens outside the official registry.",
};

export default function DecryptPage() {
  return (
    <div className="relative min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-content px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Confidential decryption
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            Decrypt any ERC-7984
          </h1>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted">
            Reveal your own balance of any confidential token, in the registry
            or not, with a real EIP-712 signature and the Zama relayer.
          </p>
        </div>
        <DecryptAnyTool />
      </main>
    </div>
  );
}
