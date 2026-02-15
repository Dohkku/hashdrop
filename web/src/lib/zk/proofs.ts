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

// Poseidon hasher instance (lazy initialized)
let poseidonInstance: ((inputs: bigint[]) => bigint) | null = null;

/**
 * Initialize the Poseidon hash function from circomlibjs
 * This matches the Poseidon implementation used in circom circuits
 */
async function initPoseidon(): Promise<(inputs: bigint[]) => bigint> {
  if (poseidonInstance) {
    return poseidonInstance;
  }

  // Dynamic import to avoid SSR issues
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();

  poseidonInstance = (inputs: bigint[]): bigint => {
    const hash = poseidon(inputs);
    // Convert F element to bigint
    return poseidon.F.toObject(hash);
  };

  return poseidonInstance;
}

/**
 * Compute Poseidon hash of inputs
 * This matches the hash function used in the circom DeliveryProof circuit
 *
 * @param inputs - Array of bigints to hash
 * @returns The Poseidon hash as a bigint
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const hash = await initPoseidon();
  return hash(inputs);
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

  // Compute Poseidon hash (matches circuit)
  const secretHash = await poseidonHash([secret]);

  return { secret, secretHash };
}

/**
 * Convert a bigint to bytes32 hex string for smart contract
 * @param value - BigInt value
 * @returns bytes32 hex string with 0x prefix
 */
export function bigintToBytes32(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Convert a bytes32 hex string to bigint
 * @param hex - bytes32 hex string with 0x prefix
 * @returns BigInt value
 */
export function bytes32ToBigint(hex: string): bigint {
  return BigInt(hex);
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
  publicSignals: [string, string, string, string];
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
  // Note: The b array needs to be transposed for Solidity
  return {
    proof: {
      a: [proof.pi_a[0], proof.pi_a[1]] as [string, string],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ] as [[string, string], [string, string]],
      c: [proof.pi_c[0], proof.pi_c[1]] as [string, string],
    },
    publicSignals: publicSignals as [string, string, string, string],
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
 * Verify that a secret matches a given hash
 * Used to validate QR code data before generating proof
 *
 * @param secret - The secret from QR code
 * @param expectedHash - The hash stored on-chain
 * @returns true if secret hashes to expectedHash
 */
export async function verifySecretHash(
  secret: bigint,
  expectedHash: bigint
): Promise<boolean> {
  const computedHash = await poseidonHash([secret]);
  return computedHash === expectedHash;
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
    v: 1, // Version for future compatibility
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
  version?: number;
} | null {
  try {
    const json = atob(qrData);
    const payload = JSON.parse(json);
    return {
      secret: BigInt(payload.s),
      orderId: payload.o,
      receiverAddress: payload.r,
      timestamp: payload.t,
      version: payload.v,
    };
  } catch {
    return null;
  }
}

/**
 * Format proof data for smart contract call
 * Converts string arrays to the format expected by the verifier contract
 */
export function formatProofForContract(proof: {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}): {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
} {
  return {
    pA: [BigInt(proof.a[0]), BigInt(proof.a[1])],
    pB: [
      [BigInt(proof.b[0][0]), BigInt(proof.b[0][1])],
      [BigInt(proof.b[1][0]), BigInt(proof.b[1][1])],
    ],
    pC: [BigInt(proof.c[0]), BigInt(proof.c[1])],
  };
}
