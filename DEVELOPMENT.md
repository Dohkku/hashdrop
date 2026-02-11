# HashDrop Development Guide

## Project Structure

```
hashdrop/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/           # Contract source files
│   ├── test/          # Unit and integration tests
│   └── script/        # Deployment scripts
├── circuits/          # Zero-Knowledge circuits (Circom)
│   ├── src/           # Circuit source files
│   ├── test/          # Circuit tests
│   └── build/         # Generated artifacts (gitignored)
└── web/               # Frontend (Next.js + React)
    ├── src/           # Application source
    ├── e2e/           # Playwright E2E tests
    └── public/        # Static assets
```

## Prerequisites

- Node.js 18+
- Foundry (forge, cast, anvil)
- Circom 2.x (for ZK circuits)

## Quick Start

### 1. Install Dependencies

```bash
# Root
npm install

# Contracts
cd contracts && forge install

# Circuits
cd circuits && npm install

# Web
cd web && npm install
```

### 2. Run Contract Tests

```bash
cd contracts
forge test -vv
```

All 72 tests should pass:
- HashDropEscrowTest: 24 tests
- ReputationSBTTest: 20 tests
- FullLifecycleTest: 9 tests
- ReputationIntegrationTest: 12 tests
- ZKProofIntegrationTest: 7 tests

### 3. Build Web Application

```bash
cd web
npm run build
npm run dev
```

## ZK Circuit Setup

### Install Circom 2.x

```bash
# Using cargo (requires Rust)
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Or download prebuilt binaries:
# https://github.com/iden3/circom/releases
```

### Compile and Setup Circuits

```bash
cd circuits

# 1. Compile circuit to R1CS and WASM
npm run compile

# 2. Generate trusted setup (Powers of Tau + zkey)
npm run setup

# 3. Export Solidity verifier
npm run export:verifier

# 4. Copy artifacts to web/public
npm run copy:artifacts

# 5. Run circuit tests
npm test
```

## Environment Configuration

### Web (.env)

Create `web/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Contracts (.env)

Create `contracts/.env`:

```env
PRIVATE_KEY=your_deployer_private_key
BASESCAN_API_KEY=your_basescan_api_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

## Deployment

### Deploy to Base Sepolia

```bash
cd contracts

# Deploy with MockUSDC (testnet)
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Update addresses in web/src/lib/wagmi.ts
```

### Required Addresses

Before mainnet deploy, you need:
- **Treasury Address**: Receives 1% protocol fee
- **Insurance Pool Address**: Receives 0.5% insurance fee

## E2E Testing

### Setup Playwright

```bash
cd web
npx playwright install
```

### Run Tests

```bash
npm test              # Run all tests
npm run test:ui       # Run with UI
npm run test:headed   # Run in headed mode
```

## Architecture

### Smart Contracts

- **HashDropEscrow.sol**: Main escrow contract
  - Order lifecycle management
  - Fund distribution
  - Dispute resolution

- **ReputationSBT.sol**: Soulbound reputation tokens
  - Non-transferable ERC721
  - Score-based system (0-1000)
  - Time decay mechanism

- **DeliveryVerifier.sol**: ZK proof verifier
  - Groth16 verification
  - Generated from circuit

### ZK Circuits

- **DeliveryProof.circom**: Proves knowledge of delivery secret
  - Private input: secret
  - Public inputs: secretHash, orderId, courierAddress
  - Prevents replay attacks via binding

### Frontend

- **Next.js 14** with App Router
- **wagmi/viem** for Web3 interactions
- **RainbowKit** for wallet connection
- **snarkjs** for proof generation

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Protocol Fee | 1% | Fee to treasury |
| Insurance Fee | 0.5% | Fee to insurance pool |
| Collateral | 110% | Required courier collateral |
| Order Expiry | 24 hours | Time before order expires |
| Pickup Timeout | 2 hours | Time to confirm pickup |
| Delivery Timeout | 6 hours | Time to complete delivery |
| Min Courier Score | 50 | Minimum reputation to accept orders |
| Initial Score | 100 | Starting reputation score |
| Max Score | 1000 | Maximum reputation score |
| Decay Rate | 5% / 30 days | Reputation decay for inactivity |

## Test Coverage

### Contract Tests

- **Unit Tests**: Individual function testing
- **Integration Tests**: Full lifecycle flows
- **Fuzz Tests**: Property-based testing
- **ZK Integration**: Proof verification tests

### E2E Tests

- Order creation flow
- Courier acceptance flow
- Pickup confirmation
- Delivery completion
- Dispute handling
- Navigation and UI

## Troubleshooting

### "Module not found: pino-pretty"

This is a warning from WalletConnect dependencies. It doesn't affect the build.

### "Circom not found"

Install Circom 2.x following the instructions above. The npm package `circom` is v0.5.x (deprecated).

### Contract tests failing

Ensure you have the latest Foundry:
```bash
foundryup
```

## Contributing

1. Write tests first (TDD approach)
2. Run all tests before committing
3. Follow existing code style
4. Update documentation as needed
