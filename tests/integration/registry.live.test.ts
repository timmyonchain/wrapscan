import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  http,
  getAddress,
  isAddress,
  toFunctionSelector,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { ERC7984_INTERFACE_ID } from "@zama-fhe/sdk";
import {
  readTokenPairsContract,
  readConfidentialTokenAddressContract,
  readTokenAddressContract,
  readSupportsInterfaceContract,
} from "@zama-fhe/sdk/viem";
import { WRAPPERS_REGISTRY_ADDRESS, getSepoliaRpcUrl } from "@/lib/zamaConfig";

/**
 * LIVE integration tests — these run against Zama's OFFICIAL Confidential
 * Wrappers Registry and the real token/wrapper contracts on Ethereum Sepolia,
 * read through our Alchemy RPC (SEPOLIA_RPC_URL). Nothing here is mocked.
 */
const client = createPublicClient({
  chain: sepolia,
  transport: http(getSepoliaRpcUrl(), { timeout: 30_000, retryCount: 3 }),
});
const REGISTRY = WRAPPERS_REGISTRY_ADDRESS;
const MINT_SELECTOR = toFunctionSelector("mint(address,uint256)"); // 0x40c10f19
const DEAD = "0x000000000000000000000000000000000000dEaD" as Address;

const META_ABI = [
  { type: "function", stateMutability: "view", name: "name", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", stateMutability: "view", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const;
const MINT_ABI = [
  { type: "function", stateMutability: "nonpayable", name: "mint", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

// Ground truth captured in Phase 0 — used only to cross-check the live faucet
// classification per pair (does live reality still match what we documented?).
const groundTruth = JSON.parse(
  readFileSync(resolve(process.cwd(), "public", "registry-ground-truth.json"), "utf8"),
) as { entries: { confidentialToken: { address: string }; faucet: { faucetable: boolean } }[] };
const gtFaucet = new Map(
  groundTruth.entries.map((e) => [e.confidentialToken.address.toLowerCase(), e.faucet.faucetable]),
);

// Collection-time LIVE read of the registry so we get one test per real pair.
const pairs = await readTokenPairsContract(client, REGISTRY);

async function isMintPublic(underlying: Address): Promise<boolean> {
  const code = (await client.getBytecode({ address: underlying })) ?? "0x";
  if (!code.toLowerCase().includes(MINT_SELECTOR.slice(2).toLowerCase())) return false;
  try {
    await client.simulateContract({ address: underlying, abi: MINT_ABI, functionName: "mint", args: [DEAD, 1n], account: DEAD });
    return true;
  } catch {
    return false;
  }
}

describe("Live registry — Zama Confidential Wrappers Registry on Sepolia", () => {
  it("registry address is the SDK-sourced official one and is a deployed contract", async () => {
    expect(getAddress(REGISTRY)).toBe("0x2f0750Bbb0A246059d80e94c454586a7F27a128e");
    const code = await client.getBytecode({ address: REGISTRY });
    expect(code && code.length > 2).toBe(true);
  });

  it("enumerates exactly 9 pairs", () => {
    expect(pairs.length).toBe(9);
  });

  it("classifies 7 faucet-able mocks, 2 restricted, 0 revoked (live)", async () => {
    const active = pairs.filter((p) => p.isValid);
    const revoked = pairs.filter((p) => !p.isValid);
    expect(revoked.length).toBe(0);
    let faucetable = 0;
    for (const p of active) {
      if (await isMintPublic(getAddress(p.tokenAddress))) faucetable++;
    }
    expect(faucetable).toBe(7);
    expect(active.length - faucetable).toBe(2);
  });

  it("the known cUSDT wrapper is present and valid", () => {
    const hit = pairs.find(
      (p) => getAddress(p.confidentialTokenAddress) === getAddress("0x4E7B06D78965594eB5EF5414c357ca21E1554491"),
    );
    expect(hit).toBeDefined();
    expect(hit!.isValid).toBe(true);
  });

  it("has a mix of 6- and 18-decimal underlyings (real diversity)", async () => {
    const decs = new Set<number>();
    for (const p of pairs) {
      const d = await client.readContract({ address: getAddress(p.tokenAddress), abi: META_ABI, functionName: "decimals" });
      decs.add(Number(d));
    }
    expect(decs.has(6)).toBe(true);
    expect(decs.has(18)).toBe(true);
  });
});

describe.each(
  pairs.map((p, i) => ({
    i,
    token: getAddress(p.tokenAddress),
    wrapper: getAddress(p.confidentialTokenAddress),
    isValid: p.isValid,
  })),
)("Live pair #$i — $wrapper", ({ token, wrapper, isValid }) => {
  it("token & wrapper are valid checksummed addresses", () => {
    expect(isAddress(token)).toBe(true);
    expect(isAddress(wrapper)).toBe(true);
    expect(getAddress(token)).toBe(token);
    expect(getAddress(wrapper)).toBe(wrapper);
  });

  it("token & wrapper are deployed contracts (non-empty bytecode)", async () => {
    const [tc, wc] = await Promise.all([
      client.getBytecode({ address: token }),
      client.getBytecode({ address: wrapper }),
    ]);
    expect(tc && tc.length > 2).toBe(true);
    expect(wc && wc.length > 2).toBe(true);
  });

  it("isValid is a boolean flag read from the registry", () => {
    expect(typeof isValid).toBe("boolean");
  });

  it("ERC-20 metadata reads: non-empty symbol, decimals in range", async () => {
    const [sym, dec] = await Promise.all([
      client.readContract({ address: token, abi: META_ABI, functionName: "symbol" }),
      client.readContract({ address: token, abi: META_ABI, functionName: "decimals" }),
    ]);
    expect(String(sym).length).toBeGreaterThan(0);
    expect(Number(dec)).toBeGreaterThanOrEqual(0);
    expect(Number(dec)).toBeLessThanOrEqual(18);
  });

  it("ERC-7984 wrapper metadata reads: non-empty symbol, sane decimals", async () => {
    const [sym, dec] = await Promise.all([
      client.readContract({ address: wrapper, abi: META_ABI, functionName: "symbol" }),
      client.readContract({ address: wrapper, abi: META_ABI, functionName: "decimals" }),
    ]);
    expect(String(sym).length).toBeGreaterThan(0);
    expect(Number(dec)).toBeGreaterThanOrEqual(0);
    expect(Number(dec)).toBeLessThanOrEqual(18);
  });

  it("wrapper reports the ERC-7984 interface via ERC-165 supportsInterface", async () => {
    const ok = await readSupportsInterfaceContract(client, wrapper, ERC7984_INTERFACE_ID as Address);
    expect(ok).toBe(true);
  });

  it("registry linkage resolves both directions and is self-consistent", async () => {
    const [foundC, confAddr] = await readConfidentialTokenAddressContract(client, REGISTRY, token);
    const [foundT, tokAddr] = await readTokenAddressContract(client, REGISTRY, wrapper);
    expect(foundC).toBe(true);
    expect(foundT).toBe(true);
    expect(getAddress(confAddr)).toBe(wrapper);
    expect(getAddress(tokAddr)).toBe(token);
  });

  it("live faucet classification matches the documented ground truth", async () => {
    const live = await isMintPublic(token);
    const documented = gtFaucet.get(wrapper.toLowerCase());
    expect(documented).toBeDefined();
    expect(live).toBe(documented);
  });
});
