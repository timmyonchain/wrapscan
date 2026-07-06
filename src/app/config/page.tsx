import Link from "next/link";
import { resolvedZamaSepoliaValues } from "@/lib/zamaConfig";

export const metadata = {
  title: "Resolved Zama Sepolia config — Wrapscan",
};

export default function ConfigPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-mono text-sm text-neutral-500 hover:text-neutral-300">
          ← back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Resolved Zama Sepolia config
        </h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Every value below is resolved from the official SDK&apos;s own exported
          chain config. Nothing is hardcoded from memory or third-party
          tutorials.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {resolvedZamaSepoliaValues.map((row) => (
              <tr key={row.key} className="border-b border-neutral-900">
                <td className="px-4 py-3 text-neutral-300">{row.key}</td>
                <td className="px-4 py-3 break-all text-emerald-400">
                  {String(row.value)}
                </td>
                <td className="px-4 py-3 text-neutral-500">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
