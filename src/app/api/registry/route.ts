import { NextResponse } from "next/server";
import { enumerateRegistry } from "@/lib/enumerateRegistry";

// Live onchain read; never cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Onchain enumeration + metadata reads can take a while.
export const maxDuration = 60;

/**
 * Dev/inspection route: enumerates the Wrappers Registry live via our Sepolia
 * RPC and returns the ground-truth JSON. Read-only public chain data.
 */
export async function GET() {
  try {
    const data = await enumerateRegistry();
    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "registry_enumeration_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
