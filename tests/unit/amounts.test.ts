import { describe, it, expect } from "vitest";
import { parseAmount, trimAmount, checkAmount } from "@/lib/amounts";
import { claimAmount, FAUCET_CLAIM_UNITS } from "@/lib/faucet";

describe("parseAmount (decimals scaling)", () => {
  it("scales whole numbers for 6-decimal tokens (USDT/USDC)", () => {
    expect(parseAmount("100", 6)).toBe(100_000_000n);
    expect(parseAmount("1", 6)).toBe(1_000_000n);
  });

  it("scales for 18-decimal tokens (WETH)", () => {
    expect(parseAmount("1.5", 18)).toBe(1_500_000_000_000_000_000n);
    expect(parseAmount("20", 18)).toBe(20n * 10n ** 18n);
  });

  it("handles zero", () => {
    expect(parseAmount("0", 6)).toBe(0n);
  });

  it("trims surrounding whitespace", () => {
    expect(parseAmount("  20  ", 18)).toBe(20n * 10n ** 18n);
  });

  it("returns null for empty / bare dot / garbage", () => {
    expect(parseAmount("", 6)).toBeNull();
    expect(parseAmount(".", 6)).toBeNull();
    expect(parseAmount("abc", 6)).toBeNull();
    expect(parseAmount("1,5", 6)).toBeNull();
  });

  it("rejects negatives (no sign allowed)", () => {
    expect(parseAmount("-5", 6)).toBeNull();
  });

  it("rejects more fractional digits than the token supports (no silent truncation)", () => {
    expect(parseAmount("1.2345678", 6)).toBeNull(); // 7 dp on a 6-dp token
    expect(parseAmount("1.234567", 6)).toBe(1_234_567n); // exactly 6 dp is fine
  });
});

describe("trimAmount (display)", () => {
  it("drops trailing zeros and the dot", () => {
    expect(trimAmount("100.000000")).toBe("100");
    expect(trimAmount("50")).toBe("50");
  });
  it("keeps up to 6 significant fractional digits", () => {
    expect(trimAmount("1.23456789")).toBe("1.234567");
    expect(trimAmount("1.5")).toBe("1.5");
  });
});

describe("checkAmount (validation)", () => {
  const over = "More than your balance.";
  it("treats null (nothing typed) as not-submittable but not an error", () => {
    expect(checkAmount(null, 100n, over)).toEqual({ ok: false, error: null });
  });
  it("treats zero / negative as not-submittable", () => {
    expect(checkAmount(0n, 100n, over)).toEqual({ ok: false, error: null });
  });
  it("rejects amounts greater than balance with a message", () => {
    expect(checkAmount(150n, 100n, over)).toEqual({ ok: false, error: over });
  });
  it("accepts amounts within balance", () => {
    expect(checkAmount(50n, 100n, over)).toEqual({ ok: true, error: null });
    expect(checkAmount(100n, 100n, over)).toEqual({ ok: true, error: null }); // exact max
  });
  it("accepts when balance is unknown (undefined)", () => {
    expect(checkAmount(50n, undefined, over)).toEqual({ ok: true, error: null });
  });
});

describe("claimAmount (faucet)", () => {
  it(`mints ${FAUCET_CLAIM_UNITS} whole units scaled by decimals`, () => {
    expect(claimAmount(6)).toBe(FAUCET_CLAIM_UNITS * 10n ** 6n);
    expect(claimAmount(18)).toBe(FAUCET_CLAIM_UNITS * 10n ** 18n);
    expect(claimAmount(0)).toBe(FAUCET_CLAIM_UNITS);
  });
});
