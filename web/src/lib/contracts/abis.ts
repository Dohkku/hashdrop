// HashDropEscrow ABI
export const ESCROW_ABI = [
  // Read functions
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "getOrder",
    outputs: [
      {
        components: [
          { name: "emitter", type: "address" },
          { name: "courier", type: "address" },
          { name: "receiver", type: "address" },
          { name: "packageValue", type: "uint256" },
          { name: "deliveryFee", type: "uint256" },
          { name: "courierCollateral", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "lockedAt", type: "uint256" },
          { name: "pickedUpAt", type: "uint256" },
          { name: "secretHash", type: "bytes32" },
          { name: "deliveryZoneHash", type: "bytes32" },
          { name: "encryptedDetailsCID", type: "string" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserOrders",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "getRequiredCollateral",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextOrderId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { name: "receiver", type: "address" },
      { name: "packageValue", type: "uint256" },
      { name: "deliveryFee", type: "uint256" },
      { name: "secretHash", type: "bytes32" },
      { name: "deliveryZoneHash", type: "bytes32" },
      { name: "encryptedDetailsCID", type: "string" },
    ],
    name: "createOrder",
    outputs: [{ name: "orderId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "acceptOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "emitterSignature", type: "bytes" },
    ],
    name: "confirmPickup",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "secret", type: "string" },
    ],
    name: "confirmDelivery",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "orderId", type: "uint256" }],
    name: "cancelOrder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "emitter", type: "address" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "packageValue", type: "uint256" },
      { indexed: false, name: "deliveryFee", type: "uint256" },
      { indexed: false, name: "deliveryZoneHash", type: "bytes32" },
    ],
    name: "OrderCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "courier", type: "address" },
      { indexed: false, name: "collateral", type: "uint256" },
    ],
    name: "OrderAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "OrderDelivered",
    type: "event",
  },
] as const;

// ReputationSBT ABI
export const REPUTATION_ABI = [
  {
    inputs: [{ name: "asCourier", type: "bool" }],
    name: "register",
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getReputationScore",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isRegistered",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI (for USDC)
export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
