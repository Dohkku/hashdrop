# HashDrop

Decentralized peer-to-peer delivery platform built on blockchain. No intermediaries, no 30% fees - just secure, trustless deliveries.

## What is HashDrop?

HashDrop replaces centralized delivery platforms (Uber Eats, Glovo, DoorDash) with a trustless protocol. Instead of relying on a company to mediate disputes and take a cut, we use:

- **Smart contract escrow** - Funds are locked until delivery is verified
- **Zero-Knowledge proofs** - Prove delivery happened without revealing secrets
- **Symmetric collateral** - Couriers stake 110% collateral, ensuring honest behavior
- **Soulbound reputation** - Non-transferable reputation tokens track reliability

### Fee Comparison

| Platform | Fee |
|----------|-----|
| Traditional apps | 20-30% |
| **HashDrop** | **1.5%** (1% protocol + 0.5% insurance) |

## How It Works

```
1. Sender creates order, deposits USDC into escrow
2. Courier accepts job, stakes 110% collateral
3. Physical delivery with QR code handshake
4. Courier submits ZK proof of delivery
5. Smart contract releases funds automatically
```

## Project Structure

```
hashdrop/
├── contracts/     # Solidity smart contracts (Foundry)
├── circuits/      # Zero-Knowledge circuits (Circom)
└── web/           # Frontend application (Next.js)
```

## Tech Stack

- **Blockchain**: Solidity, Foundry, OpenZeppelin, Base L2
- **ZK Proofs**: Circom, snarkjs, Groth16/BN254
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Web3**: Wagmi, Viem, RainbowKit

## Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Installation

```bash
# Clone and install
git clone https://github.com/Dohkku/hashdrop.git
cd hashdrop

# Install all dependencies
npm install
cd contracts && forge install && cd ..
cd circuits && npm install && cd ..
cd web && npm install && cd ..
```

### Development

```bash
# Run web app
cd web
cp .env.example .env.local  # Add your WalletConnect project ID
npm run dev

# Run contract tests
cd contracts
forge test -vvv

# Compile ZK circuits
cd circuits
npm run compile
npm run setup
```

### Environment Variables

Create `contracts/.env`:
```env
PRIVATE_KEY=your_private_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_api_key
```

Create `web/.env.local`:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `HashDropEscrow` | Order management, collateral, payment distribution |
| `ReputationSBT` | Soulbound reputation tokens with time decay |

See [contracts/README.md](contracts/README.md) for details.

## ZK Circuits

The `DeliveryProof` circuit proves a courier knows the delivery secret (from receiver's QR code) without revealing it.

See [circuits/README.md](circuits/README.md) for details.

## Deployment

### Testnet (Base Sepolia)

```bash
cd contracts
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast --verify
```

### Mainnet (Base)

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_RPC_URL \
  --broadcast --verify
```

## Security

- Reentrancy guards on all fund transfers
- SafeERC20 for token operations
- Role-based access control
- Emergency pause functionality
- ZK proofs prevent replay attacks

**Status**: Pending external audit
