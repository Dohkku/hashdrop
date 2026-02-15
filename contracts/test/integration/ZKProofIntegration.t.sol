// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/HashDropEscrow.sol";
import "../../src/test/HashDropEscrowHarness.sol";
import "../../src/ReputationSBT.sol";
import "../../src/mocks/MockUSDC.sol";
import "../../src/verifiers/DeliveryVerifier.sol";
import "../../src/interfaces/IDeliveryVerifier.sol";

/**
 * @title ZKProofIntegrationTest
 * @notice Integration tests for ZK proof verification in delivery flow
 * @dev Tests use a mock verifier. The real verifier is generated from the
 *      DeliveryProof.circom circuit using snarkjs.
 *
 * The ZK proof system works as follows:
 * 1. Sender generates a secret and computes secretHash = Poseidon(secret)
 * 2. secretHash is stored in the smart contract when order is created
 * 3. Receiver shows QR code containing the secret
 * 4. Courier scans QR, generates ZK proof proving knowledge of secret
 * 5. Proof is verified on-chain without revealing the actual secret
 *
 * Public signals for the proof:
 * - valid: Circuit output (must be 1)
 * - secretHash: Hash stored in contract
 * - orderId: Binds proof to specific order
 * - courierAddress: Prevents proof theft
 */
contract ZKProofIntegrationTest is Test {
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

    uint256 public constant PACKAGE_VALUE = 50e6;
    uint256 public constant DELIVERY_FEE = 10e6;

    // Secret hash (would be Poseidon hash in production)
    bytes32 public secretHash = bytes32(uint256(12345));

    // Dummy proof params (mock verifier always returns true)
    uint256[2] internal dummyA = [uint256(0), uint256(0)];
    uint256[2][2] internal dummyB = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
    uint256[2] internal dummyC = [uint256(0), uint256(0)];

    function setUp() public {
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

        // Grant escrow role
        reputation.grantEscrowRole(address(escrow));

        // Mint and approve
        usdc.mint(emitter, 10000e6);
        usdc.mint(courier, 10000e6);

        // Register users
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(courier);
        reputation.register(true);
        vm.prank(receiver);
        reputation.register(false);

        // Approve escrow
        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ TEST 1: Valid proof releases funds ============

    function test_ValidProof_ReleaseFunds() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        // Accept and pickup
        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Track balances
        uint256 courierBalanceBefore = usdc.balanceOf(courier);

        // Deliver with valid proof (mock verifier returns true)
        vm.prank(courier);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        // Verify delivery completed
        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED));

        // Verify funds released
        uint256 courierBalanceAfter = usdc.balanceOf(courier);
        uint256 expectedCollateral = (PACKAGE_VALUE * 11000) / 10000;
        assertEq(
            courierBalanceAfter - courierBalanceBefore,
            expectedCollateral + DELIVERY_FEE
        );
    }

    // ============ TEST 2: Invalid proof is rejected ============

    function test_InvalidProof_Rejected() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        // Accept and pickup
        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Configure mock verifier to reject
        verifier.setVerificationResult(false);

        // Try to deliver with invalid proof
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidProof.selector);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);
    }

    // ============ TEST 3: Proof binding - different orders get different hashes ============

    function test_DifferentOrders_DifferentHashes() public {
        bytes32 secretHash1 = bytes32(uint256(11111));
        bytes32 secretHash2 = bytes32(uint256(22222));

        // Create two orders with different secret hashes
        vm.startPrank(emitter);
        uint256 orderId1 = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash1, bytes32(uint256(1)), "QmTest1"
        );
        uint256 orderId2 = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash2, bytes32(uint256(2)), "QmTest2"
        );
        vm.stopPrank();

        // Accept both orders
        vm.startPrank(courier);
        escrow.acceptOrder(orderId1);
        escrow.acceptOrder(orderId2);
        vm.stopPrank();

        // Pickup both
        escrow.setOrderState(orderId1, IHashDropEscrow.OrderState.PICKED_UP);
        escrow.setOrderState(orderId2, IHashDropEscrow.OrderState.PICKED_UP);

        // Complete order 1
        vm.prank(courier);
        escrow.confirmDelivery(orderId1, dummyA, dummyB, dummyC);

        // Complete order 2
        vm.prank(courier);
        escrow.confirmDelivery(orderId2, dummyA, dummyB, dummyC);

        // Verify both delivered
        IHashDropEscrow.Order memory order1 = escrow.getOrder(orderId1);
        IHashDropEscrow.Order memory order2 = escrow.getOrder(orderId2);
        assertEq(uint8(order1.state), uint8(IHashDropEscrow.OrderState.DELIVERED));
        assertEq(uint8(order2.state), uint8(IHashDropEscrow.OrderState.DELIVERED));
    }

    // ============ TEST 4: Only assigned courier can deliver ============

    function test_OnlyAssignedCourier_CanDeliver() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        // Courier accepts
        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Create another courier
        address courier2 = address(0x4);
        vm.prank(courier2);
        reputation.register(true);

        // Courier2 tries to deliver - should fail
        vm.prank(courier2);
        vm.expectRevert(IHashDropEscrow.Unauthorized.selector);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);
    }

    // ============ TEST 5: Verifier toggling for testing ============

    function test_VerifierToggle() public {
        // Create order
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Set verifier to reject
        verifier.setVerificationResult(false);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidProof.selector);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        // Set verifier to accept
        verifier.setVerificationResult(true);

        vm.prank(courier);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED));
    }

    // ============ TEST 6: Delivery timeout still applies with ZK proofs ============

    function test_DeliveryTimeout_WithZKProof() public {
        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);
        escrow.setPickedUpAt(orderId, block.timestamp);

        // Fast forward past delivery timeout
        vm.warp(block.timestamp + 6 hours + 1);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.DeliveryTimeout.selector);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);
    }

    // ============ TEST 7: Verifier contract is properly referenced ============

    function test_VerifierContractAddress() public view {
        assertEq(address(escrow.verifier()), address(verifier));
    }
}
