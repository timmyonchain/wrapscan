import { parseUnits } from "viem";

/**
 * Pure amount/decimals helpers shared by the wrap/unwrap panel, the faucet, and
 * the tests. Kept side-effect free and framework free so they can be unit tested
 * directly against 6- and 18-decimal tokens.
 */

/**
 * Parse a user-typed decimal string into base units for a token of `decimals`.
 * Returns null for empty/invalid input (never throws).
 */
export function parseAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === "." || !/^\d*\.?\d*$/.test(trimmed)) {
    return null;
  }
  // Reject more fractional digits than the token supports (parseUnits would
  // silently truncate, which would surprise the user).
  const frac = trimmed.split(".")[1];
  if (frac !== undefined && frac.length > decimals) return null;
  try {
    return parseUnits(trimmed as `${number}`, decimals);
  } catch {
    return null;
  }
}

/** Show up to 6 significant fractional digits without dropping whole units. */
export function trimAmount(value: string): string {
  if (!value.includes(".")) return value;
  const [whole, frac] = value.split(".");
  const short = frac.replace(/0+$/, "").slice(0, 6);
  return short.length ? `${whole}.${short}` : whole;
}

export interface AmountCheck {
  ok: boolean;
  /** Non-null when the amount is present but invalid for submission. */
  error: string | null;
}

/**
 * Validate a parsed amount against an available balance. `amount === null` means
 * "nothing entered yet" (not an error, just not submittable).
 */
export function checkAmount(
  amount: bigint | null,
  balance: bigint | undefined,
  overBalanceMessage: string,
): AmountCheck {
  if (amount === null) return { ok: false, error: null };
  if (amount <= 0n) return { ok: false, error: null };
  if (balance !== undefined && amount > balance) {
    return { ok: false, error: overBalanceMessage };
  }
  return { ok: true, error: null };
}
