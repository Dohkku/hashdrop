# HashDrop Smart Contracts

Contratos inteligentes para el sistema de delivery P2P descentralizado.

## Requisitos

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Instalacion

### 1. Instalar Foundry (si no lo tienes)

**Windows (PowerShell):**
```powershell
# Instalar foundryup
curl -L https://foundry.paradigm.xyz | bash

# Reiniciar terminal y ejecutar
foundryup
```

**O usando cargo:**
```bash
cargo install --git https://github.com/foundry-rs/foundry --profile local forge cast anvil chisel
```

### 2. Instalar dependencias

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

### 3. Compilar

```bash
forge build
```

### 4. Ejecutar tests

```bash
# Todos los tests
forge test

# Con verbosidad
forge test -vvv

# Test especifico
forge test --match-test test_CreateOrder -vvv

# Con gas report
forge test --gas-report
```

## Estructura

```
contracts/
├── src/
│   ├── HashDropEscrow.sol      # Contrato principal de escrow
│   ├── ReputationSBT.sol       # Tokens de reputacion (Soulbound)
│   ├── interfaces/
│   │   ├── IHashDropEscrow.sol
│   │   ├── IReputationSBT.sol
│   │   └── IDeliveryVerifier.sol
│   └── mocks/
│       └── MockUSDC.sol        # Mock para tests
├── test/
│   ├── HashDropEscrow.t.sol
│   └── ReputationSBT.t.sol
├── script/
│   └── Deploy.s.sol
└── foundry.toml
```

## Contratos

### HashDropEscrow.sol

Contrato principal que gestiona:
- Creacion de ordenes de envio
- Deposito de fondos y colateral
- Confirmacion de recogida y entrega
- Liberacion de fondos
- Gestion de disputas

**Constantes:**
- `PROTOCOL_FEE_BPS`: 100 (1%)
- `INSURANCE_FEE_BPS`: 50 (0.5%)
- `COLLATERAL_MULTIPLIER_BPS`: 11000 (110%)
- `ORDER_EXPIRY`: 24 horas
- `PICKUP_TIMEOUT`: 2 horas
- `DELIVERY_TIMEOUT`: 6 horas

### ReputationSBT.sol

Token Soulbound (intransferible) para reputacion:
- Score inicial: 100
- Score maximo: 1000
- Decay: 5% cada 30 dias de inactividad
- Penalizacion por fallo: -50 puntos
- Penalizacion por disputa: -200 puntos

## Deploy

### Testnet (Base Sepolia)

```bash
# Copiar y configurar .env
cp .env.example .env
# Editar .env con tu private key

# Deploy
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

### Mainnet (Base)

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

## Flujo de una Orden

```
1. Emisor -> createOrder()
   - Deposita: packageValue + deliveryFee + fees
   - Estado: OPEN

2. Mensajero -> acceptOrder()
   - Deposita: colateral (110% de packageValue)
   - Estado: LOCKED

3. Mensajero -> confirmPickup()
   - Requiere firma del emisor
   - Estado: PICKED_UP

4. Mensajero -> confirmDelivery()
   - Requiere secreto del receptor
   - Estado: DELIVERED
   - Fondos liberados
```

## Seguridad

- ReentrancyGuard en todas las funciones con transferencias
- SafeERC20 para transferencias de tokens
- AccessControl para roles administrativos
- Pausable para emergencias
- Verificacion de firmas ECDSA

## Gas Estimates

| Funcion | Gas Estimado |
|---------|-------------|
| createOrder | ~150,000 |
| acceptOrder | ~100,000 |
| confirmPickup | ~80,000 |
| confirmDelivery | ~120,000 |

## Auditoría

- [ ] Pendiente auditoria externa
- [x] Tests unitarios
- [x] Fuzz testing
- [ ] Invariant testing
