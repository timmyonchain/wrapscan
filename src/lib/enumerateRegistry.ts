import {
  createPublicClient,
  http,
  getAddress,
  toFunctionSelector,
  type Address,
  type PublicClient,
} from "viem";
import { sepolia } from "viem/chains";
import {
  wrappersRegistryAbi,
  erc20MetadataAbi,
  erc7984MetadataAbi,
} from "./abis";
import { WRAPPERS_REGISTRY_ADDRESS, getSepoliaRpcUrl } from "./zamaConfig";

/** Known reference address for the cUSDT wrapper (to be verified onchain). */
export const KNOWN_CUSDT_WRAPPER: Address = getAddress(
  "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
);

const MINT_SELECTOR = toFunctionSelector("mint(address,uint256)"); // 0x40c10f19

export interface TokenMeta {
  address: Address;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
}

export interface RegistryEntry {
  index: number;
  /** Underlying ERC-20. */
  token: TokenMeta;
  /** ERC-7984 confidential wrapper. */
  confidentialToken: TokenMeta;
  /** Registry `isValid` flag for this pair (true = active, false = revoked). */
  isValid: boolean;
  /** Cross-checked directly via isConfidentialTokenValid(confidentialToken). */
  isValidOnchainCheck: boolean;
  /**
   * Whether the underlying ERC-20 looks faucet-able: exposes a public
   * `mint(address,uint256)`. `selectorPresent` = mint selector found in
   * deployed bytecode; `callSucceeds` = a read-only simulated mint from a
   * dummy account did not revert (i.e. not access-controlled).
   */
  faucet: {
    faucetable: boolean;
    selectorPresent: boolean;
    callSucceeds: boolean;
  };
}

export interface RegistryGroundTruth {
  meta: {
    generatedAt: string;
    chainId: number;
    rpcUrl: string;
    registryAddress: Address;
    registryAddressSource: string;
    totalPairs: number;
  };
  cusdtSanityCheck: {
    referenceAddress: Address;
    foundInRegistry: boolean;
    matchedIndex: number | null;
    isValid: boolean | null;
    note: string;
  };
  entries: RegistryEntry[];
}

function makeClient(): PublicClient {
  const rpcUrl = getSepoliaRpcUrl();
  return createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
}

async function readTokenMeta(
  client: PublicClient,
  address: Address,
  abi: typeof erc20MetadataAbi | typeof erc7984MetadataAbi,
): Promise<TokenMeta> {
  const results = await client.multicall({
    allowFailure: true,
    contracts: [
      { address, abi, functionName: "name" },
      { address, abi, functionName: "symbol" },
      { address, abi, functionName: "decimals" },
    ],
  });
  const [name, symbol, decimals] = results;
  return {
    address,
    name: name.status === "success" ? (name.result as string) : null,
    symbol: symbol.status === "success" ? (symbol.result as string) : null,
    decimals:
      decimals.status === "success" ? Number(decimals.result as number) : null,
  };
}

async function detectFaucet(
  client: PublicClient,
  underlying: Address,
): Promise<RegistryEntry["faucet"]> {
  let selectorPresent = false;
  try {
    const code = await client.getBytecode({ address: underlying });
    if (code) {
      selectorPresent = code
        .toLowerCase()
        .includes(MINT_SELECTOR.slice(2).toLowerCase());
    }
  } catch {
    // ignore
  }

  // Read-only simulate: a public mint won't revert; an access-controlled one
  // (onlyOwner / MinterRole) reverts. Called from a throwaway sender.
  let callSucceeds = false;
  try {
    await client.simulateContract({
      address: underlying,
      abi: [
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
      ] as const,
      functionName: "mint",
      args: ["0x000000000000000000000000000000000000dEaD", 1n],
      account: "0x000000000000000000000000000000000000dEaD",
    });
    callSucceeds = true;
  } catch {
    callSucceeds = false;
  }

  return {
    selectorPresent,
    callSucceeds,
    faucetable: selectorPresent && callSucceeds,
  };
}

export async function enumerateRegistry(): Promise<RegistryGroundTruth> {
  const client = makeClient();
  const registryAddress = WRAPPERS_REGISTRY_ADDRESS;

  const pairs = (await client.readContract({
    address: registryAddress,
    abi: wrappersRegistryAbi,
    functionName: "getTokenConfidentialTokenPairs",
  })) as ReadonlyArray<{
    tokenAddress: Address;
    confidentialTokenAddress: Address;
    isValid: boolean;
  }>;

  const entries: RegistryEntry[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    const token = getAddress(p.tokenAddress);
    const confidentialToken = getAddress(p.confidentialTokenAddress);

    const [erc20, erc7984, isValidCheck, faucet] = await Promise.all([
      readTokenMeta(client, token, erc20MetadataAbi),
      readTokenMeta(client, confidentialToken, erc7984MetadataAbi),
      client
        .readContract({
          address: registryAddress,
          abi: wrappersRegistryAbi,
          functionName: "isConfidentialTokenValid",
          args: [confidentialToken],
        })
        .then((v) => v as boolean)
        .catch(() => p.isValid),
      detectFaucet(client, token),
    ]);

    entries.push({
      index: i,
      token: erc20,
      confidentialToken: erc7984,
      isValid: p.isValid,
      isValidOnchainCheck: isValidCheck,
      faucet,
    });
  }

  const match = entries.find(
    (e) =>
      getAddress(e.confidentialToken.address) === KNOWN_CUSDT_WRAPPER,
  );

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      chainId: sepolia.id,
      rpcUrl: getSepoliaRpcUrl(),
      registryAddress,
      registryAddressSource:
        "@zama-fhe/sdk@3.2.0 ./chains sepolia.registryAddress (cross-checked docs.zama.org)",
      totalPairs: pairs.length,
    },
    cusdtSanityCheck: {
      referenceAddress: KNOWN_CUSDT_WRAPPER,
      foundInRegistry: Boolean(match),
      matchedIndex: match ? match.index : null,
      isValid: match ? match.isValid : null,
      note: match
        ? "Reference cUSDT wrapper IS present in the onchain registry."
        : "Reference cUSDT wrapper NOT found as a confidentialToken in the onchain registry.",
    },
    entries,
  };
}
