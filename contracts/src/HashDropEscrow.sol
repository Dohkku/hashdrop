// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IHashDropEscrow.sol";
import "./interfaces/IReputationSBT.sol";

/// @title HashDropEscrow - Contrato principal de escrow para delivery P2P
/// @notice Gestiona depositos, colaterales y liberacion de fondos para entregas
/// @dev Implementa escrow con colateral simetrico y verificacion de entrega
contract HashDropEscrow is IHashDropEscrow, ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");

    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant INSURANCE_FEE_BPS = 50; // 0.5%
    uint256 public constant COLLATERAL_MULTIPLIER_BPS = 11000; // 110%
    uint256 public constant BPS_DENOMINATOR = 10000;

    uint256 public constant ORDER_EXPIRY = 24 hours;
    uint256 public constant PICKUP_TIMEOUT = 2 hours;
    uint256 public constant DELIVERY_TIMEOUT = 6 hours;

    // ============ Immutables ============
    IERC20 public immutable stablecoin;
    IReputationSBT public immutable reputation;

    // ============ State Variables ============
    address public treasury;
    address public insurancePool;
    uint256 public nextOrderId;

    mapping(uint256 => Order) internal _orders;
    mapping(address => uint256[]) private _userOrders;
    mapping(uint256 => bool) private _usedNonces;

    // ============ Constructor ============
    constructor(
        address _stablecoin,
        address _reputation,
        address _treasury,
        address _insurancePool
    ) {
        if (
            _stablecoin == address(0) ||
            _reputation == address(0) ||
            _treasury == address(0) ||
            _insurancePool == address(0)
        ) {
            revert ZeroAddress();
        }

        stablecoin = IERC20(_stablecoin);
        reputation = IReputationSBT(_reputation);
        treasury = _treasury;
        insurancePool = _insurancePool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ Core Functions ============

    /// @notice Crear una nueva orden de envio
    /// @param receiver Direccion del receptor
    /// @param packageValue Valor declarado del paquete (para calcular colateral)
    /// @param deliveryFee Fee para el mensajero
    /// @param secretHash Hash del secreto que tendra el receptor
    /// @param deliveryZoneHash Hash de la zona de entrega (privacidad)
    /// @param encryptedDetailsCID IPFS CID de los detalles cifrados
    /// @return orderId ID de la orden creada
    function createOrder(
        address receiver,
        uint256 packageValue,
        uint256 deliveryFee,
        bytes32 secretHash,
        bytes32 deliveryZoneHash,
        string calldata encryptedDetailsCID
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        if (receiver == address(0)) revert ZeroAddress();
        if (receiver == msg.sender) revert Unauthorized();
        if (packageValue == 0) revert InvalidAmount();
        if (deliveryFee == 0) revert InvalidAmount();
        if (secretHash == bytes32(0)) revert InvalidSecret();

        // Verificar que emisor esta registrado
        if (!reputation.isRegistered(msg.sender)) revert NotRegistered();

        // Calcular fees del protocolo
        uint256 protocolFee = (packageValue * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 insuranceFee = (packageValue * INSURANCE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalDeposit = packageValue + deliveryFee + protocolFee + insuranceFee;

        // Transferir fondos al contrato
        stablecoin.safeTransferFrom(msg.sender, address(this), totalDeposit);

        // Distribuir fees inmediatamente
        stablecoin.safeTransfer(treasury, protocolFee);
        stablecoin.safeTransfer(insurancePool, insuranceFee);

        orderId = nextOrderId++;

        _orders[orderId] = Order({
            emitter: msg.sender,
            courier: address(0),
            receiver: receiver,
            packageValue: packageValue,
            deliveryFee: deliveryFee,
            courierCollateral: 0,
            state: OrderState.OPEN,
            createdAt: block.timestamp,
            lockedAt: 0,
            pickedUpAt: 0,
            secretHash: secretHash,
            deliveryZoneHash: deliveryZoneHash,
            encryptedDetailsCID: encryptedDetailsCID
        });

        _userOrders[msg.sender].push(orderId);
        _userOrders[receiver].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            receiver,
            packageValue,
            deliveryFee,
            deliveryZoneHash
        );
    }

    /// @notice Mensajero acepta una orden y deposita colateral
    /// @param orderId ID de la orden
    function acceptOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];

        if (order.emitter == address(0)) revert OrderNotFound();
        if (order.state != OrderState.OPEN) {
            revert InvalidState(order.state, OrderState.OPEN);
        }
        if (block.timestamp > order.createdAt + ORDER_EXPIRY) {
            order.state = OrderState.EXPIRED;
            emit OrderExpired(orderId);
            revert OrderExpiredError();
        }
        if (msg.sender == order.emitter || msg.sender == order.receiver) {
            revert Unauthorized();
        }

        // Verificar que mensajero esta registrado y tiene score minimo
        if (!reputation.isRegistered(msg.sender)) revert NotRegistered();
        if (!reputation.meetsMinimumScore(msg.sender, reputation.minCourierScore())) {
            revert Unauthorized();
        }

        // Calcular colateral requerido (110% del valor del paquete)
        uint256 collateral = (order.packageValue * COLLATERAL_MULTIPLIER_BPS) / BPS_DENOMINATOR;

        // Transferir colateral
        stablecoin.safeTransferFrom(msg.sender, address(this), collateral);

        order.courier = msg.sender;
        order.courierCollateral = collateral;
        order.state = OrderState.LOCKED;
        order.lockedAt = block.timestamp;

        _userOrders[msg.sender].push(orderId);

        emit OrderAccepted(orderId, msg.sender, collateral);
    }

    /// @notice Confirmar recogida del paquete
    /// @param orderId ID de la orden
    /// @param emitterSignature Firma del emisor confirmando la recogida
    function confirmPickup(
        uint256 orderId,
        bytes calldata emitterSignature
    ) external nonReentrant {
        Order storage order = _orders[orderId];

        if (order.state != OrderState.LOCKED) {
            revert InvalidState(order.state, OrderState.LOCKED);
        }
        if (msg.sender != order.courier) revert Unauthorized();

        // Verificar timeout de pickup
        if (block.timestamp > order.lockedAt + PICKUP_TIMEOUT) {
            revert PickupTimeout();
        }

        // Verificar firma del emisor
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                orderId,
                "PICKUP",
                order.courier,
                block.timestamp / 1 hours // Ventana de 1 hora
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(emitterSignature);

        if (signer != order.emitter) revert Unauthorized();

        order.state = OrderState.PICKED_UP;
        order.pickedUpAt = block.timestamp;

        emit PackagePickedUp(orderId, block.timestamp);
    }

    /// @notice Confirmar entrega con el secreto del receptor
    /// @param orderId ID de la orden
    /// @param secret Secreto revelado por el receptor (texto plano)
    function confirmDelivery(
        uint256 orderId,
        string calldata secret
    ) external nonReentrant {
        Order storage order = _orders[orderId];

        if (order.state != OrderState.PICKED_UP) {
            revert InvalidState(order.state, OrderState.PICKED_UP);
        }
        if (msg.sender != order.courier) revert Unauthorized();

        // Verificar timeout de entrega
        if (block.timestamp > order.pickedUpAt + DELIVERY_TIMEOUT) {
            revert DeliveryTimeout();
        }

        // Verificar que el secreto coincide con el hash
        bytes32 computedHash = keccak256(abi.encodePacked(secret));
        if (computedHash != order.secretHash) revert InvalidSecret();

        order.state = OrderState.DELIVERED;

        // Liberar fondos
        _releaseFundsOnSuccess(orderId);

        // Actualizar reputacion
        reputation.recordSuccessfulDelivery(order.courier);
        reputation.recordSuccessfulDelivery(order.emitter);

        emit OrderDelivered(orderId, block.timestamp);
    }

    /// @notice Cancelar orden (solo si esta OPEN)
    /// @param orderId ID de la orden
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];

        if (msg.sender != order.emitter) revert Unauthorized();
        if (order.state != OrderState.OPEN) {
            revert InvalidState(order.state, OrderState.OPEN);
        }

        order.state = OrderState.CANCELLED;

        // Devolver fondos al emisor (menos fees ya pagados)
        uint256 refund = order.packageValue + order.deliveryFee;
        stablecoin.safeTransfer(order.emitter, refund);

        emit OrderCancelled(orderId, msg.sender);
        emit FundsReleased(orderId, order.emitter, refund);
    }

    /// @notice Iniciar disputa
    /// @param orderId ID de la orden
    /// @param reason Razon de la disputa
    function initiateDispute(uint256 orderId, string calldata reason) external nonReentrant {
        Order storage order = _orders[orderId];

        if (
            msg.sender != order.emitter &&
            msg.sender != order.courier &&
            msg.sender != order.receiver
        ) {
            revert Unauthorized();
        }

        if (order.state != OrderState.LOCKED && order.state != OrderState.PICKED_UP) {
            revert InvalidState(order.state, OrderState.LOCKED);
        }

        order.state = OrderState.DISPUTED;

        emit OrderDisputed(orderId, msg.sender, reason);
    }

    /// @notice Reclamar orden expirada (devolver fondos)
    /// @param orderId ID de la orden
    function claimExpiredOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];

        if (order.state != OrderState.OPEN) {
            revert InvalidState(order.state, OrderState.OPEN);
        }

        if (block.timestamp <= order.createdAt + ORDER_EXPIRY) {
            revert OrderExpiredError();
        }

        order.state = OrderState.EXPIRED;

        // Devolver fondos al emisor
        uint256 refund = order.packageValue + order.deliveryFee;
        stablecoin.safeTransfer(order.emitter, refund);

        emit OrderExpired(orderId);
        emit FundsReleased(orderId, order.emitter, refund);
    }

    // ============ Dispute Resolution (Admin) ============

    /// @notice Resolver disputa a favor del emisor
    /// @param orderId ID de la orden
    function resolveDisputeForEmitter(
        uint256 orderId
    ) external onlyRole(DISPUTE_RESOLVER_ROLE) nonReentrant {
        Order storage order = _orders[orderId];

        if (order.state != OrderState.DISPUTED) {
            revert InvalidState(order.state, OrderState.DISPUTED);
        }

        order.state = OrderState.CANCELLED;

        // Emisor recibe su dinero + colateral del mensajero como compensacion
        uint256 emitterRefund = order.packageValue + order.deliveryFee + order.courierCollateral;
        stablecoin.safeTransfer(order.emitter, emitterRefund);

        // Actualizar reputacion
        reputation.recordDispute(order.courier, true);
        reputation.recordFailedDelivery(order.courier);

        emit FundsReleased(orderId, order.emitter, emitterRefund);
    }

    /// @notice Resolver disputa a favor del mensajero
    /// @param orderId ID de la orden
    function resolveDisputeForCourier(
        uint256 orderId
    ) external onlyRole(DISPUTE_RESOLVER_ROLE) nonReentrant {
        Order storage order = _orders[orderId];

        if (order.state != OrderState.DISPUTED) {
            revert InvalidState(order.state, OrderState.DISPUTED);
        }

        order.state = OrderState.DELIVERED;

        // Liberar fondos normalmente
        _releaseFundsOnSuccess(orderId);

        // Actualizar reputacion (emisor culpable)
        reputation.recordDispute(order.emitter, true);
        reputation.recordSuccessfulDelivery(order.courier);

        emit OrderDelivered(orderId, block.timestamp);
    }

    // ============ View Functions ============

    /// @notice Obtener detalles de una orden
    /// @param orderId ID de la orden
    /// @return Order struct con todos los detalles
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    /// @notice Obtener ordenes de un usuario
    /// @param user Direccion del usuario
    /// @return Array de IDs de ordenes
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return _userOrders[user];
    }

    /// @notice Calcular colateral requerido para una orden
    /// @param orderId ID de la orden
    /// @return Cantidad de colateral necesario
    function getRequiredCollateral(uint256 orderId) external view returns (uint256) {
        Order memory order = _orders[orderId];
        return (order.packageValue * COLLATERAL_MULTIPLIER_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Verificar si una orden ha expirado
    /// @param orderId ID de la orden
    /// @return True si ha expirado
    function isOrderExpired(uint256 orderId) external view returns (bool) {
        Order memory order = _orders[orderId];
        if (order.state != OrderState.OPEN) return false;
        return block.timestamp > order.createdAt + ORDER_EXPIRY;
    }

    // ============ Internal Functions ============

    /// @dev Liberar fondos en caso de entrega exitosa
    function _releaseFundsOnSuccess(uint256 orderId) internal {
        Order storage order = _orders[orderId];

        // 1. Devolver colateral + fee al mensajero
        uint256 courierTotal = order.courierCollateral + order.deliveryFee;
        stablecoin.safeTransfer(order.courier, courierTotal);

        emit FundsReleased(orderId, order.courier, courierTotal);

        // 2. Devolver valor del paquete al emisor
        // (En caso de compra-venta, esto iria al vendedor)
        stablecoin.safeTransfer(order.emitter, order.packageValue);

        emit FundsReleased(orderId, order.emitter, order.packageValue);
    }

    // ============ Admin Functions ============

    /// @notice Pausar el contrato
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Despausar el contrato
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Actualizar direccion del treasury
    /// @param newTreasury Nueva direccion
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
    }

    /// @notice Actualizar direccion del insurance pool
    /// @param newInsurancePool Nueva direccion
    function setInsurancePool(address newInsurancePool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newInsurancePool == address(0)) revert ZeroAddress();
        insurancePool = newInsurancePool;
    }
}
