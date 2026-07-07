import { describe, it, expect } from "vitest";
import { createPublicClient, http, getAddress, type Address } from "viem";
import { sepolia } from "viem/chains";
import { ERC7984_INTERFACE_ID } from "@zama-fhe/sdk";
import { readSupportsInterfaceContract } from "@zama-fhe/sdk/viem";
import { getSepoliaRpcUrl } from "@/lib/zamaConfig";

/**
 * Live check of the exact ERC-7984 detection the /decrypt "paste any address"
 * tool relies on: getBytecode + ERC-165 supportsInterface(ERC7984_INTERFACE_ID).
 */
const client = createPublicClient({
  chain: sepolia,
  transport: http(getSepoliaRpcUrl(), { timeout: 30_000, retryCount: 3 }),
});

const CUSDT = getAddress("0x4E7B06D78965594eB5EF5414c357ca21E1554491"); // ERC-7984 wrapper
const CWETH = getAddress("0x46208622DA27d91db4f0393733C8BA082ed83158"); // ERC-7984 wrapper
const USDT_ERC20 = getAddress("0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0"); // plain ERC-20
const NON_CONTRACT = getAddress("0x000000000000000000000000000000000000dEaD"); // EOA-ish, no code

async function detectConfidential(addr: Address): Promise<boolean> {
  const code = await client.getBytecode({ address: addr });
  if (!code || code === "0x") return false; // not a contract
  try {
    return await readSupportsInterfaceContract(client, addr, ERC7984_INTERFACE_ID as Address);
  } catch {
    return false; // doesn't implement ERC-165 / not confidential
  }
}

describe("Live ERC-7984 detection (used by /decrypt)", () => {
  it("returns true for a real confidential ERC-7984 token (cUSDTMock)", async () => {
    expect(await detectConfidential(CUSDT)).toBe(true);
  });

  it("returns true for another confidential wrapper (cWETHMock)", async () => {
    expect(await detectConfidential(CWETH)).toBe(true);
  });

  it("returns false for a plain ERC-20 (not confidential)", async () => {
    expect(await detectConfidential(USDT_ERC20)).toBe(false);
  });

  it("returns false for a non-contract address (no bytecode)", async () => {
    expect(await detectConfidential(NON_CONTRACT)).toBe(false);
  });
});
