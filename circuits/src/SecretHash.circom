pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * SecretHash Circuit
 *
 * Simple circuit to compute Poseidon hash of a secret.
 * Used to generate the secretHash that goes into the smart contract
 * when creating an order.
 *
 * This ensures the same hash function is used both:
 * - When creating the order (off-chain, to compute secretHash)
 * - When proving delivery (in the DeliveryProof circuit)
 */
template SecretHash() {
    signal input secret;
    signal output hash;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;

    hash <== hasher.out;
}

component main = SecretHash();
