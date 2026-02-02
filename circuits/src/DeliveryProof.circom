pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

/*
 * DeliveryProof Circuit
 *
 * Proves that the courier knows a secret that hashes to a known hash,
 * without revealing the secret itself.
 *
 * This is used to verify delivery: the receiver shows a QR code containing
 * the secret, the courier scans it, generates a ZK proof, and submits
 * the proof on-chain. The smart contract verifies the proof without
 * ever seeing the actual secret.
 *
 * Inputs:
 *   - secret (private): The delivery secret from the receiver's QR code
 *   - secretHash (public): The hash of the secret stored in the smart contract
 *   - orderId (public): The order ID being delivered
 *   - courierAddress (public): The courier's address (prevents proof stealing)
 *
 * The circuit verifies:
 *   1. Poseidon(secret) == secretHash
 *   2. The proof is bound to a specific order and courier
 */
template DeliveryProof() {
    // Private inputs
    signal input secret;

    // Public inputs
    signal input secretHash;
    signal input orderId;
    signal input courierAddress;

    // Output
    signal output valid;

    // Hash the secret using Poseidon (efficient for ZK circuits)
    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;

    // Verify the hash matches
    component isEqual = IsEqual();
    isEqual.in[0] <== hasher.out;
    isEqual.in[1] <== secretHash;

    // The proof is valid if the hash matches
    valid <== isEqual.out;

    // Constrain that valid must be 1 (proof fails if hash doesn't match)
    valid === 1;

    // Bind the proof to the order and courier (prevents replay attacks)
    // These are just constrained to exist as public inputs
    signal orderIdSquared;
    orderIdSquared <== orderId * orderId;

    signal courierSquared;
    courierSquared <== courierAddress * courierAddress;
}

component main {public [secretHash, orderId, courierAddress]} = DeliveryProof();
