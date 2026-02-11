// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/HashDropEscrow.sol";
import "../../src/test/HashDropEscrowHarness.sol";
import "../../src/ReputationSBT.sol";
import "../../src/mocks/MockUSDC.sol";
import "../../src/interfaces/IDeliveryVerifier.sol";

/**
 * @title ZKProofIntegrationTest
 * @notice Integration tests for ZK proof verification in delivery flow
 * @dev These tests use a mock verifier until the real one is generated
 *
 * The ZK proof system works as follows:
 * 1. Receiver generates a secret and computes secretHash = Poseidon(secret)
 * 2. secretHash is stored in the smart contract when order is created
 * 3. Receiver shows QR code containing the secret
 * 4. Courier scans QR, generates ZK proof proving knowledge of secret
 * 5. Proof is verified on-chain without revealing the actual secret
 *
 * Public inputs for the proof:
 * - secretHash: Hash stored in contract
 * - orderId: Binds proof to specific order
 * - courierAddress: Prevents proof theft
 */
contract ZKProofIntegrationTest is Test {
    HashDropEscrowHarness public escrow;
    ReputationSBT public reputation;
    MockUSDC public usdc;
    MockDeliveryVerifier public verifier;

    address public owner = address(this);
    address public treasury = address(0x100);
    address public insurancePool = address(0x101);

    address public emitter = address(0x1);
    address public courier = address(0x2);
    address public receiver = address(0x3);

    uint256 public constant PACKAGE_VALUE = 50e6;
    uint256 public constant DELIVERY_FEE = 10e6;

    // Test values for ZK proof
    uint256 public constant TEST_SECRET = 12345678901234567890;
    bytes32 public secretHash;

    function setUp() public {
        // Deploy contracts
        usdc = new MockUSDC();
        reputation = new ReputationSBT();
        verifier = new MockDeliveryVerifier();

        escrow = new HashDropEscrowHarness(
            address(usdc),
            address(reputation),
            treasury,
            insurancePool
        );

        // Grant escrow role
        reputation.grantEscrowRole(address(escrow));

        // Setup: For ZK proofs, we would use Poseidon hash
        // For these tests, we use keccak256 (current contract implementation)
        secretHash = keccak256(abi.encodePacked("secret123"));

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

    // ============ TEST 1: Valid secret releases funds ============

    /**
     * @notice Test that valid secret verification releases funds
     * GIVEN: Order in PICKED_UP state with secretHash = keccak256(secret)
     * WHEN: Courier provides the correct secret
     * THEN: Funds are released
     */
    function test_ValidSecret_ReleaseFunds() public {
        string memory secret = "secret123";

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

        // Accept and pickup
        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Track balances
        uint256 courierBalanceBefore = usdc.balanceOf(courier);

        // Deliver with correct secret
        vm.prank(courier);
        escrow.confirmDelivery(orderId, secret);

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

    // ============ TEST 2: Invalid secret is rejected ============

    /**
     * @notice Test that invalid secret is rejected
     * GIVEN: Order in PICKED_UP state
     * WHEN: Courier provides incorrect secret
     * THEN: Transaction reverts with "Invalid proof"
     */
    function test_InvalidSecret_Rejected() public {
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

        // Accept and pickup
        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Try to deliver with wrong secret
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidSecret.selector);
        escrow.confirmDelivery(orderId, "wrongsecret");
    }

    // ============ TEST 3: Secret replay attack prevention ============

    /**
     * @notice Test that secrets cannot be reused across orders
     * GIVEN: Two orders with different secretHashes
     * WHEN: Attacker tries to use secret from order 1 on order 2
     * THEN: Transaction fails because hashes don't match
     */
    function test_SecretReplayAttack_Blocked() public {
        string memory secret1 = "secret123";
        string memory secret2 = "differentsecret";
        bytes32 secretHash1 = keccak256(abi.encodePacked(secret1));
        bytes32 secretHash2 = keccak256(abi.encodePacked(secret2));

        // Create two orders with different secrets
        vm.startPrank(emitter);
        uint256 orderId1 = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash1,
            bytes32(uint256(1)),
            "QmTest1"
        );
        uint256 orderId2 = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            secretHash2,
            bytes32(uint256(2)),
            "QmTest2"
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

        // Complete order 1 with its secret
        vm.prank(courier);
        escrow.confirmDelivery(orderId1, secret1);

        // Try to use secret1 on order2 - should fail
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidSecret.selector);
        escrow.confirmDelivery(orderId2, secret1);

        // Correct secret works for order 2
        vm.prank(courier);
        escrow.confirmDelivery(orderId2, secret2);
    }

    // ============ TEST 4: Only assigned courier can deliver ============

    /**
     * @notice Test that only the assigned courier can confirm delivery
     * GIVEN: Order assigned to courier A
     * WHEN: Courier B tries to confirm delivery with valid secret
     * THEN: Transaction reverts with Unauthorized
     */
    function test_OnlyAssignedCourier_CanDeliver() public {
        string memory secret = "secret123";

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
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Create another courier
        address courier2 = address(0x4);
        vm.prank(courier2);
        reputation.register(true);

        // Courier2 tries to deliver - should fail
        vm.prank(courier2);
        vm.expectRevert(IHashDropEscrow.Unauthorized.selector);
        escrow.confirmDelivery(orderId, secret);
    }

    // ============ TEST 5: Same secret with different hash fails ============

    /**
     * @notice Test that hash must match stored hash exactly
     */
    function test_HashMismatch_Fails() public {
        // Create order with one hash
        bytes32 storedHash = keccak256(abi.encodePacked("actualSecret"));

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            storedHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Try with secret that hashes to different value
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidSecret.selector);
        escrow.confirmDelivery(orderId, "wrongSecret");
    }

    // ============ TEST 6: Empty secret fails ============

    /**
     * @notice Test that empty string fails if hash doesn't match
     */
    function test_EmptySecret_Fails() public {
        // Create order (secretHash is for "secret123", not empty string)
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
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Try with empty secret
        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.InvalidSecret.selector);
        escrow.confirmDelivery(orderId, "");
    }

    // ============ TEST 7: Large secret value ============

    /**
     * @notice Test delivery with large secret value
     */
    function test_LargeSecret_Works() public {
        // Create a large secret
        string memory largeSecret = "this_is_a_very_long_secret_value_that_tests_handling_of_large_inputs_12345678901234567890";
        bytes32 largeSecretHash = keccak256(abi.encodePacked(largeSecret));

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver,
            PACKAGE_VALUE,
            DELIVERY_FEE,
            largeSecretHash,
            bytes32(0),
            "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);
        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        // Deliver with large secret
        vm.prank(courier);
        escrow.confirmDelivery(orderId, largeSecret);

        // Verify delivered
        IHashDropEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.state), uint8(IHashDropEscrow.OrderState.DELIVERED));
    }
}

/**
 * @title MockDeliveryVerifier
 * @notice Mock verifier for testing ZK proof integration
 * @dev Will be replaced by real verifier generated from circuit
 */
contract MockDeliveryVerifier is IDeliveryVerifier {
    // Track which proofs have been used (for replay protection)
    mapping(bytes32 => bool) public usedProofs;

    // Control verification result for testing
    bool public shouldVerify = true;

    function setVerificationResult(bool result) external {
        shouldVerify = result;
    }

    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view override returns (bool) {
        // In mock, we just return the configured result
        // Real verifier would do actual cryptographic verification
        return shouldVerify;
    }
}
