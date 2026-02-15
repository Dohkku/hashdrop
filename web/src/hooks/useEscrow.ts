"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
  useSignTypedData,
} from "wagmi";
import { ESCROW_ABI, ERC20_ABI } from "@/lib/contracts/abis";
import { getContractAddress } from "@/lib/wagmi";

// Order state enum matching Solidity
export enum OrderState {
  OPEN = 0,
  LOCKED = 1,
  PICKED_UP = 2,
  DELIVERED = 3,
  DISPUTED = 4,
  CANCELLED = 5,
  EXPIRED = 6,
}

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  [OrderState.OPEN]: "Abierta",
  [OrderState.LOCKED]: "Aceptada",
  [OrderState.PICKED_UP]: "Recogida",
  [OrderState.DELIVERED]: "Entregada",
  [OrderState.DISPUTED]: "En disputa",
  [OrderState.CANCELLED]: "Cancelada",
  [OrderState.EXPIRED]: "Expirada",
};

// Hook to get an order by ID
export function useOrder(orderId: bigint | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "escrow"),
    abi: ESCROW_ABI,
    functionName: "getOrder",
    args: orderId !== undefined ? [orderId] : undefined,
    query: {
      enabled: orderId !== undefined,
    },
  });
}

// Hook to get user's orders
export function useUserOrders(userAddress: `0x${string}` | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "escrow"),
    abi: ESCROW_ABI,
    functionName: "getUserOrders",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

// Hook to get next order ID
export function useNextOrderId() {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "escrow"),
    abi: ESCROW_ABI,
    functionName: "nextOrderId",
  });
}

// Hook to create an order
export function useCreateOrder() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createOrder = (params: {
    receiver: `0x${string}`;
    packageValue: bigint;
    deliveryFee: bigint;
    secretHash: `0x${string}`;
    deliveryZoneHash: `0x${string}`;
    encryptedDetailsCID: string;
  }) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "createOrder",
      args: [
        params.receiver,
        params.packageValue,
        params.deliveryFee,
        params.secretHash,
        params.deliveryZoneHash,
        params.encryptedDetailsCID,
      ],
    });
  };

  return {
    createOrder,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to accept an order
export function useAcceptOrder() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const acceptOrder = (orderId: bigint) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "acceptOrder",
      args: [orderId],
    });
  };

  return {
    acceptOrder,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to confirm delivery with ZK proof
export function useConfirmDelivery() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const confirmDelivery = (
    orderId: bigint,
    pA: [bigint, bigint],
    pB: [[bigint, bigint], [bigint, bigint]],
    pC: [bigint, bigint]
  ) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "confirmDelivery",
      args: [orderId, pA, pB, pC],
    });
  };

  return {
    confirmDelivery,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to cancel an order
export function useCancelOrder() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelOrder = (orderId: bigint) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "cancelOrder",
      args: [orderId],
    });
  };

  return {
    cancelOrder,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Helper to format USDC
export function formatUSDC(amount: bigint): string {
  const value = Number(amount) / 1e6;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// Helper to parse USDC
export function parseUSDC(amount: string): bigint {
  const value = parseFloat(amount);
  return BigInt(Math.floor(value * 1e6));
}

// ============ USDC Approval Hooks ============

// Hook to get current USDC allowance
export function useUSDCAllowance(spenderAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const { address } = useAccount();

  return useReadContract({
    address: getContractAddress(chainId, "usdc"),
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!spenderAddress,
    },
  });
}

// Hook to get escrow allowance specifically
export function useEscrowAllowance() {
  const chainId = useChainId();
  const escrowAddress = getContractAddress(chainId, "escrow");
  return useUSDCAllowance(escrowAddress);
}

// Hook to get USDC balance
export function useUSDCBalance() {
  const chainId = useChainId();
  const { address } = useAccount();

  return useReadContract({
    address: getContractAddress(chainId, "usdc"),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

// Hook to approve USDC spending
export function useApproveUSDC() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: getContractAddress(chainId, "usdc"),
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  const approveEscrow = (amount: bigint) => {
    const escrowAddress = getContractAddress(chainId, "escrow");
    approve(escrowAddress, amount);
  };

  const approveMax = () => {
    const escrowAddress = getContractAddress(chainId, "escrow");
    const maxUint256 = BigInt(
      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    );
    approve(escrowAddress, maxUint256);
  };

  return {
    approve,
    approveEscrow,
    approveMax,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// ============ Additional Escrow Hooks ============

// Hook to confirm pickup
export function useConfirmPickup() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const confirmPickup = (orderId: bigint, emitterSignature: `0x${string}`) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "confirmPickup",
      args: [orderId, emitterSignature],
    });
  };

  return {
    confirmPickup,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to initiate a dispute
export function useInitiateDispute() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const initiateDispute = (orderId: bigint, reason: string) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: [
        ...ESCROW_ABI,
        {
          inputs: [
            { name: "orderId", type: "uint256" },
            { name: "reason", type: "string" },
          ],
          name: "initiateDispute",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const,
      functionName: "initiateDispute",
      args: [orderId, reason],
    });
  };

  return {
    initiateDispute,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to claim expired order
export function useClaimExpiredOrder() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimExpiredOrder = (orderId: bigint) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: [
        ...ESCROW_ABI,
        {
          inputs: [{ name: "orderId", type: "uint256" }],
          name: "claimExpiredOrder",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const,
      functionName: "claimExpiredOrder",
      args: [orderId],
    });
  };

  return {
    claimExpiredOrder,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// Hook to get required collateral for an order
export function useRequiredCollateral(orderId: bigint | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "escrow"),
    abi: ESCROW_ABI,
    functionName: "getRequiredCollateral",
    args: orderId !== undefined ? [orderId] : undefined,
    query: {
      enabled: orderId !== undefined,
    },
  });
}

// Hook to check if order is expired
export function useIsOrderExpired(orderId: bigint | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "escrow"),
    abi: [
      {
        inputs: [{ name: "orderId", type: "uint256" }],
        name: "isOrderExpired",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "isOrderExpired",
    args: orderId !== undefined ? [orderId] : undefined,
    query: {
      enabled: orderId !== undefined,
    },
  });
}

// ============ Signature Generation ============

// Generate pickup confirmation message hash
export function generatePickupMessageHash(
  orderId: bigint,
  courierAddress: `0x${string}`,
  timestamp: bigint
): `0x${string}` {
  // Match the contract's message format:
  // keccak256(abi.encodePacked(orderId, "PICKUP", courier, timestamp / 1 hours))
  const { keccak256, encodePacked } = require("viem");

  const hourWindow = timestamp / BigInt(3600);

  return keccak256(
    encodePacked(
      ["uint256", "string", "address", "uint256"],
      [orderId, "PICKUP", courierAddress, hourWindow]
    )
  );
}

// Hook for signing pickup confirmation (for emitter)
export function useSignPickupConfirmation() {
  const { signMessageAsync } = require("wagmi").useSignMessage();

  const signPickupConfirmation = async (
    orderId: bigint,
    courierAddress: `0x${string}`
  ): Promise<`0x${string}`> => {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const messageHash = generatePickupMessageHash(orderId, courierAddress, timestamp);

    // Sign the message hash
    const signature = await signMessageAsync({
      message: { raw: messageHash },
    });

    return signature;
  };

  return { signPickupConfirmation };
}

// ============ Order Calculation Helpers ============

// Calculate total deposit required for creating an order
export function calculateTotalDeposit(
  packageValue: bigint,
  deliveryFee: bigint
): {
  protocolFee: bigint;
  insuranceFee: bigint;
  totalDeposit: bigint;
} {
  const PROTOCOL_FEE_BPS = BigInt(100); // 1%
  const INSURANCE_FEE_BPS = BigInt(50); // 0.5%
  const BPS_DENOMINATOR = BigInt(10000);

  const protocolFee = (packageValue * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
  const insuranceFee = (packageValue * INSURANCE_FEE_BPS) / BPS_DENOMINATOR;
  const totalDeposit = packageValue + deliveryFee + protocolFee + insuranceFee;

  return { protocolFee, insuranceFee, totalDeposit };
}

// Calculate collateral required for accepting an order
export function calculateCollateral(packageValue: bigint): bigint {
  const COLLATERAL_MULTIPLIER_BPS = BigInt(11000); // 110%
  const BPS_DENOMINATOR = BigInt(10000);

  return (packageValue * COLLATERAL_MULTIPLIER_BPS) / BPS_DENOMINATOR;
}

// ============ Time Helpers ============

// Calculate time remaining until order expires
export function getOrderExpiryTime(createdAt: bigint): Date {
  const ORDER_EXPIRY = BigInt(24 * 60 * 60); // 24 hours in seconds
  const expiryTimestamp = Number(createdAt + ORDER_EXPIRY) * 1000;
  return new Date(expiryTimestamp);
}

// Calculate time remaining until pickup timeout
export function getPickupTimeoutTime(lockedAt: bigint): Date {
  const PICKUP_TIMEOUT = BigInt(2 * 60 * 60); // 2 hours in seconds
  const timeoutTimestamp = Number(lockedAt + PICKUP_TIMEOUT) * 1000;
  return new Date(timeoutTimestamp);
}

// Calculate time remaining until delivery timeout
export function getDeliveryTimeoutTime(pickedUpAt: bigint): Date {
  const DELIVERY_TIMEOUT = BigInt(6 * 60 * 60); // 6 hours in seconds
  const timeoutTimestamp = Number(pickedUpAt + DELIVERY_TIMEOUT) * 1000;
  return new Date(timeoutTimestamp);
}

// Format time remaining as human-readable string
export function formatTimeRemaining(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expirado";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
