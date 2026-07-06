import type { NextRequest } from "next/server";
import { getSepoliaRpcUrl } from "@/lib/zamaConfig";

/**
 * Same-origin JSON-RPC proxy for Sepolia.
 *
 * The browser (wagmi/viem client + the SDK's per-chain `network` transport)
 * points here instead of at the raw provider URL, so the Alchemy key lives
 * ONLY in the server-only `SEPOLIA_RPC_URL` env var and never ships to the
 * browser bundle. This route forwards the JSON-RPC POST body upstream
 * server-side and returns the response verbatim.
 *
 * The headless spike and /api/registry use the upstream directly (server-side),
 * so they don't go through this route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const upstream = getSepoliaRpcUrl(); // server-only SEPOLIA_RPC_URL
  const body = Buffer.from(await req.arrayBuffer());

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (err) {
    console.error("[rpc-proxy] upstream unreachable:", err);
    return new Response(
      JSON.stringify({ error: "rpc_proxy_upstream_unreachable" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const respBody = await res.arrayBuffer();
  if (!res.ok) {
    console.error(
      `[rpc-proxy] upstream ${res.status}: ${new TextDecoder()
        .decode(respBody)
        .slice(0, 200)}`,
    );
  }
  return new Response(respBody, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
