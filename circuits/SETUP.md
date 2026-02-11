# HashDrop ZK Circuits

Zero-Knowledge circuits for privacy-preserving delivery verification.

## Prerequisites

1. **Install Circom 2.x**
   ```bash
   # Using cargo (requires Rust)
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom

   # Or download prebuilt binaries from releases:
   # https://github.com/iden3/circom/releases
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

## Build Process

### 1. Compile the circuit
```bash
npm run compile
```
This generates:
- `build/DeliveryProof.r1cs` - Constraint system
- `build/DeliveryProof_js/DeliveryProof.wasm` - WASM for proof generation
- `build/DeliveryProof.sym` - Symbol table for debugging

### 2. Trusted Setup (Powers of Tau + Circuit-specific setup)
```bash
npm run setup
```
This generates:
- `build/pot14_final.ptau` - Powers of Tau ceremony output
- `build/DeliveryProof_final.zkey` - Proving key
- `build/verification_key.json` - Verification key

### 3. Export Solidity Verifier
```bash
npm run export:verifier
```
This generates:
- `../contracts/src/verifiers/DeliveryVerifier.sol`

### 4. Copy artifacts to frontend
```bash
npm run copy:artifacts
```
This copies to `web/public/circuits/`:
- `DeliveryProof.wasm`
- `DeliveryProof_final.zkey`
- `verification_key.json`

## Testing

```bash
npm test
```

## Circuit Details

### DeliveryProof.circom

**Purpose**: Prove knowledge of a delivery secret without revealing it.

**Private Inputs**:
- `secret`: The delivery secret from the receiver's QR code

**Public Inputs**:
- `secretHash`: Hash of the secret stored in the smart contract
- `orderId`: The order ID being delivered
- `courierAddress`: The courier's Ethereum address

**Constraints**:
1. `Poseidon(secret) == secretHash` - Verifies secret knowledge
2. Binds proof to specific order and courier to prevent replay attacks

**Security Properties**:
- Zero-knowledge: Secret is never revealed
- Soundness: Cannot create valid proof without knowing secret
- Non-transferable: Proof is bound to specific courier
- Non-replayable: Proof is bound to specific order

## Trusted Setup Ceremony

For production, run a proper trusted setup ceremony with multiple participants:

1. Generate initial Powers of Tau with multiple contributors
2. Apply random beacon (e.g., Ethereum block hash) for finalization
3. Verify contributions publicly
4. Destroy toxic waste (individual randoms)

## File Structure

```
circuits/
├── src/
│   ├── DeliveryProof.circom   # Main delivery proof circuit
│   └── SecretHash.circom      # Helper for computing secret hash
├── test/
│   └── DeliveryProof.test.js  # Circuit tests
├── build/                      # Generated artifacts (gitignored)
│   ├── DeliveryProof.r1cs
│   ├── DeliveryProof_js/
│   │   └── DeliveryProof.wasm
│   ├── pot14_final.ptau
│   ├── DeliveryProof_final.zkey
│   └── verification_key.json
├── package.json
└── SETUP.md
```
