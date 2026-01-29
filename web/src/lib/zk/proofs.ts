/**
 * Zero-Knowledge Proof utilities for HashDrop
 *
 * Uses snarkjs to generate and verify proofs in the browser.
 * The proofs are Groth16 proofs over the BN254 curve.
 */

// Types for snarkjs
interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
}

// Poseidon hash implementation (matches circomlib)
// We need this to compute the secretHash off-chain
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  // In production, use the actual circomlibjs poseidon
  // For now, we'll use a simple keccak256 fallback
  // TODO: Import circomlibjs poseidon for proper implementation
  const { keccak256, encodePacked } = await import("viem");

  const packed = encodePacked(
    inputs.map(() => "uint256" as const),
    inputs
  );
  const hash = keccak256(packed);

  // Convert to field element (mod p for BN254)
  const p = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );
  return BigInt(hash) % p;
}

/**
 * Generate a random secret for delivery
 * Returns both the secret and its Poseidon hash
 */
export async function generateDeliverySecret(): Promise<{
  secret: bigint;
  secretHash: bigint;
}> {
  // Generate random bytes
  const randomBytes = new Uint8Array(31); // 31 bytes to stay under field prime
  crypto.getRandomValues(randomBytes);

  // Convert to bigint
  let secret = BigInt(0);
  for (let i = 0; i < randomBytes.length; i++) {
    secret = (secret << BigInt(8)) | BigInt(randomBytes[i]);
  }

  // Compute hash
  const secretHash = await poseidonHash([secret]);

  return { secret, secretHash };
}

/**
 * Generate a ZK proof of delivery
 *
 * @param secret - The secret from the receiver's QR code
 * @param secretHash - The hash stored in the smart contract
 * @param orderId - The order being delivered
 * @param courierAddress - The courier's address
 * @returns The proof and public signals
 */
export async function generateDeliveryProof(
  secret: bigint,
  secretHash: bigint,
  orderId: bigint,
  courierAddress: string
): Promise<{
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: [string, string, string];
}> {
  // Dynamically import snarkjs (it's heavy, only load when needed)
  const snarkjs = await import("snarkjs");

  // Load the circuit artifacts
  // These should be served from /public or a CDN
  const wasmPath = "/circuits/DeliveryProof.wasm";
  const zkeyPath = "/circuits/DeliveryProof_final.zkey";

  // Prepare inputs
  const input = {
    secret: secret.toString(),
    secretHash: secretHash.toString(),
    orderId: orderId.toString(),
    courierAddress: BigInt(courierAddress).toString(),
  };

  // Generate the proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  // Format proof for Solidity verifier
  return {
    proof: {
      a: [proof.pi_a[0], proof.pi_a[1]] as [string, string],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ] as [[string, string], [string, string]],
      c: [proof.pi_c[0], proof.pi_c[1]] as [string, string],
    },
    publicSignals: publicSignals as [string, string, string],
  };
}

/**
 * Verify a proof locally (for testing/debugging)
 */
export async function verifyProof(
  proof: ProofResult["proof"],
  publicSignals: string[]
): Promise<boolean> {
  const snarkjs = await import("snarkjs");

  // Load verification key
  const vkeyPath = "/circuits/verification_key.json";
  const response = await fetch(vkeyPath);
  const vkey = await response.json();

  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Format a bigint secret for display in QR code
 */
export function secretToQRData(
  secret: bigint,
  orderId: string,
  receiverAddress: string
): string {
  const payload = {
    s: secret.toString(),
    o: orderId,
    r: receiverAddress,
    t: Date.now(),
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Parse secret from QR code data
 */
export function parseQRData(qrData: string): {
  secret: bigint;
  orderId: string;
  receiverAddress: string;
  timestamp: number;
} | null {
  try {
    const json = atob(qrData);
    const payload = JSON.parse(json);
    return {
      secret: BigInt(payload.s),
      orderId: payload.o,
      receiverAddress: payload.r,
      timestamp: payload.t,
    };
  } catch {
    return null;
  }
}
