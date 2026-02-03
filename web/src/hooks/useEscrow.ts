"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { ESCROW_ABI } from "@/lib/contracts/abis";
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

// Hook to confirm delivery
export function useConfirmDelivery() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const confirmDelivery = (orderId: bigint, secret: string) => {
    writeContract({
      address: getContractAddress(chainId, "escrow"),
      abi: ESCROW_ABI,
      functionName: "confirmDelivery",
      args: [orderId, secret],
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
