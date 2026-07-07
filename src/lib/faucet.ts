import type { Address } from "./registry";

/** Whole tokens minted per claim (scaled by the token's decimals). */
export const FAUCET_CLAIM_UNITS = 100n;

/**
 * Public faucet mint — `mint(address,uint256)`, selector 0x40c10f19.
 * This is the exact signature verified in Phase 0/1 (the faucet-detection
 * simulate + the spike's real USDTMock mint) for all 7 faucet-able mocks.
 */
export const MINT_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const ERC20_BALANCE_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Amount (in base units) a single claim mints for a token of `decimals`. */
export function claimAmount(decimals: number): bigint {
  return FAUCET_CLAIM_UNITS * 10n ** BigInt(decimals);
}

export function sepoliaTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export const FAUCET_TOKEN = (address: Address) => address; // identity helper for clarity

/** Turn a raw wallet/RPC error into a short, specific, friendly message. */
export function mapTxError(err: unknown): string {
  const raw =
    (err && typeof err === "object" && "shortMessage" in err
      ? String((err as { shortMessage?: unknown }).shortMessage)
      : "") ||
    (err instanceof Error ? err.message : String(err));
  const msg = raw.toLowerCase();

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("denied transaction") ||
    msg.includes("4001")
  ) {
    return "You rejected the transaction in your wallet.";
  }
  if (msg.includes("insufficient funds")) {
    return "Not enough Sepolia ETH for gas. Grab some from a faucet and try again.";
  }
  if (msg.includes("chain mismatch") || msg.includes("does not match the target chain")) {
    return "Wrong network. Switch to Sepolia and try again.";
  }
  if (msg.includes("reverted") || msg.includes("execution revert")) {
    return "The mint reverted on-chain. This token may not be claimable.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "The network timed out. Please try again.";
  }
  // Keep a trimmed version of the real message rather than a vague catch-all.
  const trimmed = raw.split("\n")[0]?.slice(0, 140).trim();
  return trimmed || "Something went wrong sending the transaction. Please try again.";
}
