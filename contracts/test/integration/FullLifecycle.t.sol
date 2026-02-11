// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/HashDropEscrow.sol";
import "../../src/test/HashDropEscrowHarness.sol";
import "../../src/ReputationSBT.sol";
import "../../src/mocks/MockUSDC.sol";

/**
 * @title FullLifecycleTest
 * @notice Integration tests for the complete order lifecycle
 * @dev Tests E2E flows including happy path, disputes, expiration, and timeouts
 */
contract FullLifecycleTest is Test {
    HashDropEscrowHarness public escrow;
    ReputationSBT public reputation;
    MockUSDC public usdc;

    address public owner = address(this);
    address public treasury = address(0x100);
    address public insurancePool = address(0x101);

    address public emitter = address(0x1);
    address public courier = address(0x2);
    address public receiver = address(0x3);

    uint256 public constant PACKAGE_VALUE = 50e6; // 50 USDC
    uint256 public constant DELIVERY_FEE = 10e6; // 10 USDC
    bytes32 public secretHash;
    string public constant SECRET = "secret123";

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

        escrow = new HashDropEscrowHarness(
            address(usdc),
            address(reputation),
            treasury,
            insurancePool
        );

        // Grant escrow role to escrow contract
        reputation.grantEscrowRole(address(escrow));

        // Setup secret hash
        secretHash = keccak256(abi.encodePacked(SECRET));

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
     * @notice Test complete happy path: create → accept → pickup → deliver
     * GIVEN: Emitter, Courier, Receiver registered with reputation
     * WHEN: Emitter creates order → Courier accepts → Courier confirms pickup → Courier delivers
     * THEN:
     *   - Funds distributed correctly (courier: fee + collateral, receiver: 0, emitter: packageValue)
     *   - Reputation of courier incremented
     *   - Final state = DELIVERED
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

        // STEP 4: Courier delivers (provides secret)
        vm.prank(courier);
        escrow.confirmDelivery(orderId, SECRET);

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

    /**
     * @notice Test dispute resolved in favor of emitter
     * GIVEN: Order in state PICKED_UP (or LOCKED)
     * WHEN: Emitter initiates dispute → Admin resolves for emitter
     * THEN:
     *   - Emitter receives: packageValue + deliveryFee + courierCollateral
     *   - Courier loses collateral
     *   - Courier reputation penalized
     */
    function test_E2E_DisputeResolvedForEmitter() public {
        // Setup: Create and accept order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        // Track balances after acceptance
        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);
        uint256 courierScoreBefore = reputation.getReputationScore(courier);

        // Emitter initiates dispute
        vm.prank(emitter);
        escrow.initiateDispute(orderId, "Package damaged");

        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DISPUTED), "State should be DISPUTED");

        // Grant dispute resolver role to owner
        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), owner);

        // Resolve dispute for emitter
        escrow.resolveDisputeForEmitter(orderId);

        // Verify emitter receives full compensation
        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        uint256 expectedRefund = PACKAGE_VALUE + DELIVERY_FEE + collateral;
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            expectedRefund,
            "Emitter should receive packageValue + deliveryFee + collateral"
        );

        // Verify courier reputation penalized
        uint256 courierScoreAfter = reputation.getReputationScore(courier);
        assertLt(courierScoreAfter, courierScoreBefore, "Courier score should decrease");

        // Verify the penalty amount
        // DISPUTE_PENALTY = 200, FAILURE_PENALTY = 50
        // But score floors at 0, so actual penalty is min(courierScoreBefore, 200 + 50)
        // Initial score is 100, so penalty is capped at 100
        // Score should be 0 (floored) since penalty (250) > initial score (100)
        assertEq(courierScoreAfter, 0, "Courier score should floor at 0");
    }

    // ============ TEST 3: Dispute resolved for courier ============

    /**
     * @notice Test dispute resolved in favor of courier
     * GIVEN: Order in state DISPUTED
     * WHEN: Admin resolves for courier
     * THEN:
     *   - Funds released as if successful delivery
     *   - Emitter receives dispute penalty
     */
    function test_E2E_DisputeResolvedForCourier() public {
        // Setup: Create, accept and pickup order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        // Set to picked up state
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Track balances
        uint256 courierBalanceBefore = usdc.balanceOf(courier);
        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);
        uint256 emitterScoreBefore = reputation.getReputationScore(emitter);

        // Emitter initiates dispute (falsely)
        vm.prank(emitter);
        escrow.initiateDispute(orderId, "False claim");

        // Grant dispute resolver role and resolve for courier
        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), owner);
        escrow.resolveDisputeForCourier(orderId);

        // Verify funds released to courier
        uint256 courierBalanceAfter = usdc.balanceOf(courier);
        assertEq(
            courierBalanceAfter - courierBalanceBefore,
            collateral + DELIVERY_FEE,
            "Courier should receive collateral + fee"
        );

        // Verify emitter receives package value back
        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            PACKAGE_VALUE,
            "Emitter should receive packageValue"
        );

        // Verify emitter reputation penalized
        uint256 emitterScoreAfter = reputation.getReputationScore(emitter);
        assertLt(emitterScoreAfter, emitterScoreBefore, "Emitter score should decrease");
    }

    // ============ TEST 4: Order expired and claimed ============

    /**
     * @notice Test expired order can be claimed by emitter
     * GIVEN: Order OPEN for more than 24 hours
     * WHEN: Emitter calls claimExpiredOrder
     * THEN: Emitter receives full refund (packageValue + deliveryFee)
     */
    function test_E2E_OrderExpiredAndClaimed() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        uint256 emitterBalanceBefore = usdc.balanceOf(emitter);

        // Fast forward past expiry (24 hours + 1 second)
        vm.warp(block.timestamp + 24 hours + 1);

        // Verify order is expired
        assertTrue(escrow.isOrderExpired(orderId), "Order should be expired");

        // Claim expired order
        vm.prank(emitter);
        escrow.claimExpiredOrder(orderId);

        // Verify refund
        uint256 emitterBalanceAfter = usdc.balanceOf(emitter);
        uint256 expectedRefund = PACKAGE_VALUE + DELIVERY_FEE;
        assertEq(
            emitterBalanceAfter - emitterBalanceBefore,
            expectedRefund,
            "Emitter should receive full refund"
        );

        // Verify state
        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.EXPIRED), "State should be EXPIRED");
    }

    // ============ TEST 5: Courier cannot accept expired order ============

    /**
     * @notice Test courier cannot accept an expired order
     * GIVEN: Order OPEN for more than 24 hours
     * WHEN: Courier attempts to accept
     * THEN: Transaction reverts with OrderExpiredError
     */
    function test_E2E_CannotAcceptExpiredOrder() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        // Fast forward past expiry
        vm.warp(block.timestamp + 25 hours);

        // Attempt to accept - should fail
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.OrderExpiredError.selector);
        escrow.acceptOrder(orderId);
    }

    // ============ TEST 6: Pickup timeout ============

    /**
     * @notice Test pickup timeout handling
     * GIVEN: Order LOCKED for more than 2 hours without pickup
     * WHEN: Courier attempts to confirm pickup
     * THEN: Transaction reverts with PickupTimeout
     */
    function test_E2E_PickupTimeout() public {
        // Create and accept order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        // Fast forward past pickup timeout (2 hours + 1 second)
        vm.warp(block.timestamp + 2 hours + 1);

        // Create a valid signature (for the current time window)
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                orderId,
                "PICKUP",
                courier,
                block.timestamp / 1 hours
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EMITTER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Attempt to confirm pickup - should fail due to timeout
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.PickupTimeout.selector);
        escrow.confirmPickup(orderId, signature);
    }

    // ============ TEST 7: Delivery timeout ============

    /**
     * @notice Test delivery timeout handling
     * GIVEN: Order PICKED_UP for more than 6 hours without delivery
     * WHEN: Courier attempts to confirm delivery
     * THEN: Transaction reverts with DeliveryTimeout
     */
    function test_E2E_DeliveryTimeout() public {
        // Create, accept and pickup order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        // Set to picked up with timestamp
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);
        escrow.setPickedUpAt(orderId, block.timestamp);

        // Fast forward past delivery timeout (6 hours + 1 second)
        vm.warp(block.timestamp + 6 hours + 1);

        // Attempt to deliver - should fail due to timeout
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.DeliveryTimeout.selector);
        escrow.confirmDelivery(orderId, SECRET);
    }

    // ============ TEST 8: Multiple orders by same emitter ============

    /**
     * @notice Test emitter can have multiple concurrent orders
     */
    function test_E2E_MultipleOrdersSameEmitter() public {
        // Create multiple orders
        vm.startPrank(emitter);
        uint256 orderId1 = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(uint256(1)),
            "QmTest1"
        );
        uint256 orderId2 = escrow.createOrder(
            receiver,
            PACKAGE_VALUE * 2,
            DELIVERY_FEE * 2,
            keccak256("secret2"),
            bytes32(uint256(2)),
            "QmTest2"
        );
        vm.stopPrank();

        // Verify both orders exist
        uint256[] memory userOrders = escrow.getUserOrders(emitter);
        assertEq(userOrders.length, 2, "Emitter should have 2 orders");
        assertEq(userOrders[0], orderId1, "First order ID should match");
        assertEq(userOrders[1], orderId2, "Second order ID should match");
    }

    // ============ TEST 9: Complete flow with proper signature ============

    /**
     * @notice Test complete flow with actual emitter signature for pickup
     */
    function test_E2E_CompleteFlowWithSignature() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash,
            bytes32(0),
            "QmTest"
        );

        // Courier accepts
        vm.prank(courier);
        escrow.acceptOrder(orderId);

        // Create emitter signature for pickup
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                orderId,
                "PICKUP",
                courier,
                block.timestamp / 1 hours
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EMITTER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Courier confirms pickup with signature
        vm.prank(courier);
        escrow.confirmPickup(orderId, signature);

        // Verify state is PICKED_UP
        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.PICKED_UP), "State should be PICKED_UP");

        // Courier delivers
        vm.prank(courier);
        escrow.confirmDelivery(orderId, SECRET);

        // Verify state is DELIVERED
        order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED), "State should be DELIVERED");
    }
}
