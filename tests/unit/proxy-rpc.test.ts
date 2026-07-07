import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/rpc/route";

// A fake Alchemy URL with a secret path segment; the proxy must never leak it.
const FAKE_KEY = "SECRETKEY_do_not_leak_123";
const FAKE_RPC = `https://eth-sepolia.g.alchemy.com/v2/${FAKE_KEY}`;

describe("/api/rpc proxy", () => {
  beforeEach(() => {
    process.env.SEPOLIA_RPC_URL = FAKE_RPC;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET health reveals only the upstream host, never the API key", async () => {
    const res = GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.upstreamHost).toBe("eth-sepolia.g.alchemy.com");
    expect(body.hasApiKeyPath).toBe(true);
    // hard assertion: the secret key must NOT appear anywhere in the response
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
  });

  it("POST forwards the JSON-RPC body to SEPOLIA_RPC_URL and returns the upstream result", async () => {
    const upstreamBody = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" });
    const fetchMock = vi.fn(async () =>
      new Response(upstreamBody, { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const reqBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
    const req = new NextRequest("http://localhost/api/rpc", {
      method: "POST",
      body: reqBody,
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);

    // forwarded to the real upstream (with the key), server-side only
    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(FAKE_RPC);
    expect(init?.method).toBe("POST");
    // response body is the upstream body verbatim
    expect(await res.text()).toBe(upstreamBody);
    expect(res.status).toBe(200);
  });

  it("returns 502 (not a hang) when the upstream is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const req = new NextRequest("http://localhost/api/rpc", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toContain(FAKE_KEY);
  });
});
