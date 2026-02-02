// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHashDropEscrow {
    // ============ Enums ============
    enum OrderState {
        OPEN,       // Orden creada, esperando mensajero
        LOCKED,     // Mensajero aceptó, fondos bloqueados
        PICKED_UP,  // Paquete recogido por mensajero
        DELIVERED,  // Entrega confirmada con ZK-proof
        DISPUTED,   // En disputa
        CANCELLED,  // Cancelada por emisor
        EXPIRED     // Tiempo expirado sin aceptar
    }

    // ============ Structs ============
    struct Order {
        address emitter;
        address courier;
        address receiver;
        uint256 packageValue;
        uint256 deliveryFee;
        uint256 courierCollateral;
        OrderState state;
        uint256 createdAt;
        uint256 lockedAt;
        uint256 pickedUpAt;
        bytes32 secretHash;
        bytes32 deliveryZoneHash;
        string encryptedDetailsCID;
    }

    // ============ Events ============
    event OrderCreated(
        uint256 indexed orderId,
        address indexed emitter,
        address indexed receiver,
        uint256 packageValue,
        uint256 deliveryFee,
        bytes32 deliveryZoneHash
    );

    event OrderAccepted(uint256 indexed orderId, address indexed courier, uint256 collateral);

    event PackagePickedUp(uint256 indexed orderId, uint256 timestamp);

    event OrderDelivered(uint256 indexed orderId, uint256 timestamp);

    event OrderDisputed(uint256 indexed orderId, address indexed initiator, string reason);

    event OrderCancelled(uint256 indexed orderId, address indexed canceller);

    event OrderExpired(uint256 indexed orderId);

    event FundsReleased(uint256 indexed orderId, address indexed recipient, uint256 amount);

    // ============ Errors ============
    error InvalidState(OrderState current, OrderState expected);
    error Unauthorized();
    error InsufficientFunds();
    error InvalidProof();
    error OrderExpiredError();
    error ZeroAddress();
    error InvalidAmount();
    error OrderNotFound();
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidSecret();
    error PickupTimeout();
    error DeliveryTimeout();

    // ============ Functions ============
    function createOrder(
        address receiver,
        uint256 packageValue,
        uint256 deliveryFee,
        bytes32 secretHash,
        bytes32 deliveryZoneHash,
        string calldata encryptedDetailsCID
    ) external returns (uint256 orderId);

    function acceptOrder(uint256 orderId) external;

    function confirmPickup(uint256 orderId, bytes calldata emitterSignature) external;

    function confirmDelivery(uint256 orderId, string calldata secret) external;

    function cancelOrder(uint256 orderId) external;

    function initiateDispute(uint256 orderId, string calldata reason) external;

    function claimExpiredOrder(uint256 orderId) external;

    function getOrder(uint256 orderId) external view returns (Order memory);

    function getUserOrders(address user) external view returns (uint256[] memory);
}
