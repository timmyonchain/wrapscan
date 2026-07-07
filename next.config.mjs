/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cross-origin isolation so the FHE WASM worker can use SharedArrayBuffer and
  // run multi-threaded. Without threads, the single-threaded ZK-proof generation
  // for the unwrap "encrypt" step exceeds the SDK's hard 30s worker timeout
  // ("Request ENCRYPT timed out after 30000ms").
  //
  // COEP: credentialless (not require-corp) so the cross-origin public resources
  // the SDK loads still work: cdn.zama.org (sends CORP: cross-origin) and the S3
  // key/CRS blobs (send ACAO: *). Same-origin proxies (/api/relayer, /api/rpc)
  // are unaffected.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
