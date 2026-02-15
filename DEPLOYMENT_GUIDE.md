# HashDrop Deployment Guide

Steps to deploy HashDrop to Base Sepolia testnet and eventually mainnet.

---

## Prerequisites (Testnet)

You only need 3 things to get a working testnet demo:

### 1. WalletConnect Project ID (~5 min)

Lets users connect wallets (MetaMask, Coinbase Wallet, etc.) to the app.

1. Go to https://cloud.walletconnect.com
2. Sign up (free) with email or GitHub
3. Click "New Project"
4. Name it "HashDrop", select "App" type
5. Copy the **Project ID** (looks like `a1b2c3d4e5f6...`)
6. Set it in `web/.env.local`:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

### 2. Deployment Wallet (~10 min)

A wallet with Base Sepolia testnet ETH to deploy contracts. No real money needed.

1. Install MetaMask browser extension if you don't have it
2. Create a **fresh wallet** for development (never use your personal one)
3. Export the private key: MetaMask > Account Details > Show Private Key
4. Get free testnet ETH: https://www.alchemy.com/faucets/base-sepolia — paste your wallet address
5. Set it in `contracts/.env`:
   ```
   PRIVATE_KEY=your_private_key_here
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   ```

### 3. Treasury & Insurance Pool Addresses

Wallets that receive protocol fees (1%) and insurance fees (0.5%).

- **For testing**: Use the same deployment wallet address for both
- **For production**: Create 2 separate wallets in MetaMask (click "Create Account")
- You only need the public addresses (`0x...`), not private keys

---

## Deploying Contracts

Once you have the above, run:

```bash
cd contracts

# Load environment
source .env

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

This deploys: MockUSDC, ReputationSBT, DeliveryVerifier, HashDropEscrow.

After deployment, copy the contract addresses from the output into:
- `web/src/lib/wagmi.ts` — update the `contractAddresses` object for chain `84532` (Base Sepolia)

---

## Frontend Setup

```bash
cd web

# Install dependencies
npm install

# Create .env.local with your WalletConnect Project ID
echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id" > .env.local

# Run development server
npm run dev
```

Visit http://localhost:3000

---

## Optional Steps

### Basescan API Key (contract verification, ~5 min)

Lets users read contract source code on the block explorer.

1. Go to https://basescan.org
2. Sign up (free)
3. Go to API Keys > Add
4. Copy the key
5. Add to `contracts/.env`:
   ```
   BASESCAN_API_KEY=your_key_here
   ```
6. Verify contracts:
   ```bash
   forge verify-contract <CONTRACT_ADDRESS> src/HashDropEscrow.sol:HashDropEscrow \
     --chain base-sepolia \
     --etherscan-api-key $BASESCAN_API_KEY
   ```

### IPFS / Pinata (encrypted order details)

Order details (addresses, descriptions) are currently stored as base64 in the contract.
For production, use IPFS via Pinata:

1. Sign up at https://www.pinata.cloud (free tier available)
2. Get API key
3. Upload encrypted order details to IPFS, store the CID on-chain

---

## Before Mainnet Launch

These steps are only needed when deploying with real money:

### Security Audit

Hire a firm to review smart contracts for vulnerabilities:
- Options: OpenZeppelin, Trail of Bits, Code4rena, Sherlock
- Budget: $5K-$50K+ depending on scope
- Timeline: 2-6 weeks typically

### Production Trusted Setup Ceremony

The ZK circuit's current setup used a single contributor. For production security:
- Run a multi-party ceremony (snarkjs supports this)
- Or use an established community ceremony (e.g., Hermez's Powers of Tau)
- At least one honest participant makes the system secure

### Mainnet Deployment

```bash
cd contracts

# Use mainnet RPC and real USDC address
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

Update `web/src/lib/wagmi.ts` with mainnet contract addresses (chain `8453`).

### Multisig Setup

For production, the contract owner should be a multisig (e.g., Gnosis Safe) instead of a single wallet. This protects against key compromise.

---

## Architecture Overview

```
User Flow:
  Emitter creates order (deposits USDC + fees)
    -> Courier accepts (deposits 110% collateral)
    -> Emitter signs pickup confirmation
    -> Courier scans receiver's QR code
    -> Browser generates ZK proof (proves knowledge of secret without revealing it)
    -> Proof verified on-chain -> funds released

Contracts:
  HashDropEscrow.sol    - Order lifecycle, fund management
  ReputationSBT.sol     - Soulbound reputation tokens
  DeliveryVerifier.sol  - Groth16 ZK proof verification

Frontend:
  Next.js 14 + Wagmi + RainbowKit + snarkjs (browser ZK proving)

Chain: Base L2 (Ethereum)
Token: USDC (6 decimals)
