"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
} from "wagmi";
import { REPUTATION_ABI } from "@/lib/contracts/abis";
import { getContractAddress } from "@/lib/wagmi";

/**
 * Reputation data structure matching the contract
 */
export interface Reputation {
  score: bigint;
  totalDeliveries: bigint;
  successfulDeliveries: bigint;
  failedDeliveries: bigint;
  disputes: bigint;
  lastActivityAt: bigint;
  isCourier: boolean;
  isActive: boolean;
}

/**
 * Hook to check if current user is registered
 */
export function useIsRegistered() {
  const chainId = useChainId();
  const { address } = useAccount();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: REPUTATION_ABI,
    functionName: "isRegistered",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to check if a specific address is registered
 */
export function useIsAddressRegistered(userAddress: `0x${string}` | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: REPUTATION_ABI,
    functionName: "isRegistered",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

/**
 * Hook to get reputation score for current user
 */
export function useReputationScore() {
  const chainId = useChainId();
  const { address } = useAccount();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: REPUTATION_ABI,
    functionName: "getReputationScore",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to get reputation score for a specific address
 */
export function useAddressReputationScore(userAddress: `0x${string}` | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: REPUTATION_ABI,
    functionName: "getReputationScore",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

/**
 * Hook to get full reputation data for current user
 * Note: This requires the extended ABI with getReputation function
 */
export function useReputation() {
  const chainId = useChainId();
  const { address } = useAccount();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: [
      ...REPUTATION_ABI,
      {
        inputs: [{ name: "user", type: "address" }],
        name: "getReputation",
        outputs: [
          {
            components: [
              { name: "score", type: "uint256" },
              { name: "totalDeliveries", type: "uint256" },
              { name: "successfulDeliveries", type: "uint256" },
              { name: "failedDeliveries", type: "uint256" },
              { name: "disputes", type: "uint256" },
              { name: "lastActivityAt", type: "uint256" },
              { name: "isCourier", type: "bool" },
              { name: "isActive", type: "bool" },
            ],
            name: "",
            type: "tuple",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "getReputation",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to check if user meets minimum score requirement
 */
export function useMeetsMinimumScore(minScore: bigint = BigInt(50)) {
  const { data: score, isLoading } = useReputationScore();

  return {
    meetsMinimum: score !== undefined ? score >= minScore : undefined,
    score,
    isLoading,
  };
}

/**
 * Hook to register as a user (emitter or courier)
 */
export function useRegister() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const register = (asCourier: boolean) => {
    writeContract({
      address: getContractAddress(chainId, "reputation"),
      abi: REPUTATION_ABI,
      functionName: "register",
      args: [asCourier],
    });
  };

  return {
    register,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

/**
 * Hook to get the minimum courier score
 */
export function useMinCourierScore() {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: [
      {
        inputs: [],
        name: "minCourierScore",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "minCourierScore",
  });
}

/**
 * Hook to get token ID for a user
 */
export function useTokenId(userAddress: `0x${string}` | undefined) {
  const chainId = useChainId();

  return useReadContract({
    address: getContractAddress(chainId, "reputation"),
    abi: [
      {
        inputs: [{ name: "user", type: "address" }],
        name: "getTokenId",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "getTokenId",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

/**
 * Helper to format reputation score for display
 */
export function formatReputationScore(score: bigint | undefined): string {
  if (score === undefined) return "-";
  return score.toString();
}

/**
 * Get reputation level based on score
 */
export function getReputationLevel(score: bigint): {
  level: string;
  color: string;
} {
  const scoreNum = Number(score);

  if (scoreNum >= 800) {
    return { level: "Excelente", color: "text-green-500" };
  } else if (scoreNum >= 500) {
    return { level: "Bueno", color: "text-blue-500" };
  } else if (scoreNum >= 200) {
    return { level: "Regular", color: "text-yellow-500" };
  } else if (scoreNum >= 50) {
    return { level: "Bajo", color: "text-orange-500" };
  } else {
    return { level: "Muy Bajo", color: "text-red-500" };
  }
}

/**
 * Calculate success rate from reputation data
 */
export function calculateSuccessRate(reputation: Reputation | undefined): string {
  if (!reputation || reputation.totalDeliveries === BigInt(0)) {
    return "N/A";
  }

  const rate =
    (Number(reputation.successfulDeliveries) / Number(reputation.totalDeliveries)) * 100;
  return `${rate.toFixed(1)}%`;
}
