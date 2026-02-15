// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/HashDropEscrow.sol";
import "../../src/test/HashDropEscrowHarness.sol";
import "../../src/ReputationSBT.sol";
import "../../src/mocks/MockUSDC.sol";
import "../../src/verifiers/DeliveryVerifier.sol";

/**
 * @title FullLifecycleTest
 * @notice Integration tests for the complete order lifecycle
 * @dev Tests E2E flows including happy path, disputes, expiration, and timeouts
 */
contract FullLifecycleTest is Test {
    HashDropEscrowHarness public escrow;
    ReputationSBT public reputation;
    MockUSDC public usdc;
    DeliveryVerifierMock public verifier;

    address public owner = address(this);
    address public treasury = address(0x100);
    address public insurancePool = address(0x101);

    address public emitter = address(0x1);
    address public courier = address(0x2);
    address public receiver = address(0x3);

    uint256 public constant PACKAGE_VALUE = 50e6; // 50 USDC
    uint256 public constant DELIVERY_FEE = 10e6; // 10 USDC
    bytes32 public secretHash = bytes32(uint256(12345));

    // Dummy proof params (mock verifier always returns true)
    uint256[2] internal dummyA = [uint256(0), uint256(0)];
    uint256[2][2] internal dummyB = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
    uint256[2] internal dummyC = [uint256(0), uint256(0)];

    // Pre-calculated values
    uint256 public protocolFee;
    uint256 public insuranceFee;
    uint256 public totalDeposit;
    uint256 public collateral;

    // Emitter private key for signatures
    uint256 public constant EMITTER_PRIVATE_KEY = 0xA11CE;
    address public emitterSigner;

    function setUp() public {
        // Setup emitter with proper private key for signatures
        emitterSigner = vm.addr(EMITTER_PRIVATE_KEY);
        emitter = emitterSigner;

        // Deploy contracts
        usdc = new MockUSDC();
        reputation = new ReputationSBT();
        verifier = new DeliveryVerifierMock();

        escrow = new HashDropEscrowHarness(
            address(usdc),
            address(reputation),
            treasury,
            insurancePool,
            address(verifier)
        );

        // Grant escrow role to escrow contract
        reputation.grantEscrowRole(address(escrow));

        // Pre-calculate fees
        protocolFee = (PACKAGE_VALUE * 100) / 10000; // 1%
        insuranceFee = (PACKAGE_VALUE * 50) / 10000; // 0.5%
        totalDeposit = PACKAGE_VALUE + DELIVERY_FEE + protocolFee + insuranceFee;
        collateral = (PACKAGE_VALUE * 11000) / 10000; // 110%

        // Mint USDC to participants
        usdc.mint(emitter, 10000e6);
        usdc.mint(courier, 10000e6);

        // Register users in reputation system
        vm.prank(emitter);
        reputation.register(false);

        vm.prank(courier);
        reputation.register(true);

        vm.prank(receiver);
        reputation.register(false);

        // Approve escrow to spend USDC
        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ TEST 1: Happy Path Complete ============

    /**
     * @notice Test complete happy path: create -> accept -> pickup -> deliver
     */
    function test_E2E_CreateAcceptPickupDeliver() public {
        // Track initial balances
        uint256 emitterInitial = usdc.balanceOf(emitter);
        uint256 courierInitial = usdc.balanceOf(courier);
        uint256 treasuryInitial = usdc.balanceOf(treasury);
        uint256 insuranceInitial = usdc.balanceOf(insurancePool);

        // Track initial reputation
        uint256 courierScoreBefore = reputation.getReputationScore(courier);
        uint256 emitterScoreBefore = reputation.getReputationScore(emitter);

        // STEP 1: Emitter creates order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(uint256(1)),
            "QmTest123"
        );

        // Verify order created correctly
        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(order.emitter, emitter, "Emitter should match");
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.OPEN), "State should be OPEN");

        // Verify fees transferred
        assertEq(usdc.balanceOf(treasury), treasuryInitial + protocolFee, "Treasury should receive protocol fee");
        assertEq(usdc.balanceOf(insurancePool), insuranceInitial + insuranceFee, "Insurance pool should receive fee");

        // STEP 2: Courier accepts order
        vm.prank(courier);
        escrow.acceptOrder(orderId);

        order = escrow.getOrder(orderId);
        assertEq(order.courier, courier, "Courier should be set");
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.LOCKED), "State should be LOCKED");
        assertEq(order.courierCollateral, collateral, "Collateral should be set");

        // STEP 3: Courier confirms pickup (using harness to bypass signature)
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.PICKED_UP), "State should be PICKED_UP");

        // STEP 4: Courier delivers with ZK proof
        vm.prank(courier);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        // Verify final state
        order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED), "State should be DELIVERED");

        // Verify fund distribution
        uint256 emitterFinal = usdc.balanceOf(emitter);
        uint256 courierFinal = usdc.balanceOf(courier);

        // Emitter: paid totalDeposit, received packageValue back
        assertEq(
            emitterFinal,
            emitterInitial - totalDeposit + PACKAGE_VALUE,
            "Emitter should receive packageValue back"
        );

        // Courier: paid collateral, received collateral + deliveryFee
        assertEq(
            courierFinal,
            courierInitial - collateral + collateral + DELIVERY_FEE,
            "Courier should receive collateral + fee"
        );

        // Verify reputation increased
        uint256 courierScoreAfter = reputation.getReputationScore(courier);
        uint256 emitterScoreAfter = reputation.getReputationScore(emitter);

        assertGt(courierScoreAfter, courierScoreBefore, "Courier score should increase");
        assertGt(emitterScoreAfter, emitterScoreBefore, "Emitter score should increase");
    }

    // ============ TEST 2: Dispute resolved for emitter ============

    function test_E2E_DisputeResolvedForEmitter() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);
        uint256 courierScoreBefore = reputation.getReputationScore(courier);

        vm.prank(emitter);
        escrow.initiateDispute(orderId, "Package damaged");

        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DISPUTED), "State should be DISPUTED");

        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), owner);
        escrow.resolveDisputeForEmitter(orderId);

        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        uint256 expectedRefund = PACKAGE_VALUE + DELIVERY_FEE + collateral;
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            expectedRefund,
            "Emitter should receive packageValue + deliveryFee + collateral"
        );

        uint256 courierScoreAfter = reputation.getReputationScore(courier);
        assertLt(courierScoreAfter, courierScoreBefore, "Courier score should decrease");
        assertEq(courierScoreAfter, 0, "Courier score should floor at 0");
    }

    // ============ TEST 3: Dispute resolved for courier ============

    function test_E2E_DisputeResolvedForCourier() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        uint256 courierBalanceBefore = usdc.balanceOf(courier);
        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);
        uint256 emitterScoreBefore = reputation.getReputationScore(emitter);

        vm.prank(emitter);
        escrow.initiateDispute(orderId, "False claim");

        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), owner);
        escrow.resolveDisputeForCourier(orderId);

        uint256 courierBalanceAfter = usdc.balanceOf(courier);
        assertEq(
            courierBalanceAfter - courierBalanceBefore,
            collateral + DELIVERY_FEE,
            "Courier should receive collateral + fee"
        );

        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            PACKAGE_VALUE,
            "Emitter should receive packageValue"
        );

        uint256 emitterScoreAfter = reputation.getReputationScore(emitter);
        assertLt(emitterScoreAfter, emitterScoreBefore, "Emitter score should decrease");
    }

    // ============ TEST 4: Order expired and claimed ============

    function test_E2E_OrderExpiredAndClaimed() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);

        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(escrow.isOrderExpired(orderId), "Order should be expired");

        vm.prank(emitter);
        escrow.claimExpiredOrder(orderId);

        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        uint256 expectedRefund = PACKAGE_VALUE + DELIVERY_FEE;
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            expectedRefund,
            "Emitter should receive full refund"
        );

        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.EXPIRED), "State should be EXPIRED");
    }

    // ============ TEST 5: Cannot accept expired order ============

    function test_E2E_CannotAcceptExpiredOrder() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.warp(block.timestamp + 25 hours);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.OrderExpiredError.selector);
        escrow.acceptOrder(orderId);
    }

    // ============ TEST 6: Pickup timeout ============

    function test_E2E_PickupTimeout() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        vm.warp(block.timestamp + 2 hours + 1);

        bytes32 messageHash = keccak256(
            abi.encodePacked(orderId, "PICKUP", courier, block.timestamp / 1 hours)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EMITTER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.PickupTimeout.selector);
        escrow.confirmPickup(orderId, signature);
    }

    // ============ TEST 7: Delivery timeout ============

    function test_E2E_DeliveryTimeout() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);
        escrow.setPickedUpAt(orderId, block.timestamp);

        vm.warp(block.timestamp + 6 hours + 1);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.DeliveryTimeout.selector);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);
    }

    // ============ TEST 8: Multiple orders by same emitter ============

    function test_E2E_MultipleOrdersSameEmitter() public {
        vm.startPrank(emitter);
        uint256 orderId1 = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(uint256(1)), "QmTest1"
        );
        uint256 orderId2 = escrow.createOrder(
            receiver, PACKAGE_VALUE * 2, DELIVERY_FEE * 2,
            bytes32(uint256(67890)), bytes32(uint256(2)), "QmTest2"
        );
        vm.stopPrank();

        uint256[] memory userOrders = escrow.getUserOrders(emitter);
        assertEq(userOrders.length, 2, "Emitter should have 2 orders");
        assertEq(userOrders[0], orderId1, "First order ID should match");
        assertEq(userOrders[1], orderId2, "Second order ID should match");
    }

    // ============ TEST 9: Complete flow with proper signature ============

    function test_E2E_CompleteFlowWithSignature() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        bytes32 messageHash = keccak256(
            abi.encodePacked(orderId, "PICKUP", courier, block.timestamp / 1 hours)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EMITTER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(courier);
        escrow.confirmPickup(orderId, signature);

        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.PICKED_UP), "State should be PICKED_UP");

        vm.prank(courier);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED), "State should be DELIVERED");
    }
}
