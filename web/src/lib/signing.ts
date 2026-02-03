/**
 * Utilities for signing messages required by HashDrop contracts
 */

import { keccak256, encodePacked, toHex } from "viem";
import type { WalletClient } from "viem";

/**
 * Generate the message hash for confirming a pickup.
 * This must match the format expected by the HashDropEscrow contract.
 *
 * The contract expects:
 * keccak256(abi.encodePacked(orderId, "PICKUP", courierAddress, block.timestamp / 1 hours))
 *
 * @param orderId - The order ID
 * @param courierAddress - The courier's address
 * @param hourWindow - The hour window (block.timestamp / 1 hours)
 */
export function getPickupMessageHash(
  orderId: bigint,
  courierAddress: `0x${string}`,
  hourWindow: bigint
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["uint256", "string", "address", "uint256"],
      [orderId, "PICKUP", courierAddress, hourWindow]
    )
  );
}

/**
 * Get the current hour window for signing.
 * This should match block.timestamp / 1 hours on-chain.
 */
export function getCurrentHourWindow(): bigint {
  // JavaScript timestamps are in milliseconds, Solidity uses seconds
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const oneHourInSeconds = BigInt(3600);
  return nowSeconds / oneHourInSeconds;
}

/**
 * Sign a pickup confirmation message.
 *
 * The emitter calls this function to generate a signature that the courier
 * can use to confirm the pickup on-chain.
 *
 * @param walletClient - The wallet client (emitter's wallet)
 * @param orderId - The order ID
 * @param courierAddress - The courier's address
 * @returns The signature as a hex string
 */
export async function signPickupMessage(
  walletClient: WalletClient,
  orderId: bigint,
  courierAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet not connected");
  }

  const hourWindow = getCurrentHourWindow();
  const messageHash = getPickupMessageHash(orderId, courierAddress, hourWindow);

  // Sign the raw hash using personal_sign (eth_sign)
  // This will prefix with "\x19Ethereum Signed Message:\n32" automatically
  const signature = await walletClient.signMessage({
    account,
    message: { raw: messageHash },
  });

  return signature;
}

/**
 * Verify a pickup signature locally (for debugging/testing).
 *
 * @param signature - The signature to verify
 * @param orderId - The order ID
 * @param courierAddress - The courier's address
 * @param emitterAddress - The expected emitter address
 * @returns True if the signature is valid
 */
export async function verifyPickupSignature(
  signature: `0x${string}`,
  orderId: bigint,
  courierAddress: `0x${string}`,
  emitterAddress: `0x${string}`
): Promise<boolean> {
  const { recoverMessageAddress } = await import("viem");

  const hourWindow = getCurrentHourWindow();
  const messageHash = getPickupMessageHash(orderId, courierAddress, hourWindow);

  try {
    const recoveredAddress = await recoverMessageAddress({
      message: { raw: messageHash },
      signature,
    });

    return recoveredAddress.toLowerCase() === emitterAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Format signature info for display
 */
export function formatSignatureInfo(
  orderId: bigint,
  courierAddress: `0x${string}`
): {
  orderId: string;
  courier: string;
  hourWindow: string;
  expiresIn: string;
} {
  const hourWindow = getCurrentHourWindow();
  const nextHourSeconds = (hourWindow + BigInt(1)) * BigInt(3600);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const secondsRemaining = Number(nextHourSeconds - nowSeconds);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return {
    orderId: orderId.toString(),
    courier: courierAddress,
    hourWindow: hourWindow.toString(),
    expiresIn: `${minutes}m ${seconds}s`,
  };
}
