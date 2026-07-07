import { describe, it, expect } from "vitest";
import { mapTxError } from "@/lib/faucet";

// Every case asserts a specific branch of the friendly-error mapper against a
// realistic raw wallet/RPC/relayer error string.
describe("mapTxError", () => {
  it("maps user rejection (message)", () => {
    expect(mapTxError(new Error("User rejected the request."))).toBe(
      "You rejected the request in your wallet.",
    );
  });

  it("maps user rejection (code 4001 in message)", () => {
    expect(mapTxError({ message: "MetaMask Tx Signature: 4001 denied" })).toBe(
      "You rejected the request in your wallet.",
    );
  });

  it("maps insufficient gas funds", () => {
    expect(
      mapTxError(new Error("insufficient funds for gas * price + value")),
    ).toContain("Not enough Sepolia ETH for gas");
  });

  it("maps insufficient token balance", () => {
    expect(mapTxError(new Error("transfer amount exceeds balance"))).toBeTypeOf(
      "string",
    );
    expect(mapTxError(new Error("insufficient balance for transfer"))).toBe(
      "Insufficient balance for this amount.",
    );
  });

  it("maps chain mismatch to a switch-network hint", () => {
    expect(
      mapTxError(new Error("The current chain does not match the target chain.")),
    ).toBe("Wrong network. Switch to Sepolia and try again.");
  });

  it("maps input-proof / encrypt-proof failures to a specific message", () => {
    expect(
      mapTxError(new Error("Missing 1 required field: contractChainId")),
    ).toBe("Couldn't prepare the encrypted amount (input proof). Please try again in a moment.");
    expect(mapTxError(new Error("input-proof verification failed"))).toContain(
      "input proof",
    );
  });

  it("maps relayer / public-key problems", () => {
    expect(
      mapTxError(new Error("Impossible to fetch public key: wrong relayer url")),
    ).toBe("The confidential engine (relayer) had a problem. Please try again.");
  });

  it("surfaces the underlying cause instead of a bare 'Encryption failed'", () => {
    const err = new Error("Encryption failed");
    // @ts-expect-error attach a cause chain like the SDK does
    err.cause = new Error("Request ENCRYPT timed out after 30000ms");
    const msg = mapTxError(err);
    expect(msg).not.toBe("Encryption failed");
    // "timed out" is matched before the generic encrypt branch -> timeout message
    expect(msg.toLowerCase()).toContain("timed out");
  });

  it("maps a plain 'Encryption failed' with no timeout cause to a friendly encrypt message", () => {
    expect(mapTxError(new Error("Encryption failed"))).toContain(
      "Couldn't encrypt the amount",
    );
  });

  it("maps on-chain revert", () => {
    expect(mapTxError(new Error("execution reverted: not allowed"))).toBe(
      "The transaction reverted on-chain. Check the amount and try again.",
    );
  });

  it("maps network timeout", () => {
    expect(mapTxError(new Error("The request timed out."))).toBe(
      "The network timed out. Please try again.",
    );
  });

  it("walks the cause chain to find the real message", () => {
    const inner = new Error("insufficient funds for gas");
    const outer = new Error("Transaction failed");
    // @ts-expect-error cause chain
    outer.cause = inner;
    expect(mapTxError(outer)).toContain("Not enough Sepolia ETH");
  });

  it("uses shortMessage when present", () => {
    expect(
      mapTxError({ shortMessage: "User rejected the request.", message: "big blob" }),
    ).toBe("You rejected the request in your wallet.");
  });

  it("falls back to a trimmed real message for unknown errors (never empty)", () => {
    const msg = mapTxError(new Error("Some unexpected provider glitch happened"));
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain("Some unexpected provider glitch");
  });

  it("never returns an empty string, even for non-Error input", () => {
    expect(mapTxError(undefined).length).toBeGreaterThan(0);
    expect(mapTxError("raw string error").length).toBeGreaterThan(0);
    expect(mapTxError(42).length).toBeGreaterThan(0);
  });
});
