import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // Default to node; the one hook test opts into jsdom via a file directive.
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Live Sepolia reads + the SDK relayer are slow; give them real headroom.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Live integration tests share one on-chain snapshot / RPC; run serially so
    // we don't hammer the RPC with parallel workers.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["src/lib/**", "src/hooks/**", "src/app/api/**"],
      reportsDirectory: "./coverage",
    },
  },
});
