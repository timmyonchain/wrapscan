/**
 * Minimal ABIs used to read onchain ground truth.
 *
 * The Wrappers Registry ABI mirrors the enumeration surface used by the
 * official `@zama-fhe/sdk` WrappersRegistry client:
 *   - getTokenConfidentialTokenPairsLength() -> uint256
 *   - getTokenConfidentialTokenPairsSlice(from, to) -> TokenWrapperPair[]
 *   - getTokenConfidentialTokenPairs() -> TokenWrapperPair[]
 *   - isConfidentialTokenValid(address) -> bool
 * where TokenWrapperPair = { tokenAddress, confidentialTokenAddress, isValid }.
 */
export const wrappersRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getTokenConfidentialTokenPairsLength",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getTokenConfidentialTokenPairs",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "confidentialTokenAddress", type: "address" },
          { name: "isValid", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getTokenConfidentialTokenPairsSlice",
    inputs: [
      { name: "fromIndex", type: "uint256" },
      { name: "toIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "confidentialTokenAddress", type: "address" },
          { name: "isValid", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isConfidentialTokenValid",
    inputs: [{ name: "confidentialToken", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Standard ERC-20 metadata reads. */
export const erc20MetadataAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * ERC-7984 confidential token metadata. The standard exposes name/symbol, and
 * ERC-7984 tokens report decimals of the confidential representation. We read
 * name/symbol and probe decimals defensively.
 */
export const erc7984MetadataAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Probe for a permissionless faucet. A public `mint(address,uint256)` with no
 * access control is the pattern used by Zama's mock tokens. We can't call it in
 * a read-only enumeration, but we can detect whether the selector exists by
 * checking the deployed bytecode for the 4-byte selector.
 */
export const mockMintAbi = [
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
