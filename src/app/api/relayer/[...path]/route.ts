import type { NextRequest } from "next/server";
import { zamaSepoliaConfig, SEPOLIA_CHAIN_ID } from "@/lib/zamaConfig";

/**
 * Same-origin relayer proxy (fixes the browser CORS failure).
 *
 * The browser `web()` relayer cannot call Zama's relayer directly
 * (https://relayer.testnet.zama.org/v2) — the cross-origin public-key fetch is
 * blocked by CORS ("Impossible to fetch public key: wrong relayer url"). Per
 * docs.zama.org, the browser must point `relayerUrl` at a SAME-ORIGIN proxy on
 * our own app that forwards to the Zama relayer server-side.
 *
 * The relayer-sdk composes upstream URLs as `${relayerUrl}/<endpoint>` where
 * <endpoint> ∈ { keyurl (GET), input-proof, public-decrypt, user-decrypt,
 * delegated-user-decrypt (POST) } — confirmed from
 * @zama-fhe/relayer-sdk@0.4.4 lib/internal.js (AbstractRelayerProvider).
 *
 * Browser relayerUrl = `${origin}/api/relayer/11155111`. So the SDK requests
 * `/api/relayer/11155111/keyurl`; this handler strips the leading chain-id
 * segment and forwards to `${zamaSepoliaConfig.relayerUrl}/keyurl` — i.e.
 * `https://relayer.testnet.zama.org/v2/keyurl`, the exact URL the working
 * node() relayer hits. The upstream base is sourced from
 * `src/lib/zamaConfig.ts` (from @zama-fhe/sdk ./chains) — never hardcoded.
 */

// Node runtime so upstream fetch behaves like the node() relayer; never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The /input-proof (ZK proof verification) call is the slow relayer op — much
// slower than keyurl/user-decrypt. Give the proxy room so it doesn't time out
// mid-encrypt (which surfaced to the browser as "Encryption failed").
export const maxDuration = 60;

// Headers we must not forward verbatim to the upstream.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "expect",
  "accept-encoding", // let upstream return identity; we re-buffer the body
  "cookie",
  "origin",
  "referer",
]);

function resolveUpstreamUrl(pathSegments: string[], search: string): string {
  let segs = [...pathSegments];
  // Optional leading chain-id segment, e.g. /api/relayer/11155111/keyurl
  if (segs[0] === String(SEPOLIA_CHAIN_ID)) segs = segs.slice(1);
  const base = zamaSepoliaConfig.relayerUrl.replace(/\/+$/, ""); // .../v2
  return `${base}/${segs.join("/")}${search}`;
}

async function proxy(
  req: NextRequest,
  pathSegments: string[],
): Promise<Response> {
  const upstream = resolveUpstreamUrl(pathSegments, req.nextUrl.search ?? "");

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : Buffer.from(await req.arrayBuffer());

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (err) {
    console.error(
      `[relayer-proxy] upstream unreachable ${method} ${upstream}:`,
      err,
    );
    return new Response(
      JSON.stringify({
        error: "relayer_proxy_upstream_unreachable",
        upstream,
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const respBody = await upstreamRes.arrayBuffer();
  if (!upstreamRes.ok) {
    const preview = new TextDecoder().decode(respBody).slice(0, 300);
    console.error(
      `[relayer-proxy] upstream ${upstreamRes.status} ${method} ${upstream}: ${preview}`,
    );
  }

  const respHeaders = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) respHeaders.set("content-type", contentType);
  respHeaders.set("cache-control", "no-store");

  return new Response(respBody, {
    status: upstreamRes.status,
    headers: respHeaders,
  });
}

// Next.js 14 route handlers receive sync `params`.
type Ctx = { params: { path: string[] } };

export function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
