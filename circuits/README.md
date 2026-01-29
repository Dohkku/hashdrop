# HashDrop ZK Circuits

Zero-Knowledge circuits for the HashDrop delivery verification system.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- [Circom](https://docs.circom.io/getting-started/installation/) v2.1+
- [snarkjs](https://github.com/iden3/snarkjs)

## Installation

```bash
# Install circom (if not installed)
# On Windows, download from https://github.com/iden3/circom/releases

# Install dependencies
npm install
```

## Circuits

### DeliveryProof.circom

Proves that a courier knows the delivery secret without revealing it.

**Inputs:**
- `secret` (private): The secret from the receiver's QR code
- `secretHash` (public): Hash stored in the smart contract
- `orderId` (public): Order being delivered
- `courierAddress` (public): Courier's address

**Verification:**
1. Poseidon(secret) == secretHash
2. Proof is bound to specific order and courier

### SecretHash.circom

Simple circuit to compute Poseidon hash of a secret (for off-chain use).

## Building

```bash
# Create build directory
mkdir -p build

# Compile circuits
npm run compile

# Generate trusted setup (takes a few minutes)
npm run setup

# Export Solidity verifier
npm run export:verifier
```

## Files Generated

After building:
```
build/
├── DeliveryProof.r1cs          # Circuit constraints
├── DeliveryProof.wasm          # WASM for browser
├── DeliveryProof.sym           # Symbols for debugging
├── pot14_final.ptau            # Powers of Tau (trusted setup)
├── DeliveryProof_final.zkey    # Proving key
└── verification_key.json       # Verification key
```

## Using in Browser

Copy to your web app's public folder:
```bash
cp build/DeliveryProof.wasm ../web/public/circuits/
cp build/DeliveryProof_final.zkey ../web/public/circuits/
cp build/verification_key.json ../web/public/circuits/
```

## Security Notes

- The trusted setup uses a simple ceremony for development
- For production, use a multi-party computation ceremony
- Never reuse the same ceremony parameters across different projects
