import { describe, it, expect } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { node } from "@zama-fhe/sdk/node";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";
import { getSepoliaRpcUrl } from "@/lib/zamaConfig";

/**
 * FULL LIVE MUTATION round-trip on the real relayer + Sepolia contracts:
 *   faucet mint -> wrap (shield) -> decrypt (balanceOf) -> unwrap (unshield)
 *   -> decrypt again, asserting the confidential cleartext moves correctly.
 *
 * Needs a FUNDED test EOA (SPIKE_PRIVATE_KEY in .env.local). If the key is
 * absent or the EOA has no gas, the test is SKIPPED with a clear reason — the
 * read-only integration tests above still run for real. Key is never committed.
 */
const CUSDT = getAddress("0x4E7B06D78965594eB5EF5414c357ca21E1554491") as Address;
const MIN_ETH = 3_000_000_000_000_000n; // 0.003 ETH

const pk = process.env.SPIKE_PRIVATE_KEY as Hex | undefined;
const hasKey = !!pk && /^0x[0-9a-fA-F]{64}$/.test(pk);

describe("Live E2E round-trip (wrap -> decrypt -> unwrap -> decrypt)", () => {
  it("mint -> shield -> decrypt -> unshield -> decrypt on cUSDTMock", async (ctx) => {
    if (!hasKey) {
      ctx.skip(); // no funded test EOA key available
      return;
    }
    const account = privateKeyToAccount(pk!);
    const rpc = getSepoliaRpcUrl();
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc, { timeout: 30_000, retryCount: 5 }) });
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc, { timeout: 30_000, retryCount: 5 }) });

    const eth = await publicClient.getBalance({ address: account.address });
    if (eth < MIN_ETH) {
      // eslint-disable-next-line no-console
      console.warn(`E2E skipped: test EOA ${account.address} has ${formatUnits(eth, 18)} ETH (< 0.003).`);
      ctx.skip();
      return;
    }

    const sdk = new ZamaSDK(createConfig({ chains: [zamaSepolia], relayers: { [zamaSepolia.id]: node() }, publicClient, walletClient }));
    try {
      const wrapped = sdk.createWrappedToken(CUSDT);
      const underlying = await wrapped.underlying();
      const decimals = Number(await publicClient.readContract({
        address: underlying,
        abi: [{ type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }] }] as const,
        functionName: "decimals",
      }));
      const amount = 20n * 10n ** BigInt(decimals);

      // mint enough to wrap
      const mintHash = await walletClient.writeContract({
        address: underlying,
        abi: [{ type: "function", stateMutability: "nonpayable", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }] as const,
        functionName: "mint",
        args: [account.address, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      const wrapRes = await wrapped.shield(amount);
      expect(wrapRes.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const afterWrap = await wrapped.balanceOf(account.address);
      expect(afterWrap).toBeGreaterThan(0n);

      const unwrapAmt = afterWrap / 2n;
      const unwrapRes = await wrapped.unshield(unwrapAmt);
      expect(unwrapRes.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const afterUnwrap = await wrapped.balanceOf(account.address);
      // confidential balance must have dropped by the unwrapped amount
      expect(afterUnwrap).toBeLessThan(afterWrap);
      expect(afterWrap - afterUnwrap).toBe(unwrapAmt);
    } finally {
      sdk.terminate();
    }
  }, 300_000);
});
