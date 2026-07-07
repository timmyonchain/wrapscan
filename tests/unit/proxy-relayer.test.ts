import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/relayer/[...path]/route";
import { zamaSepoliaConfig } from "@/lib/zamaConfig";

const UPSTREAM = zamaSepoliaConfig.relayerUrl; // https://relayer.testnet.zama.org/v2

function mockUpstream(body = "{}", status = 200) {
  const fetchMock = vi.fn(async () =>
    new Response(body, { status, headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("/api/relayer proxy (path mapping + forwarding)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("strips the leading chain-id segment and forwards to <relayerUrl>/<endpoint>", async () => {
    const fetchMock = mockUpstream();
    const req = new NextRequest("http://localhost/api/relayer/11155111/keyurl", { method: "GET" });
    await GET(req, { params: { path: ["11155111", "keyurl"] } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/keyurl`);
  });

  it("also works without a chain-id prefix", async () => {
    const fetchMock = mockUpstream();
    const req = new NextRequest("http://localhost/api/relayer/keyurl", { method: "GET" });
    await GET(req, { params: { path: ["keyurl"] } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/keyurl`);
  });

  it("forwards POST body + method to the input-proof endpoint and returns the upstream body", async () => {
    const upstreamBody = JSON.stringify({ status: "ok", proof: "0xdead" });
    const fetchMock = mockUpstream(upstreamBody);
    const req = new NextRequest("http://localhost/api/relayer/11155111/input-proof", {
      method: "POST",
      body: JSON.stringify({ ciphertext: "0x01" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: { path: ["11155111", "input-proof"] } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${UPSTREAM}/input-proof`);
    expect(init?.method).toBe("POST");
    expect(await res.text()).toBe(upstreamBody);
  });

  it("preserves the query string when forwarding", async () => {
    const fetchMock = mockUpstream();
    const req = new NextRequest("http://localhost/api/relayer/11155111/keyurl?v=2", { method: "GET" });
    await GET(req, { params: { path: ["11155111", "keyurl"] } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${UPSTREAM}/keyurl?v=2`);
  });

  it("returns 502 (not a hang) when the relayer is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const req = new NextRequest("http://localhost/api/relayer/11155111/keyurl", { method: "GET" });
    const res = await GET(req, { params: { path: ["11155111", "keyurl"] } });
    expect(res.status).toBe(502);
  });

  it("targets Zama's official testnet relayer (v2), sourced from the SDK chain config", () => {
    expect(UPSTREAM).toBe("https://relayer.testnet.zama.org/v2");
  });
});
