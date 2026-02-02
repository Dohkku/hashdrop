import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// Contract addresses
export const CONTRACTS = {
  // Base Mainnet (chainId: 8453)
  [base.id]: {
    escrow: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    reputation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  },
  // Base Sepolia Testnet (chainId: 84532)
  [baseSepolia.id]: {
    escrow: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    reputation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    usdc: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
} as const;

export const config = getDefaultConfig({
  appName: "HashDrop",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [baseSepolia, base],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export function getContractAddress(
  chainId: number,
  contract: "escrow" | "reputation" | "usdc"
): `0x${string}` {
  const addresses = CONTRACTS[chainId as keyof typeof CONTRACTS];
  if (!addresses) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return addresses[contract];
}
