import { describe, it, expect } from "vitest";
import {
  parsePair,
  partitionByValidity,
  displaySymbol,
  displayName,
  displayDecimals,
  type ApiEntry,
  type RegistryPair,
} from "@/lib/registry";

const good: ApiEntry = {
  index: 0,
  token: {
    address: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
    symbol: "USDTMock",
    name: "Tether USD (Mock)",
    decimals: 6,
  },
  confidentialToken: {
    address: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
    symbol: "cUSDTMock",
    name: "Confidential USDT (Mock)",
    decimals: 6,
  },
  isValid: true,
  faucet: { faucetable: true },
};

describe("parsePair", () => {
  it("maps a well-formed entry to a RegistryPair", () => {
    const p = parsePair(good, 11155111);
    expect(p.token.address).toBe(good.token.address);
    expect(p.confidentialToken.address).toBe(good.confidentialToken.address);
    expect(p.token.decimals).toBe(6);
    expect(p.isValid).toBe(true);
    expect(p.faucetable).toBe(true);
    expect(p.network).toBe("Sepolia");
  });

  it("labels unknown chain ids generically", () => {
    expect(parsePair(good, 999999).network).toBe("Chain 999999");
  });

  it("does not crash on missing/odd metadata (null symbol/name/decimals)", () => {
    const malformed: ApiEntry = {
      index: 3,
      token: { address: "0x0000000000000000000000000000000000000001", symbol: null, name: null, decimals: null },
      confidentialToken: { address: "0x0000000000000000000000000000000000000002", symbol: "", name: "  ", decimals: null },
      isValid: true,
      faucet: { faucetable: false },
    };
    const p = parsePair(malformed, 11155111);
    expect(p.token.symbol).toBeNull();
    expect(p.token.decimals).toBeNull();
    // graceful display fallbacks
    expect(displaySymbol(p.token)).toMatch(/^0x0000…0001$/);
    expect(displayName(p.token)).toBe("Unknown token");
    expect(displayDecimals(p.token)).toBe("n/a");
    // empty/whitespace confidential symbol also falls back to short address
    expect(displaySymbol(p.confidentialToken)).toMatch(/^0x0000…0002$/);
  });

  it("coerces a missing faucet flag to false rather than throwing", () => {
    const noFaucet = { ...good, faucet: undefined } as unknown as ApiEntry;
    expect(parsePair(noFaucet, 11155111).faucetable).toBe(false);
  });
});

describe("partitionByValidity", () => {
  it("splits active from revoked, preserving order", () => {
    const pairs: RegistryPair[] = [
      { ...parsePair(good, 11155111), index: 0, isValid: true },
      { ...parsePair(good, 11155111), index: 1, isValid: false },
      { ...parsePair(good, 11155111), index: 2, isValid: true },
    ];
    const { active, revoked } = partitionByValidity(pairs);
    expect(active.map((p) => p.index)).toEqual([0, 2]);
    expect(revoked.map((p) => p.index)).toEqual([1]);
  });

  it("handles an all-active list (0 revoked)", () => {
    const { active, revoked } = partitionByValidity([parsePair(good, 11155111)]);
    expect(active).toHaveLength(1);
    expect(revoked).toHaveLength(0);
  });
});

describe("display helpers", () => {
  it("displaySymbol prefers the real symbol", () => {
    expect(displaySymbol(parsePair(good, 11155111).token)).toBe("USDTMock");
  });
  it("displayDecimals stringifies a real number", () => {
    expect(displayDecimals(parsePair(good, 11155111).token)).toBe("6");
  });
});
