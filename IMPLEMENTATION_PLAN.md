# HASHDROP - Plan de Implementación Técnica

## Índice
1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Zero-Knowledge Proofs - Implementación](#4-zero-knowledge-proofs---implementación)
5. [Smart Contracts - Diseño Detallado](#5-smart-contracts---diseño-detallado)
6. [Aplicación Móvil](#6-aplicación-móvil)
7. [Privacidad y Seguridad](#7-privacidad-y-seguridad)
8. [Infraestructura Descentralizada](#8-infraestructura-descentralizada)
9. [Sistema de Identidad ZK](#9-sistema-de-identidad-zk)
10. [Fases de Desarrollo](#10-fases-de-desarrollo)
11. [Testing y Auditoría](#11-testing-y-auditoría)
12. [Consideraciones Legales](#12-consideraciones-legales)
13. [Estimación de Costos](#13-estimación-de-costos)

---

## 1. Resumen Ejecutivo

**HashDrop** es una plataforma de delivery P2P descentralizada que elimina intermediarios mediante:
- Smart contracts para escrow automático
- Zero-Knowledge Proofs para privacidad total
- Staking/Slashing para garantizar comportamiento honesto
- Identidad soberana anti-Sybil

### Principios Fundamentales
```
┌─────────────────────────────────────────────────────────────┐
│                    PILARES DE HASHDROP                      │
├─────────────────────────────────────────────────────────────┤
│  🔐 PRIVACIDAD    │  Nadie ve datos que no necesita ver    │
│  🛡️  SEGURIDAD    │  Matemática > Confianza                │
│  ⚖️  EQUIDAD      │  Incentivos alineados para todos       │
│  🌐 RESISTENCIA   │  Sin punto único de fallo              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAPA DE USUARIO                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   EMISOR    │    │  MENSAJERO  │    │  RECEPTOR   │                     │
│  │    App      │    │    App      │    │    App      │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
└─────────┼──────────────────┼──────────────────┼─────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE PRIVACIDAD (ZK)                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  • Generación de pruebas ZK en dispositivo (cliente)                 │  │
│  │  • Cifrado E2E de metadatos                                          │  │
│  │  • Identidad ZK (Polygon ID / Semaphore)                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE APLICACIÓN                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  Order Book    │  │  Matching      │  │  Reputation    │                │
│  │  (Off-chain)   │  │  Engine (MPC)  │  │  (SBT)         │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE BLOCKCHAIN                                  │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    ARBITRUM / BASE (L2)                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │    │
│  │  │   Escrow     │  │  Reputation  │  │  Dispute     │             │    │
│  │  │   Contract   │  │  SBT         │  │  Resolution  │             │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE ALMACENAMIENTO                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  IPFS/Filecoin │  │  Ceramic      │  │  Local         │                │
│  │  (Metadatos    │  │  (Streams     │  │  (Datos        │                │
│  │   cifrados)    │  │   privados)   │  │   sensibles)   │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos con Privacidad

```
EMISOR                          BLOCKCHAIN                      MENSAJERO
  │                                 │                               │
  │ 1. Crear orden                  │                               │
  │    - Genera secretHash          │                               │
  │    - Cifra detalles (IPFS)      │                               │
  │    - Deposita fondos            │                               │
  ├────────────────────────────────►│                               │
  │                                 │                               │
  │                                 │ 2. Orden visible              │
  │                                 │    (solo: zona, fee, valor)   │
  │                                 │◄──────────────────────────────┤
  │                                 │                               │
  │                                 │ 3. Acepta + Stake             │
  │                                 │◄──────────────────────────────┤
  │                                 │                               │
  │ 4. Revela ubicación pickup      │                               │
  │    (solo al mensajero)          │                               │
  ├─────────────────────────────────┼──────────────────────────────►│
  │                                 │                               │
  │                                 │ 5. ZK-Proof de entrega        │
  │                                 │◄──────────────────────────────┤
  │                                 │                               │
  │                                 │ 6. Fondos liberados           │
  │                                 │───────────────────────────────►
```

---

## 3. Stack Tecnológico

### 3.1 Blockchain y Smart Contracts

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **L2 Principal** | **Base** (Coinbase L2) | Fees bajos (~$0.01), gran adopción, on-ramp fiat fácil |
| **L2 Alternativo** | Arbitrum One | Ecosistema maduro, más TVL |
| **Lenguaje SC** | Solidity 0.8.24+ | Estándar, tooling maduro |
| **Framework** | Foundry | Testing rápido, fuzzing nativo |
| **Librería** | OpenZeppelin 5.x | Contratos auditados |
| **ZK Verifier** | Groth16 / PLONK | Verificación on-chain eficiente |

### 3.2 Zero-Knowledge Stack

| Componente | Tecnología | Uso |
|------------|------------|-----|
| **Circuitos ZK** | **Circom 2.1** + snarkjs | Pruebas de entrega, matching privado |
| **Identidad ZK** | **Polygon ID** | Verificación de humanidad sin revelar datos |
| **Alternativa ID** | Semaphore | Grupos anónimos, más simple |
| **Pruebas cliente** | snarkjs (WASM) | Generación en móvil |
| **MPC** | **Lit Protocol** | Cálculos privados multi-parte |

### 3.3 Aplicación Móvil

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **Framework** | **React Native + Expo** | Cross-platform, desarrollo rápido |
| **Wallet Integration** | WalletConnect v2 + wagmi | Estándar de conexión Web3 |
| **Estado** | Zustand + React Query | Ligero, buen soporte offline |
| **Navegación** | Expo Router | File-based routing |
| **UI** | Tamagui | Performance nativa, temas |
| **Mapas** | react-native-maps | Visualización de zonas |
| **QR** | react-native-vision-camera | Escaneo rápido |
| **Crypto** | ethers.js v6 | Interacción con contratos |
| **ZK Client** | snarkjs (WASM) | Generación de pruebas |

### 3.4 Almacenamiento Descentralizado

| Componente | Tecnología | Uso |
|------------|------------|-----|
| **Metadatos cifrados** | **IPFS + Pinata** | Detalles de paquete, fotos |
| **Streams privados** | Ceramic Network | Historial de órdenes |
| **Indexación** | The Graph | Eventos de contratos |
| **Cache local** | MMKV | Datos sensibles en dispositivo |

### 3.5 Infraestructura

| Componente | Tecnología | Uso |
|------------|------------|-----|
| **RPC Nodes** | Alchemy / Infura | Conexión a L2 |
| **Relayer** | Gelato / OpenZeppelin Defender | Meta-transactions |
| **Oráculos** | Chainlink | Precios USDC/ETH |
| **Dispute** | Kleros | Arbitraje descentralizado |

---

## 4. Zero-Knowledge Proofs - Implementación

### 4.1 Circuitos ZK Necesarios

#### Circuito 1: Prueba de Entrega (DeliveryProof.circom)

```circom
// circuits/DeliveryProof.circom
pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template DeliveryProof() {
    // Inputs privados (solo el mensajero los conoce)
    signal input secret;           // Secreto del QR del receptor
    signal input courierPrivKey;   // Clave privada del mensajero
    signal input timestamp;        // Momento de entrega

    // Inputs públicos (verificables on-chain)
    signal input secretHash;       // Hash del secreto (del contrato)
    signal input orderId;          // ID de la orden
    signal input courierAddress;   // Dirección del mensajero

    // Output
    signal output valid;

    // 1. Verificar que el secreto coincide con el hash
    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;

    component isEqual = IsEqual();
    isEqual.in[0] <== hasher.out;
    isEqual.in[1] <== secretHash;

    // 2. Verificar que el timestamp es válido (dentro de ventana)
    // ... lógica adicional

    valid <== isEqual.out;
}

component main {public [secretHash, orderId, courierAddress]} = DeliveryProof();
```

#### Circuito 2: Matching Privado (PrivateMatching.circom)

```circom
// circuits/PrivateMatching.circom
pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template PrivateMatching() {
    // Inputs privados
    signal input courierLat;       // Latitud del mensajero (escalada)
    signal input courierLon;       // Longitud del mensajero
    signal input pickupLat;        // Latitud de recogida
    signal input pickupLon;        // Longitud de entrega

    // Inputs públicos
    signal input maxDistanceSquared;  // Distancia máxima permitida^2
    signal input zoneCommitment;      // Compromiso de la zona

    // Output
    signal output withinRange;

    // Calcular distancia euclidiana al cuadrado (simplificado)
    signal diffLat <== courierLat - pickupLat;
    signal diffLon <== courierLon - pickupLon;
    signal distSquared <== diffLat * diffLat + diffLon * diffLon;

    // Verificar que está dentro del rango
    component lessThan = LessThan(64);
    lessThan.in[0] <== distSquared;
    lessThan.in[1] <== maxDistanceSquared;

    withinRange <== lessThan.out;
}

component main {public [maxDistanceSquared, zoneCommitment]} = PrivateMatching();
```

### 4.2 Generación de Pruebas en Cliente

```typescript
// src/lib/zkProofs.ts
import * as snarkjs from 'snarkjs';

interface DeliveryProofInput {
  secret: string;
  courierPrivKey: string;
  timestamp: number;
  secretHash: string;
  orderId: string;
  courierAddress: string;
}

export async function generateDeliveryProof(
  input: DeliveryProofInput
): Promise<{ proof: any; publicSignals: string[] }> {
  // Cargar circuito compilado (WASM) y clave de prueba
  const wasmPath = require('../circuits/DeliveryProof.wasm');
  const zkeyPath = require('../circuits/DeliveryProof_final.zkey');

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      secret: BigInt(input.secret),
      courierPrivKey: BigInt(input.courierPrivKey),
      timestamp: input.timestamp,
      secretHash: input.secretHash,
      orderId: input.orderId,
      courierAddress: input.courierAddress,
    },
    wasmPath,
    zkeyPath
  );

  return { proof, publicSignals };
}

export function formatProofForContract(proof: any): {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
} {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}
```

### 4.3 Verificación On-Chain

```solidity
// contracts/verifiers/DeliveryVerifier.sol
// Auto-generado por snarkjs desde el circuito
// Este contrato verifica pruebas Groth16

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeliveryVerifier {
    // Parámetros de la curva BN254
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Puntos de verificación (generados por trusted setup)
    // ... (generados automáticamente por snarkjs)

    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals  // secretHash, orderId, courierAddress
    ) public view returns (bool) {
        // Verificación de pairing
        // ... (generado automáticamente)
        return true;
    }
}
```

---

## 5. Smart Contracts - Diseño Detallado

### 5.1 Estructura de Contratos

```
contracts/
├── core/
│   ├── HashDropEscrow.sol       # Contrato principal de escrow
│   ├── OrderBook.sol            # Gestión de órdenes
│   └── PaymentProcessor.sol     # Lógica de pagos y fees
├── identity/
│   ├── ReputationSBT.sol        # Soulbound tokens de reputación
│   └── ZKIdentityVerifier.sol   # Verificación de identidad ZK
├── dispute/
│   ├── DisputeManager.sol       # Gestión de disputas
│   └── KlerosConnector.sol      # Integración con Kleros
├── verifiers/
│   ├── DeliveryVerifier.sol     # Verificador ZK de entrega
│   └── MatchingVerifier.sol     # Verificador ZK de matching
├── governance/
│   └── HashDropDAO.sol          # Gobernanza del protocolo
└── libraries/
    ├── OrderLib.sol             # Estructuras y helpers
    └── FeeCalculator.sol        # Cálculo de fees
```

### 5.2 Contrato Principal: HashDropEscrow.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./verifiers/DeliveryVerifier.sol";
import "./identity/ReputationSBT.sol";

contract HashDropEscrow is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant INSURANCE_FEE_BPS = 50; // 0.5%
    uint256 public constant COLLATERAL_MULTIPLIER = 110; // 110% del valor
    uint256 public constant ORDER_TIMEOUT = 24 hours;
    uint256 public constant PICKUP_TIMEOUT = 2 hours;

    // ============ State Variables ============
    IERC20 public immutable stablecoin;
    DeliveryVerifier public immutable verifier;
    ReputationSBT public immutable reputation;

    address public treasury;
    address public insurancePool;

    uint256 public nextOrderId;

    // ============ Enums ============
    enum OrderState {
        OPEN,           // Orden creada, esperando mensajero
        LOCKED,         // Mensajero aceptó, fondos bloqueados
        PICKED_UP,      // Paquete recogido
        DELIVERED,      // Entrega confirmada con ZK-proof
        DISPUTED,       // En disputa
        CANCELLED,      // Cancelada
        EXPIRED         // Tiempo expirado
    }

    // ============ Structs ============
    struct Order {
        // Participantes
        address emitter;
        address courier;
        address receiver;

        // Valores
        uint256 packageValue;
        uint256 deliveryFee;
        uint256 courierCollateral;

        // Estado
        OrderState state;
        uint256 createdAt;
        uint256 lockedAt;
        uint256 pickedUpAt;

        // ZK
        bytes32 secretHash;
        bytes32 deliveryZoneHash;

        // Metadatos (IPFS CID cifrado)
        string encryptedDetailsCID;
    }

    // ============ Mappings ============
    mapping(uint256 => Order) public orders;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256[]) public userOrders;

    // ============ Events ============
    event OrderCreated(
        uint256 indexed orderId,
        address indexed emitter,
        address indexed receiver,
        uint256 packageValue,
        uint256 deliveryFee,
        bytes32 deliveryZoneHash
    );

    event OrderAccepted(
        uint256 indexed orderId,
        address indexed courier,
        uint256 collateral
    );

    event PackagePickedUp(
        uint256 indexed orderId,
        uint256 timestamp
    );

    event OrderDelivered(
        uint256 indexed orderId,
        uint256 timestamp
    );

    event OrderDisputed(
        uint256 indexed orderId,
        address indexed initiator,
        string reason
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed canceller
    );

    event FundsReleased(
        uint256 indexed orderId,
        address indexed recipient,
        uint256 amount
    );

    // ============ Errors ============
    error InvalidState(OrderState current, OrderState expected);
    error Unauthorized();
    error InsufficientFunds();
    error InvalidProof();
    error OrderExpired();
    error ZeroAddress();

    // ============ Constructor ============
    constructor(
        address _stablecoin,
        address _verifier,
        address _reputation,
        address _treasury,
        address _insurancePool
    ) {
        if (_stablecoin == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }

        stablecoin = IERC20(_stablecoin);
        verifier = DeliveryVerifier(_verifier);
        reputation = ReputationSBT(_reputation);
        treasury = _treasury;
        insurancePool = _insurancePool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ Core Functions ============

    /// @notice Crear una nueva orden de envío
    /// @param _receiver Dirección del receptor
    /// @param _packageValue Valor declarado del paquete
    /// @param _deliveryFee Fee para el mensajero
    /// @param _secretHash Hash del secreto que tendrá el receptor
    /// @param _deliveryZoneHash Hash de la zona de entrega (privacidad)
    /// @param _encryptedDetailsCID IPFS CID de los detalles cifrados
    function createOrder(
        address _receiver,
        uint256 _packageValue,
        uint256 _deliveryFee,
        bytes32 _secretHash,
        bytes32 _deliveryZoneHash,
        string calldata _encryptedDetailsCID
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        if (_receiver == address(0)) revert ZeroAddress();

        // Calcular total que deposita el emisor
        uint256 protocolFee = (_packageValue * PROTOCOL_FEE_BPS) / 10000;
        uint256 insuranceFee = (_packageValue * INSURANCE_FEE_BPS) / 10000;
        uint256 totalDeposit = _packageValue + _deliveryFee + protocolFee + insuranceFee;

        // Transferir fondos al contrato
        stablecoin.safeTransferFrom(msg.sender, address(this), totalDeposit);

        // Distribuir fees inmediatamente
        stablecoin.safeTransfer(treasury, protocolFee);
        stablecoin.safeTransfer(insurancePool, insuranceFee);

        orderId = nextOrderId++;

        orders[orderId] = Order({
            emitter: msg.sender,
            courier: address(0),
            receiver: _receiver,
            packageValue: _packageValue,
            deliveryFee: _deliveryFee,
            courierCollateral: 0,
            state: OrderState.OPEN,
            createdAt: block.timestamp,
            lockedAt: 0,
            pickedUpAt: 0,
            secretHash: _secretHash,
            deliveryZoneHash: _deliveryZoneHash,
            encryptedDetailsCID: _encryptedDetailsCID
        });

        userOrders[msg.sender].push(orderId);
        userOrders[_receiver].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            _receiver,
            _packageValue,
            _deliveryFee,
            _deliveryZoneHash
        );
    }

    /// @notice Mensajero acepta una orden y deposita colateral
    /// @param _orderId ID de la orden
    function acceptOrder(uint256 _orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[_orderId];

        if (order.state != OrderState.OPEN) {
            revert InvalidState(order.state, OrderState.OPEN);
        }

        if (block.timestamp > order.createdAt + ORDER_TIMEOUT) {
            order.state = OrderState.EXPIRED;
            revert OrderExpired();
        }

        // Calcular colateral requerido (110% del valor del paquete)
        uint256 collateral = (order.packageValue * COLLATERAL_MULTIPLIER) / 100;

        // Verificar reputación mínima del mensajero
        require(
            reputation.getReputationScore(msg.sender) >= reputation.minCourierScore(),
            "Reputation too low"
        );

        // Transferir colateral
        stablecoin.safeTransferFrom(msg.sender, address(this), collateral);

        order.courier = msg.sender;
        order.courierCollateral = collateral;
        order.state = OrderState.LOCKED;
        order.lockedAt = block.timestamp;

        userOrders[msg.sender].push(_orderId);

        emit OrderAccepted(_orderId, msg.sender, collateral);
    }

    /// @notice Confirmar recogida del paquete (firma del emisor)
    /// @param _orderId ID de la orden
    /// @param _signature Firma del emisor confirmando recogida
    function confirmPickup(
        uint256 _orderId,
        bytes calldata _signature
    ) external nonReentrant {
        Order storage order = orders[_orderId];

        if (order.state != OrderState.LOCKED) {
            revert InvalidState(order.state, OrderState.LOCKED);
        }
        if (msg.sender != order.courier) revert Unauthorized();

        // Verificar firma del emisor
        bytes32 message = keccak256(
            abi.encodePacked(_orderId, "PICKUP", block.timestamp / 3600)
        );
        address signer = _recoverSigner(message, _signature);
        require(signer == order.emitter, "Invalid emitter signature");

        order.state = OrderState.PICKED_UP;
        order.pickedUpAt = block.timestamp;

        emit PackagePickedUp(_orderId, block.timestamp);
    }

    /// @notice Confirmar entrega con ZK-proof
    /// @param _orderId ID de la orden
    /// @param _proof Prueba ZK de entrega
    /// @param _pubSignals Señales públicas de la prueba
    function confirmDelivery(
        uint256 _orderId,
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external nonReentrant {
        Order storage order = orders[_orderId];

        if (order.state != OrderState.PICKED_UP) {
            revert InvalidState(order.state, OrderState.PICKED_UP);
        }
        if (msg.sender != order.courier) revert Unauthorized();

        // Verificar que los public signals coinciden
        require(_pubSignals[0] == uint256(order.secretHash), "Invalid secret hash");
        require(_pubSignals[1] == _orderId, "Invalid order ID");
        require(_pubSignals[2] == uint256(uint160(order.courier)), "Invalid courier");

        // Verificar la prueba ZK
        if (!verifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
            revert InvalidProof();
        }

        order.state = OrderState.DELIVERED;

        // Liberar fondos
        _releaseFunds(_orderId);

        // Actualizar reputación
        reputation.recordDelivery(order.courier, true);
        reputation.recordDelivery(order.emitter, true);

        emit OrderDelivered(_orderId, block.timestamp);
    }

    /// @notice Liberar fondos después de entrega exitosa
    function _releaseFunds(uint256 _orderId) internal {
        Order storage order = orders[_orderId];

        // 1. Devolver colateral al mensajero
        uint256 courierTotal = order.courierCollateral + order.deliveryFee;
        stablecoin.safeTransfer(order.courier, courierTotal);

        emit FundsReleased(_orderId, order.courier, courierTotal);

        // 2. Enviar valor del paquete al receptor (o devolver al emisor según caso)
        // En delivery puro, devolvemos garantía al emisor
        // En compra-venta, iría al vendedor (emisor)
        stablecoin.safeTransfer(order.emitter, order.packageValue);

        emit FundsReleased(_orderId, order.emitter, order.packageValue);
    }

    /// @notice Cancelar orden (solo si está OPEN)
    function cancelOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];

        if (msg.sender != order.emitter) revert Unauthorized();
        if (order.state != OrderState.OPEN) {
            revert InvalidState(order.state, OrderState.OPEN);
        }

        order.state = OrderState.CANCELLED;

        // Devolver fondos al emisor (menos fees ya pagados)
        uint256 refund = order.packageValue + order.deliveryFee;
        stablecoin.safeTransfer(order.emitter, refund);

        emit OrderCancelled(_orderId, msg.sender);
    }

    /// @notice Iniciar disputa
    function initiateDispute(
        uint256 _orderId,
        string calldata _reason
    ) external nonReentrant {
        Order storage order = orders[_orderId];

        require(
            msg.sender == order.emitter ||
            msg.sender == order.courier ||
            msg.sender == order.receiver,
            "Not a participant"
        );

        require(
            order.state == OrderState.LOCKED ||
            order.state == OrderState.PICKED_UP,
            "Cannot dispute in current state"
        );

        order.state = OrderState.DISPUTED;

        // TODO: Crear caso en Kleros

        emit OrderDisputed(_orderId, msg.sender, _reason);
    }

    // ============ View Functions ============

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    function getUserOrders(address _user) external view returns (uint256[] memory) {
        return userOrders[_user];
    }

    // ============ Internal Functions ============

    function _recoverSigner(
        bytes32 _message,
        bytes calldata _signature
    ) internal pure returns (address) {
        bytes32 ethSignedMessage = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _message)
        );

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);
        return ecrecover(ethSignedMessage, v, r, s);
    }

    function _splitSignature(bytes calldata _sig) internal pure returns (
        bytes32 r, bytes32 s, uint8 v
    ) {
        require(_sig.length == 65, "Invalid signature length");

        assembly {
            r := calldataload(_sig.offset)
            s := calldataload(add(_sig.offset, 32))
            v := byte(0, calldataload(add(_sig.offset, 64)))
        }
    }

    // ============ Admin Functions ============

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function updateTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }
}
```

### 5.3 Contrato de Reputación SBT

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReputationSBT - Soulbound Token de Reputación
/// @notice Token intransferible que representa la reputación del usuario
contract ReputationSBT is ERC721, AccessControl {
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    uint256 public constant DECAY_PERIOD = 30 days;
    uint256 public constant DECAY_RATE = 5; // 5% por período
    uint256 public constant MAX_SCORE = 1000;
    uint256 public minCourierScore = 100;

    struct Reputation {
        uint256 score;
        uint256 totalDeliveries;
        uint256 successfulDeliveries;
        uint256 disputes;
        uint256 lastActivityTimestamp;
        bool isCourier;
    }

    mapping(address => Reputation) public reputations;
    mapping(address => uint256) public tokenIds;
    uint256 private _nextTokenId;

    event ReputationUpdated(
        address indexed user,
        uint256 newScore,
        uint256 totalDeliveries
    );

    constructor() ERC721("HashDrop Reputation", "HDREP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Registrar usuario y mintear SBT
    function register(bool _asCourier) external {
        require(tokenIds[msg.sender] == 0, "Already registered");

        uint256 tokenId = ++_nextTokenId;
        _safeMint(msg.sender, tokenId);
        tokenIds[msg.sender] = tokenId;

        reputations[msg.sender] = Reputation({
            score: 100, // Score inicial
            totalDeliveries: 0,
            successfulDeliveries: 0,
            disputes: 0,
            lastActivityTimestamp: block.timestamp,
            isCourier: _asCourier
        });
    }

    /// @notice Registrar resultado de entrega
    function recordDelivery(
        address _user,
        bool _successful
    ) external onlyRole(ESCROW_ROLE) {
        Reputation storage rep = reputations[_user];

        // Aplicar decay primero
        _applyDecay(_user);

        rep.totalDeliveries++;

        if (_successful) {
            rep.successfulDeliveries++;
            // Incrementar score (más difícil mientras más alto)
            uint256 increment = 10 * (MAX_SCORE - rep.score) / MAX_SCORE;
            rep.score = _min(rep.score + increment, MAX_SCORE);
        } else {
            // Penalización por fallo
            rep.score = rep.score > 50 ? rep.score - 50 : 0;
        }

        rep.lastActivityTimestamp = block.timestamp;

        emit ReputationUpdated(_user, rep.score, rep.totalDeliveries);
    }

    /// @notice Registrar disputa
    function recordDispute(
        address _user,
        bool _wasAtFault
    ) external onlyRole(ESCROW_ROLE) {
        Reputation storage rep = reputations[_user];
        rep.disputes++;

        if (_wasAtFault) {
            // Penalización severa
            rep.score = rep.score > 200 ? rep.score - 200 : 0;
        }

        emit ReputationUpdated(_user, rep.score, rep.totalDeliveries);
    }

    /// @notice Obtener score actual (con decay aplicado)
    function getReputationScore(address _user) external view returns (uint256) {
        Reputation memory rep = reputations[_user];

        if (rep.lastActivityTimestamp == 0) return 0;

        uint256 periodsElapsed = (block.timestamp - rep.lastActivityTimestamp) / DECAY_PERIOD;
        uint256 decayedScore = rep.score;

        for (uint256 i = 0; i < periodsElapsed && decayedScore > 0; i++) {
            decayedScore = decayedScore * (100 - DECAY_RATE) / 100;
        }

        return decayedScore;
    }

    /// @dev Aplicar decay al score
    function _applyDecay(address _user) internal {
        Reputation storage rep = reputations[_user];

        uint256 periodsElapsed = (block.timestamp - rep.lastActivityTimestamp) / DECAY_PERIOD;

        for (uint256 i = 0; i < periodsElapsed && rep.score > 0; i++) {
            rep.score = rep.score * (100 - DECAY_RATE) / 100;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ============ SBT: Bloquear transferencias ============

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Solo permitir mint (from == 0) o burn (to == 0)
        require(
            from == address(0) || to == address(0),
            "SBT: Transfer not allowed"
        );

        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
```

---

## 6. Aplicación Móvil

### 6.1 Estructura del Proyecto

```
hashdrop-app/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Home / Order book
│   │   ├── orders.tsx            # Mis órdenes
│   │   ├── deliver.tsx           # Modo mensajero
│   │   └── profile.tsx           # Perfil y reputación
│   ├── order/
│   │   ├── [id].tsx              # Detalle de orden
│   │   ├── create.tsx            # Crear envío
│   │   └── scan.tsx              # Escanear QR
│   └── _layout.tsx
├── src/
│   ├── components/
│   │   ├── ui/                   # Componentes base
│   │   ├── order/                # Componentes de órdenes
│   │   ├── wallet/               # Componentes de wallet
│   │   └── zk/                   # Componentes ZK
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   ├── useContract.ts
│   │   ├── useOrders.ts
│   │   └── useZKProof.ts
│   ├── lib/
│   │   ├── contracts/            # ABIs y addresses
│   │   ├── zk/                   # Generación de pruebas
│   │   ├── crypto/               # Cifrado E2E
│   │   └── ipfs/                 # Cliente IPFS
│   ├── stores/
│   │   ├── walletStore.ts
│   │   ├── orderStore.ts
│   │   └── userStore.ts
│   └── types/
│       └── index.ts
├── circuits/                      # Circuitos ZK compilados
│   ├── DeliveryProof.wasm
│   └── DeliveryProof_final.zkey
└── assets/
```

### 6.2 Configuración Base

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';
import { WagmiConfig, createConfig } from 'wagmi';
import { base, baseGoerli } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TamaguiProvider } from 'tamagui';
import config from '../tamagui.config';

const wagmiConfig = createConfig({
  chains: [base, baseGoerli],
  // ... configuración de conectores
});

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={config}>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </TamaguiProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}
```

### 6.3 Hook de Contrato Principal

```typescript
// src/hooks/useContract.ts
import { useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ESCROW_ABI, ESCROW_ADDRESS } from '../lib/contracts';

export function useCreateOrder() {
  const { writeAsync, data: hash, isPending } = useContractWrite({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'createOrder',
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({ hash });

  const createOrder = async (params: {
    receiver: string;
    packageValue: string;
    deliveryFee: string;
    secretHash: string;
    zoneHash: string;
    detailsCID: string;
  }) => {
    const tx = await writeAsync({
      args: [
        params.receiver,
        parseUnits(params.packageValue, 6), // USDC tiene 6 decimales
        parseUnits(params.deliveryFee, 6),
        params.secretHash as `0x${string}`,
        params.zoneHash as `0x${string}`,
        params.detailsCID,
      ],
    });
    return tx;
  };

  return {
    createOrder,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

export function useAcceptOrder() {
  const { writeAsync, data: hash, isPending } = useContractWrite({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'acceptOrder',
  });

  const acceptOrder = async (orderId: bigint) => {
    return writeAsync({ args: [orderId] });
  };

  return { acceptOrder, isPending, hash };
}

export function useConfirmDelivery() {
  const { writeAsync, isPending } = useContractWrite({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'confirmDelivery',
  });

  const confirmDelivery = async (
    orderId: bigint,
    proof: {
      pA: [bigint, bigint];
      pB: [[bigint, bigint], [bigint, bigint]];
      pC: [bigint, bigint];
    },
    pubSignals: [bigint, bigint, bigint]
  ) => {
    return writeAsync({
      args: [orderId, proof.pA, proof.pB, proof.pC, pubSignals],
    });
  };

  return { confirmDelivery, isPending };
}

export function useOrderDetails(orderId: bigint) {
  return useContractRead({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getOrder',
    args: [orderId],
    watch: true,
  });
}
```

### 6.4 Generación de QR Dinámico

```typescript
// src/lib/qr/dynamicQR.ts
import { ethers } from 'ethers';
import * as Crypto from 'expo-crypto';

interface QRPayload {
  orderId: string;
  secret: string;
  timestamp: number;
  signature: string;
}

export async function generateDeliveryQR(
  orderId: string,
  privateKey: string
): Promise<{ qrData: string; secretHash: string }> {
  // Generar secreto único
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const secret = ethers.hexlify(randomBytes);

  // Hash del secreto (esto va al contrato al crear la orden)
  const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));

  const timestamp = Math.floor(Date.now() / 1000);

  // Firmar el payload
  const wallet = new ethers.Wallet(privateKey);
  const message = ethers.solidityPackedKeccak256(
    ['uint256', 'bytes32', 'uint256'],
    [orderId, secret, timestamp]
  );
  const signature = await wallet.signMessage(ethers.getBytes(message));

  const payload: QRPayload = {
    orderId,
    secret,
    timestamp,
    signature,
  };

  // Codificar como base64 para el QR
  const qrData = Buffer.from(JSON.stringify(payload)).toString('base64');

  return { qrData, secretHash };
}

export function parseDeliveryQR(qrData: string): QRPayload {
  const decoded = Buffer.from(qrData, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

export function verifyQRSignature(
  payload: QRPayload,
  expectedAddress: string
): boolean {
  const message = ethers.solidityPackedKeccak256(
    ['uint256', 'bytes32', 'uint256'],
    [payload.orderId, payload.secret, payload.timestamp]
  );

  const recoveredAddress = ethers.verifyMessage(
    ethers.getBytes(message),
    payload.signature
  );

  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}
```

### 6.5 Pantalla de Crear Envío

```typescript
// app/order/create.tsx
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  YStack, XStack, Text, Input, Button, Card, Spinner
} from 'tamagui';
import { useCreateOrder } from '../../src/hooks/useContract';
import { useWallet } from '../../src/hooks/useWallet';
import { uploadToIPFS } from '../../src/lib/ipfs';
import { encryptForParties } from '../../src/lib/crypto';
import { generateDeliveryQR } from '../../src/lib/qr/dynamicQR';
import { hashZone } from '../../src/lib/geo';

export default function CreateOrderScreen() {
  const { address, signer } = useWallet();
  const { createOrder, isPending, isConfirming } = useCreateOrder();

  const [form, setForm] = useState({
    receiverAddress: '',
    packageValue: '',
    deliveryFee: '',
    pickupAddress: '',
    deliveryAddress: '',
    packageDescription: '',
  });

  const handleSubmit = async () => {
    try {
      // 1. Generar secreto y QR para el receptor
      const { qrData, secretHash } = await generateDeliveryQR(
        '0', // El orderId real se asigna en el contrato
        await signer.getPrivateKey()
      );

      // 2. Cifrar detalles para emisor, mensajero y receptor
      const encryptedDetails = await encryptForParties(
        {
          pickupAddress: form.pickupAddress,
          deliveryAddress: form.deliveryAddress,
          packageDescription: form.packageDescription,
          qrData, // Solo el receptor puede usar esto
        },
        [address, form.receiverAddress] // Claves públicas
      );

      // 3. Subir a IPFS
      const detailsCID = await uploadToIPFS(encryptedDetails);

      // 4. Hash de la zona (para matching privado)
      const zoneHash = hashZone(form.pickupAddress, 1000); // 1km de precisión

      // 5. Crear orden en el contrato
      await createOrder({
        receiver: form.receiverAddress,
        packageValue: form.packageValue,
        deliveryFee: form.deliveryFee,
        secretHash,
        zoneHash,
        detailsCID,
      });

      router.push('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <ScrollView>
      <YStack padding="$4" space="$4">
        <Text fontSize="$8" fontWeight="bold">Crear Envío</Text>

        <Card padded>
          <YStack space="$3">
            <Input
              placeholder="Dirección del receptor (0x...)"
              value={form.receiverAddress}
              onChangeText={(v) => setForm({ ...form, receiverAddress: v })}
            />

            <XStack space="$2">
              <Input
                flex={1}
                placeholder="Valor del paquete (USDC)"
                keyboardType="decimal-pad"
                value={form.packageValue}
                onChangeText={(v) => setForm({ ...form, packageValue: v })}
              />
              <Input
                flex={1}
                placeholder="Fee mensajero (USDC)"
                keyboardType="decimal-pad"
                value={form.deliveryFee}
                onChangeText={(v) => setForm({ ...form, deliveryFee: v })}
              />
            </XStack>

            <Input
              placeholder="Dirección de recogida"
              value={form.pickupAddress}
              onChangeText={(v) => setForm({ ...form, pickupAddress: v })}
            />

            <Input
              placeholder="Dirección de entrega"
              value={form.deliveryAddress}
              onChangeText={(v) => setForm({ ...form, deliveryAddress: v })}
            />

            <Input
              placeholder="Descripción del paquete"
              multiline
              numberOfLines={3}
              value={form.packageDescription}
              onChangeText={(v) => setForm({ ...form, packageDescription: v })}
            />
          </YStack>
        </Card>

        <Card padded backgroundColor="$yellow2">
          <YStack space="$2">
            <Text fontWeight="bold">Resumen de costos:</Text>
            <Text>Valor asegurado: {form.packageValue || '0'} USDC</Text>
            <Text>Fee mensajero: {form.deliveryFee || '0'} USDC</Text>
            <Text>Fee protocolo (1%): {
              ((parseFloat(form.packageValue) || 0) * 0.01).toFixed(2)
            } USDC</Text>
            <Text fontWeight="bold">
              Total a depositar: {
                (
                  (parseFloat(form.packageValue) || 0) +
                  (parseFloat(form.deliveryFee) || 0) +
                  (parseFloat(form.packageValue) || 0) * 0.015
                ).toFixed(2)
              } USDC
            </Text>
          </YStack>
        </Card>

        <Button
          size="$5"
          theme="active"
          onPress={handleSubmit}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? (
            <Spinner />
          ) : (
            'Crear Envío'
          )}
        </Button>
      </YStack>
    </ScrollView>
  );
}
```

---

## 7. Privacidad y Seguridad

### 7.1 Modelo de Amenazas

| Amenaza | Vector | Mitigación |
|---------|--------|------------|
| **Sybil Attack** | Crear múltiples cuentas | ZK-Identity (Polygon ID), 1 persona = 1 cuenta |
| **Front-running** | MEV bots interceptan órdenes | Commit-reveal scheme, flashbots protect |
| **Doxxing** | Revelar identidad en blockchain | Datos cifrados off-chain, solo hashes on-chain |
| **Griefing** | Aceptar y abandonar | Colateral simétrico, timeout + slashing |
| **Robo físico** | Mensajero roba paquete | Colateral 110%, pérdida total si falla |
| **Fraude de entrega** | Marcar entregado sin entregar | ZK-proof del secreto del receptor |
| **Colusión** | Emisor + Mensajero fingen entrega | Receptor debe mostrar QR activamente |

### 7.2 Cifrado End-to-End

```typescript
// src/lib/crypto/e2e.ts
import { box, randomBytes } from 'tweetnacl';
import { decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
}

interface PartyKeys {
  publicKey: Uint8Array;
  role: 'emitter' | 'courier' | 'receiver';
}

export function generateKeyPair() {
  const keyPair = box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

export function encryptForParty(
  message: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedPayload {
  const nonce = randomBytes(box.nonceLength);
  const messageBytes = decodeUTF8(message);

  const ciphertext = box(
    messageBytes,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: '', // Para ECIES, añadir clave efímera
  };
}

export function decryptFromParty(
  encrypted: EncryptedPayload,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string | null {
  const ciphertext = decodeBase64(encrypted.ciphertext);
  const nonce = decodeBase64(encrypted.nonce);

  const decrypted = box.open(
    ciphertext,
    nonce,
    senderPublicKey,
    recipientSecretKey
  );

  if (!decrypted) return null;

  return new TextDecoder().decode(decrypted);
}

// Cifrar para múltiples partes (cada una con su copia)
export async function encryptForParties(
  data: object,
  partyPublicKeys: string[]
): Promise<{ [address: string]: EncryptedPayload }> {
  const ephemeralKeys = box.keyPair();
  const message = JSON.stringify(data);

  const result: { [address: string]: EncryptedPayload } = {};

  for (const publicKey of partyPublicKeys) {
    const recipientPubKey = decodeBase64(publicKey);
    result[publicKey] = encryptForParty(
      message,
      recipientPubKey,
      ephemeralKeys.secretKey
    );
    result[publicKey].ephemeralPublicKey = encodeBase64(ephemeralKeys.publicKey);
  }

  return result;
}
```

### 7.3 Privacidad del Creador (Tu Privacidad)

```
DATOS QUE NUNCA VAN A BLOCKCHAIN:
├── Tu nombre real
├── Tu dirección física
├── Tu email/teléfono
├── IPs de servidor (no hay servidor)
└── Metadatos de órdenes

DATOS EN BLOCKCHAIN (Públicos pero Anónimos):
├── Dirección de wallet (pseudónima)
├── Hashes de secretos
├── Montos de transacciones
└── Timestamps

DATOS EN IPFS (Cifrados):
├── Direcciones de pickup/delivery
├── Descripciones de paquetes
└── Fotos (si aplica)

DATOS SOLO EN DISPOSITIVO:
├── Claves privadas
├── Secretos de QR
└── Historial local
```

### 7.4 Compliance RGPD

```typescript
// src/lib/privacy/gdpr.ts

/**
 * Estrategia de compliance RGPD:
 *
 * 1. MINIMIZACIÓN: Solo recolectar datos estrictamente necesarios
 * 2. CIFRADO: Todo dato personal cifrado antes de salir del dispositivo
 * 3. PSEUDONIMIZACIÓN: Solo wallets addresses en blockchain
 * 4. DERECHO AL OLVIDO: Datos en IPFS con TTL, rotación de claves
 * 5. PORTABILIDAD: Export de datos locales en formato estándar
 */

interface GDPRCompliantStorage {
  // Datos efímeros (se borran después de la orden)
  ephemeralData: {
    pickupCoordinates: EncryptedData;
    deliveryCoordinates: EncryptedData;
    packagePhotos: EncryptedData[];
  };

  // Datos persistentes (solo en dispositivo del usuario)
  localData: {
    orderHistory: EncryptedData; // Cifrado con clave del usuario
    preferences: EncryptedData;
  };

  // Datos en blockchain (inmutables pero pseudónimos)
  onChainData: {
    walletAddress: string; // Pseudónimo
    reputationScore: number;
    completedOrdersCount: number;
  };
}

export async function exportUserData(userAddress: string): Promise<Blob> {
  // Implementar export de datos para portabilidad RGPD
  const userData = await gatherAllUserData(userAddress);
  return new Blob([JSON.stringify(userData)], { type: 'application/json' });
}

export async function deleteUserData(userAddress: string): Promise<void> {
  // Borrar datos locales
  await clearLocalStorage(userAddress);

  // Rotar claves IPFS (los datos cifrados se vuelven inaccesibles)
  await rotateIPFSKeys(userAddress);

  // Nota: Datos on-chain son inmutables pero pseudónimos
  // El usuario puede abandonar su wallet
}
```

---

## 8. Infraestructura Descentralizada

### 8.1 Sin Backend Centralizado

```
                    ARQUITECTURA SERVERLESS

    ┌─────────────────────────────────────────────────────┐
    │                    USUARIOS                         │
    │  ┌─────────┐    ┌─────────┐    ┌─────────┐        │
    │  │ Emisor  │    │Mensajero│    │Receptor │        │
    │  └────┬────┘    └────┬────┘    └────┬────┘        │
    └───────┼──────────────┼──────────────┼─────────────┘
            │              │              │
            ▼              ▼              ▼
    ┌─────────────────────────────────────────────────────┐
    │              RPC NODES (Alchemy/Infura)             │
    │         Acceso directo a blockchain L2              │
    └─────────────────────────────────────────────────────┘
            │              │              │
            ▼              ▼              ▼
    ┌─────────────────────────────────────────────────────┐
    │                  SMART CONTRACTS                    │
    │            (Base / Arbitrum L2)                     │
    │  • Toda la lógica de negocio                       │
    │  • Estado inmutable y verificable                  │
    │  • Eventos para indexación                         │
    └─────────────────────────────────────────────────────┘
            │              │              │
            ▼              ▼              ▼
    ┌─────────────────────────────────────────────────────┐
    │              THE GRAPH (Indexación)                 │
    │        Consultas eficientes de eventos             │
    └─────────────────────────────────────────────────────┘
            │              │              │
            ▼              ▼              ▼
    ┌─────────────────────────────────────────────────────┐
    │              IPFS + FILECOIN                        │
    │        Almacenamiento de metadatos cifrados        │
    └─────────────────────────────────────────────────────┘
```

### 8.2 Subgraph para Indexación

```typescript
// subgraph/schema.graphql
type Order @entity {
  id: ID!
  emitter: Bytes!
  courier: Bytes
  receiver: Bytes!
  packageValue: BigInt!
  deliveryFee: BigInt!
  state: OrderState!
  createdAt: BigInt!
  lockedAt: BigInt
  deliveredAt: BigInt
  deliveryZoneHash: Bytes!
  encryptedDetailsCID: String!
}

enum OrderState {
  OPEN
  LOCKED
  PICKED_UP
  DELIVERED
  DISPUTED
  CANCELLED
  EXPIRED
}

type User @entity {
  id: ID! # wallet address
  ordersAsEmitter: [Order!]! @derivedFrom(field: "emitter")
  ordersAsCourier: [Order!]! @derivedFrom(field: "courier")
  ordersAsReceiver: [Order!]! @derivedFrom(field: "receiver")
  totalDeliveries: BigInt!
  reputationScore: BigInt!
}
```

```typescript
// subgraph/src/mapping.ts
import { OrderCreated, OrderAccepted, OrderDelivered } from '../generated/HashDropEscrow/HashDropEscrow';
import { Order, User } from '../generated/schema';

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString());
  order.emitter = event.params.emitter;
  order.receiver = event.params.receiver;
  order.packageValue = event.params.packageValue;
  order.deliveryFee = event.params.deliveryFee;
  order.state = 'OPEN';
  order.createdAt = event.block.timestamp;
  order.deliveryZoneHash = event.params.deliveryZoneHash;
  order.save();

  // Actualizar o crear usuario
  let user = User.load(event.params.emitter.toHexString());
  if (!user) {
    user = new User(event.params.emitter.toHexString());
    user.totalDeliveries = BigInt.fromI32(0);
    user.reputationScore = BigInt.fromI32(100);
  }
  user.save();
}

export function handleOrderAccepted(event: OrderAccepted): void {
  let order = Order.load(event.params.orderId.toString());
  if (order) {
    order.courier = event.params.courier;
    order.state = 'LOCKED';
    order.lockedAt = event.block.timestamp;
    order.save();
  }
}

export function handleOrderDelivered(event: OrderDelivered): void {
  let order = Order.load(event.params.orderId.toString());
  if (order) {
    order.state = 'DELIVERED';
    order.deliveredAt = event.block.timestamp;
    order.save();
  }
}
```

---

## 9. Sistema de Identidad ZK

### 9.1 Integración con Polygon ID

```typescript
// src/lib/identity/polygonId.ts
import { PolygonIdSdk } from '@0xpolygonid/js-sdk';

interface IdentityClaim {
  isHuman: boolean;
  isUnique: boolean;
  countryCode?: string; // Opcional, para restricciones geográficas
}

export class ZKIdentityManager {
  private sdk: PolygonIdSdk;

  constructor() {
    this.sdk = new PolygonIdSdk({
      // Configuración de red
    });
  }

  /**
   * Crear identidad ZK para el usuario
   * Solo se hace una vez por dispositivo
   */
  async createIdentity(): Promise<string> {
    const identity = await this.sdk.identity.create();
    return identity.did;
  }

  /**
   * Obtener prueba de humanidad sin revelar datos
   */
  async getHumanityProof(): Promise<{
    proof: any;
    publicSignals: string[];
  }> {
    // Solicitar credential de un issuer de confianza (ej: World ID)
    const credential = await this.sdk.credential.request({
      type: 'HumanityCredential',
      issuer: 'did:polygonid:worldid-issuer',
    });

    // Generar ZK proof de la credential
    const proof = await this.sdk.proof.generate({
      credential,
      query: {
        // Solo probar que es humano, sin revelar identidad
        allowedIssuers: ['*'],
        type: 'HumanityCredential',
        credentialSubject: {
          isHuman: { $eq: true },
        },
      },
    });

    return proof;
  }

  /**
   * Verificar que un usuario es único (anti-Sybil)
   * Sin revelar quién es
   */
  async verifyUniqueness(
    groupId: string // ej: "hashdrop-couriers"
  ): Promise<boolean> {
    // Usar Semaphore para grupos anónimos
    const membership = await this.sdk.group.prove({
      groupId,
      signal: 'unique-courier',
    });

    return membership.isValid;
  }
}
```

### 9.2 Registro con Verificación ZK

```typescript
// src/components/identity/ZKRegistration.tsx
import { useState } from 'react';
import { YStack, Text, Button, Spinner, Card } from 'tamagui';
import { ZKIdentityManager } from '../../lib/identity/polygonId';
import { useContract } from '../../hooks/useContract';

export function ZKRegistration({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'idle' | 'proving' | 'submitting' | 'done'>('idle');
  const identityManager = new ZKIdentityManager();
  const { registerWithProof } = useContract();

  const handleRegister = async () => {
    try {
      setStep('proving');

      // 1. Generar prueba de humanidad
      const humanityProof = await identityManager.getHumanityProof();

      setStep('submitting');

      // 2. Enviar al contrato (el contrato verifica la prueba)
      await registerWithProof(humanityProof);

      setStep('done');
      onComplete();
    } catch (error) {
      console.error('Registration failed:', error);
      setStep('idle');
    }
  };

  return (
    <Card padded>
      <YStack space="$4" alignItems="center">
        <Text fontSize="$6" fontWeight="bold">
          Verificación de Identidad
        </Text>

        <Text textAlign="center" color="$gray11">
          Verificamos que eres una persona real sin recopilar tus datos personales.
          Usamos Zero-Knowledge Proofs para proteger tu privacidad.
        </Text>

        {step === 'idle' && (
          <Button size="$5" theme="active" onPress={handleRegister}>
            Verificar Identidad
          </Button>
        )}

        {step === 'proving' && (
          <YStack alignItems="center" space="$2">
            <Spinner size="large" />
            <Text>Generando prueba ZK...</Text>
          </YStack>
        )}

        {step === 'submitting' && (
          <YStack alignItems="center" space="$2">
            <Spinner size="large" />
            <Text>Registrando en blockchain...</Text>
          </YStack>
        )}

        {step === 'done' && (
          <Text color="$green10" fontWeight="bold">
            Identidad verificada
          </Text>
        )}
      </YStack>
    </Card>
  );
}
```

---

## 10. Fases de Desarrollo

### Fase 0: Preparación (Semana 1-2)

```
SEMANA 1-2: SETUP Y DISEÑO
├── Configurar monorepo (Turborepo)
├── Setup Foundry para smart contracts
├── Setup Expo para app móvil
├── Diseñar circuitos ZK (Circom)
├── Definir interfaces y tipos
├── Configurar CI/CD básico
└── Documentar arquitectura
```

### Fase 1: Smart Contracts Core (Semana 3-5)

```
SEMANA 3-4: CONTRATOS BASE
├── HashDropEscrow.sol
│   ├── createOrder()
│   ├── acceptOrder()
│   ├── confirmPickup()
│   └── cancelOrder()
├── ReputationSBT.sol
│   ├── register()
│   ├── recordDelivery()
│   └── getReputationScore()
└── Tests unitarios (Foundry)

SEMANA 5: VERIFICADORES ZK
├── Compilar circuitos Circom
├── Trusted setup (Powers of Tau)
├── Generar DeliveryVerifier.sol
├── Integrar con Escrow
└── Tests de verificación
```

### Fase 2: App Móvil MVP (Semana 6-9)

```
SEMANA 6-7: ESTRUCTURA BASE
├── Expo + React Native setup
├── Navegación (Expo Router)
├── Integración wallet (WalletConnect)
├── UI básica (Tamagui)
└── Conexión a contratos (wagmi)

SEMANA 8: FLUJO EMISOR
├── Pantalla crear envío
├── Cifrado de detalles
├── Upload a IPFS
├── Generación de secretHash
└── Transacción createOrder

SEMANA 9: FLUJO MENSAJERO + RECEPTOR
├── Order book (listado de trabajos)
├── Aceptar orden + stake
├── Generación de QR dinámico
├── Escaneo y verificación
├── Generación de ZK proof
└── Transacción confirmDelivery
```

### Fase 3: Privacidad Avanzada (Semana 10-12)

```
SEMANA 10: IDENTIDAD ZK
├── Integrar Polygon ID SDK
├── Flujo de verificación
├── Anti-Sybil en registro
└── Tests de identidad

SEMANA 11: MATCHING PRIVADO
├── Circuito PrivateMatching
├── Cálculo de distancia ZK
├── Revelación progresiva
└── Tests de matching

SEMANA 12: DISPUTAS
├── Integración Kleros
├── Flujo de evidencias
├── Resolución y slashing
└── Tests de disputas
```

### Fase 4: Auditoría y Launch (Semana 13-16)

```
SEMANA 13-14: AUDITORÍA
├── Auditoría interna
├── Auditoría externa (firma)
├── Bug bounty privado
├── Fixes de seguridad
└── Documentación final

SEMANA 15: TESTNET PÚBLICO
├── Deploy en Base Goerli
├── Beta cerrada (50 usuarios)
├── Feedback y ajustes
└── Métricas y monitoring

SEMANA 16: MAINNET
├── Deploy en Base Mainnet
├── Launch Barcelona (Gràcia/Poblenou)
├── Marketing inicial
└── Soporte early adopters
```

---

## 11. Testing y Auditoría

### 11.1 Testing Smart Contracts

```solidity
// test/HashDropEscrow.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/HashDropEscrow.sol";
import "../contracts/mocks/MockUSDC.sol";

contract HashDropEscrowTest is Test {
    HashDropEscrow public escrow;
    MockUSDC public usdc;

    address emitter = address(0x1);
    address courier = address(0x2);
    address receiver = address(0x3);

    bytes32 secretHash = keccak256("secret123");

    function setUp() public {
        usdc = new MockUSDC();
        // Deploy otros contratos...
        escrow = new HashDropEscrow(
            address(usdc),
            address(0), // verifier
            address(0), // reputation
            address(0x4), // treasury
            address(0x5)  // insurance
        );

        // Dar USDC a los participantes
        usdc.mint(emitter, 1000e6);
        usdc.mint(courier, 1000e6);

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_CreateOrder() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            50e6,  // packageValue
            10e6,  // deliveryFee
            secretHash,
            bytes32(0),
            "QmTest..."
        );

        (
            address _emitter,
            address _courier,
            address _receiver,
            uint256 _value,
            uint256 _fee,
            ,
            HashDropEscrow.OrderState _state,
            ,,,,,
        ) = escrow.orders(orderId);

        assertEq(_emitter, emitter);
        assertEq(_receiver, receiver);
        assertEq(_value, 50e6);
        assertEq(_fee, 10e6);
        assertEq(uint8(_state), uint8(HashDropEscrow.OrderState.OPEN));
    }

    function test_AcceptOrder() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, 50e6, 10e6, secretHash, bytes32(0), "QmTest..."
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        (,address _courier,,,,,HashDropEscrow.OrderState _state,,,,,) =
            escrow.orders(orderId);

        assertEq(_courier, courier);
        assertEq(uint8(_state), uint8(HashDropEscrow.OrderState.LOCKED));
    }

    function test_RevertOnDoubleAccept() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, 50e6, 10e6, secretHash, bytes32(0), "QmTest..."
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        address courier2 = address(0x6);
        usdc.mint(courier2, 1000e6);
        vm.prank(courier2);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(courier2);
        vm.expectRevert();
        escrow.acceptOrder(orderId);
    }

    // Fuzzing test
    function testFuzz_CreateOrderValues(uint256 value, uint256 fee) public {
        value = bound(value, 1e6, 10000e6);
        fee = bound(fee, 0.1e6, 100e6);

        usdc.mint(emitter, value + fee + (value * 15 / 1000));

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, value, fee, secretHash, bytes32(0), "QmTest..."
        );

        (,,,uint256 _value, uint256 _fee,,,,,,,) = escrow.orders(orderId);
        assertEq(_value, value);
        assertEq(_fee, fee);
    }
}
```

### 11.2 Testing de Circuitos ZK

```javascript
// circuits/test/deliveryProof.test.js
const { wasm, groth16 } = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');

describe('DeliveryProof Circuit', () => {
  let poseidon;
  const wasmPath = path.join(__dirname, '../build/DeliveryProof_js/DeliveryProof.wasm');
  const zkeyPath = path.join(__dirname, '../build/DeliveryProof_final.zkey');

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  it('should generate valid proof with correct secret', async () => {
    const secret = BigInt('123456789');
    const secretHash = poseidon.F.toString(poseidon([secret]));

    const input = {
      secret: secret.toString(),
      courierPrivKey: '0x1234567890abcdef',
      timestamp: Math.floor(Date.now() / 1000),
      secretHash: secretHash,
      orderId: '1',
      courierAddress: '0x1234567890123456789012345678901234567890',
    };

    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    expect(publicSignals[0]).toBe(secretHash);

    // Verificar la prueba
    const vkey = require('../build/verification_key.json');
    const isValid = await groth16.verify(vkey, publicSignals, proof);
    expect(isValid).toBe(true);
  });

  it('should fail with incorrect secret', async () => {
    const correctSecret = BigInt('123456789');
    const wrongSecret = BigInt('987654321');
    const secretHash = poseidon.F.toString(poseidon([correctSecret]));

    const input = {
      secret: wrongSecret.toString(), // Secreto incorrecto
      courierPrivKey: '0x1234567890abcdef',
      timestamp: Math.floor(Date.now() / 1000),
      secretHash: secretHash,
      orderId: '1',
      courierAddress: '0x1234567890123456789012345678901234567890',
    };

    // Debería fallar al generar la prueba o la prueba no será válida
    await expect(
      groth16.fullProve(input, wasmPath, zkeyPath)
    ).rejects.toThrow();
  });
});
```

### 11.3 Checklist de Auditoría

```markdown
## Checklist Pre-Auditoría

### Smart Contracts
- [ ] ReentrancyGuard en todas las funciones con transferencias
- [ ] Checks-Effects-Interactions pattern
- [ ] SafeERC20 para transferencias de tokens
- [ ] No arithmetic overflow (Solidity 0.8+)
- [ ] Access control correcto
- [ ] Eventos para todas las acciones importantes
- [ ] Pausable en caso de emergencia
- [ ] Tests con >90% coverage
- [ ] Fuzzing tests pasando
- [ ] Invariant tests
- [ ] Gas optimization review

### Circuitos ZK
- [ ] Constraints correctos
- [ ] No under-constrained signals
- [ ] Trusted setup verificable
- [ ] Tests con edge cases
- [ ] Verificador on-chain correcto

### App Móvil
- [ ] Claves privadas nunca salen del dispositivo
- [ ] Cifrado antes de upload
- [ ] No logs de datos sensibles
- [ ] Certificate pinning
- [ ] Secure storage para claves

### Infraestructura
- [ ] RPC failover configurado
- [ ] IPFS pinning redundante
- [ ] Monitoring y alertas
- [ ] Incident response plan
```

---

## 12. Consideraciones Legales

### 12.1 Ley Rider (España)

```
CÓMO EVITAR CLASIFICACIÓN LABORAL:

1. NO ASIGNACIÓN ALGORÍTMICA
   ✗ Mal:  "El sistema te asigna el pedido más cercano"
   ✓ Bien: "Ves todos los pedidos disponibles y eliges cuál aceptar"

2. LIBERTAD DE HORARIOS
   ✗ Mal:  "Debes estar activo de 12:00 a 15:00"
   ✓ Bien: "Conectas cuando quieres, sin mínimos ni máximos"

3. SIN EXCLUSIVIDAD
   ✗ Mal:  "No puedes trabajar para otras plataformas"
   ✓ Bien: "Usa las apps que quieras simultáneamente"

4. HERRAMIENTAS PROPIAS
   ✗ Mal:  "Te damos mochila y uniforme"
   ✓ Bien: "Usas tu propio vehículo y ropa"

5. PRECIO LIBRE (Parcial)
   - El emisor pone el fee
   - El mensajero acepta o no
   - No hay tarifa mínima impuesta

IMPLEMENTACIÓN TÉCNICA:
- Order Book abierto (no matching automático)
- Sin geofencing de áreas de trabajo
- Sin métricas de "aceptación de pedidos"
- Sin penalizaciones por rechazar
```

### 12.2 RGPD Compliance

```
ARTÍCULO 17 - DERECHO DE SUPRESIÓN ("Derecho al Olvido")

PROBLEMA: Blockchain es inmutable
SOLUCIÓN:
1. NO guardar datos personales on-chain
2. Solo hashes y direcciones de wallet
3. Datos personales en IPFS cifrado
4. El usuario puede "borrar" rotando su clave
   → Los datos cifrados se vuelven inaccesibles

DATOS ON-CHAIN (Inmutables pero pseudónimos):
├── wallet address (pseudónimo)
├── secretHash (no reversible)
├── deliveryZoneHash (no reversible)
├── packageValue (número)
└── timestamps

DATOS OFF-CHAIN (Borrables):
├── Direcciones físicas (IPFS cifrado)
├── Fotos de paquetes (IPFS cifrado)
├── Nombres/contactos (Local device)
└── Historial detallado (Local device)

PROCESO DE BORRADO:
1. Usuario solicita borrado
2. App elimina datos locales
3. App rota claves de cifrado IPFS
4. Datos en IPFS quedan inaccesibles
5. Datos on-chain permanecen pero son anónimos
```

### 12.3 Estructura Legal Sugerida

```
OPCIÓN A: DAO Pura (Máxima descentralización)
├── Sin entidad legal
├── Contratos como "código público"
├── Treasury controlada por token holders
├── Riesgo: Zona gris legal

OPCIÓN B: Fundación + DAO (Recomendada)
├── Fundación en Suiza/Liechtenstein
├── Desarrolla el código (open source)
├── DAO gobierna el protocolo
├── Fundación no opera el servicio
└── Menor riesgo regulatorio

OPCIÓN C: Cooperativa (España)
├── Cooperativa de consumidores/usuarios
├── Los usuarios son socios
├── Cumple mejor con ley española
├── Más complejo de gestionar
└── Menos descentralizado
```

---

## 13. Estimación de Costos

### 13.1 Desarrollo MVP (16 semanas)

| Concepto | Costo (EUR) | Notas |
|----------|-------------|-------|
| **Smart Contracts** | 8,000 | Desarrollo + tests |
| **Circuitos ZK** | 4,000 | Diseño + compilación |
| **App Móvil** | 12,000 | iOS + Android |
| **Integración ZK** | 3,000 | snarkjs + verificadores |
| **Subgraph** | 1,500 | Indexación |
| **UI/UX Design** | 2,500 | Diseño de interfaces |
| **Auditoría básica** | 6,000 | Firma pequeña |
| **Trusted Setup** | 1,000 | Ceremonia MPC |
| **SUBTOTAL DEV** | **38,000** | |

### 13.2 Infraestructura (Anual)

| Servicio | Costo/mes (EUR) | Costo/año (EUR) |
|----------|-----------------|-----------------|
| Alchemy RPC | 50 | 600 |
| Pinata IPFS | 20 | 240 |
| The Graph (hosted) | 0 | 0 |
| Apple Developer | 8 | 99 |
| Google Play | 2 | 25 |
| Dominio + DNS | 3 | 36 |
| **TOTAL INFRA** | **83** | **1,000** |

### 13.3 Gas y Deploy

| Concepto | Costo (EUR) | Red |
|----------|-------------|-----|
| Deploy contratos (testnet) | 0 | Goerli |
| Deploy contratos (mainnet) | 50-100 | Base |
| Gas inicial para tests | 100 | Base |
| Faucet inicial usuarios | 200 | Base |
| **TOTAL GAS** | **~400** | |

### 13.4 Resumen Total MVP

```
┌────────────────────────────────────────┐
│         PRESUPUESTO TOTAL MVP          │
├────────────────────────────────────────┤
│ Desarrollo (16 semanas)    38,000 EUR  │
│ Infraestructura (1 año)     1,000 EUR  │
│ Gas y Deploy                  400 EUR  │
│ Contingencia (10%)          3,940 EUR  │
├────────────────────────────────────────┤
│ TOTAL                      43,340 EUR  │
└────────────────────────────────────────┘
```

### 13.5 Costos Opcionales Post-MVP

| Concepto | Costo (EUR) | Prioridad |
|----------|-------------|-----------|
| Auditoría completa (firma top) | 25,000-50,000 | Alta |
| Bug bounty program | 10,000 | Alta |
| Integración Polygon ID | 5,000 | Media |
| Integración Kleros | 4,000 | Media |
| Marketing launch | 5,000 | Media |
| Legal (estructura) | 8,000 | Media |

---

## Apéndice A: Comandos de Setup

```bash
# 1. Crear monorepo
npx create-turbo@latest hashdrop
cd hashdrop

# 2. Setup contratos (Foundry)
cd packages
forge init contracts
cd contracts
forge install OpenZeppelin/openzeppelin-contracts

# 3. Setup app (Expo)
npx create-expo-app@latest app --template tabs
cd app
npx expo install wagmi viem @tanstack/react-query
npm install @tamagui/core tamagui

# 4. Setup circuitos (Circom)
mkdir -p packages/circuits
cd packages/circuits
npm init -y
npm install circomlib snarkjs

# 5. Setup subgraph
cd packages
graph init --product hosted-service hashdrop/subgraph
```

---

## Apéndice B: Referencias y Recursos

### Documentación Oficial
- [Foundry Book](https://book.getfoundry.sh/)
- [Circom Docs](https://docs.circom.io/)
- [Polygon ID](https://devs.polygonid.com/)
- [Base Docs](https://docs.base.org/)
- [Expo Docs](https://docs.expo.dev/)

### Ejemplos de Código
- [Tornado Cash (ZK)](https://github.com/tornadocash/tornado-core)
- [Semaphore](https://github.com/semaphore-protocol/semaphore)
- [Uniswap V4 (Escrow patterns)](https://github.com/Uniswap/v4-core)

### Auditorías de Referencia
- [OpenZeppelin Audits](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/audits)
- [Trail of Bits Publications](https://github.com/trailofbits/publications)

---

*Documento generado para HashDrop - Sistema de Delivery P2P Descentralizado*
*Versión 1.0 - Enero 2026*
