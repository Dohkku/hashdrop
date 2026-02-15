// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/HashDropEscrow.sol";
import "../../src/test/HashDropEscrowHarness.sol";
import "../../src/ReputationSBT.sol";
import "../../src/mocks/MockUSDC.sol";
import "../../src/verifiers/DeliveryVerifier.sol";

/**
 * @title ReputationIntegrationTest
 * @notice Integration tests for reputation system with escrow
 * @dev Tests how reputation affects order acceptance and updates
 */
contract ReputationIntegrationTest is Test {
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

        reputation.grantEscrowRole(address(escrow));

        // Mint USDC
        usdc.mint(emitter, 10000e6);
        usdc.mint(courier, 10000e6);
    }

    // ============ TEST 1: Unregistered courier cannot accept ============

    function test_UnregisteredCourier_CannotAccept() public {
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(receiver);
        reputation.register(false);

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.NotRegistered.selector);
        escrow.acceptOrder(orderId);
    }

    // ============ TEST 2: Unregistered emitter cannot create ============

    function test_UnregisteredEmitter_CannotCreate() public {
        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(emitter);
        vm.expectRevert(IHashDropEscrow.NotRegistered.selector);
        escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );
    }

    // ============ TEST 3: Low score courier cannot accept ============

    function test_LowScoreCourier_CannotAccept() public {
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(courier);
        reputation.register(true);
        vm.prank(receiver);
        reputation.register(false);

        vm.startPrank(address(escrow));
        reputation.recordFailedDelivery(courier);
        reputation.recordFailedDelivery(courier);
        vm.stopPrank();

        uint256 courierScore = reputation.getReputationScore(courier);
        assertLt(courierScore, reputation.minCourierScore(), "Courier score should be below minimum");

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        vm.expectRevert(IHashDropEscrow.Unauthorized.selector);
        escrow.acceptOrder(orderId);
    }

    // ============ TEST 4: Non-courier user acceptance ============

    function test_NonCourierUser_CannotAccept() public {
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(courier);
        reputation.register(false); // Not a courier!
        vm.prank(receiver);
        reputation.register(false);

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        bool meetsScore = reputation.meetsMinimumScore(courier, reputation.minCourierScore());

        if (meetsScore) {
            vm.prank(courier);
            escrow.acceptOrder(orderId);
        }
    }

    // ============ TEST 5: Reputation decay after 30 days ============

    function test_ReputationDecay_After30Days() public {
        vm.prank(courier);
        reputation.register(true);

        for (uint256 i = 0; i < 50; i++) {
            vm.prank(address(escrow));
            reputation.recordSuccessfulDelivery(courier);
        }

        uint256 scoreBeforeDecay = reputation.getReputationScore(courier);

        vm.warp(block.timestamp + 30 days);

        uint256 scoreAfterDecay = reputation.getReputationScore(courier);

        uint256 expectedScore = (scoreBeforeDecay * 9500) / 10000;
        assertEq(scoreAfterDecay, expectedScore, "Score should decay by 5%");
    }

    // ============ TEST 6: Reputation decay multiple periods ============

    function test_ReputationDecay_MultiplePeriods() public {
        vm.prank(courier);
        reputation.register(true);

        for (uint256 i = 0; i < 50; i++) {
            vm.prank(address(escrow));
            reputation.recordSuccessfulDelivery(courier);
        }

        uint256 initialScore = reputation.getReputationScore(courier);

        vm.warp(block.timestamp + 90 days);

        uint256 finalScore = reputation.getReputationScore(courier);

        uint256 expectedScore = initialScore;
        for (uint256 i = 0; i < 3; i++) {
            expectedScore = (expectedScore * 9500) / 10000;
        }

        assertEq(finalScore, expectedScore, "Score should decay for each 30-day period");
    }

    // ============ TEST 7: Score updates after successful delivery ============

    function test_SuccessfulDelivery_IncreasesReputation() public {
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(courier);
        reputation.register(true);
        vm.prank(receiver);
        reputation.register(false);

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);

        uint256 courierScoreBefore = reputation.getReputationScore(courier);
        uint256 emitterScoreBefore = reputation.getReputationScore(emitter);

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        escrow.setOrderState(orderId, IHashDropEscrow.OrderState.PICKED_UP);

        vm.prank(courier);
        escrow.confirmDelivery(orderId, dummyA, dummyB, dummyC);

        uint256 courierScoreAfter = reputation.getReputationScore(courier);
        uint256 emitterScoreAfter = reputation.getReputationScore(emitter);

        assertGt(courierScoreAfter, courierScoreBefore, "Courier score should increase");
        assertGt(emitterScoreAfter, emitterScoreBefore, "Emitter score should increase");
    }

    // ============ TEST 8: Failed delivery decreases reputation ============

    function test_FailedDelivery_DecreasesReputation() public {
        vm.prank(emitter);
        reputation.register(false);
        vm.prank(courier);
        reputation.register(true);
        vm.prank(receiver);
        reputation.register(false);

        vm.prank(emitter);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(courier);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(emitter);
        uint256 orderId = escrow.createOrder(
            receiver, PACKAGE_VALUE, DELIVERY_FEE, secretHash, bytes32(0), "QmTest"
        );

        vm.prank(courier);
        escrow.acceptOrder(orderId);

        uint256 courierScoreBefore = reputation.getReputationScore(courier);

        vm.prank(emitter);
        escrow.initiateDispute(orderId, "Package lost");

        escrow.grantRole(escrow.DISPUTE_RESOLVER_ROLE(), owner);
        escrow.resolveDisputeForEmitter(orderId);

        uint256 courierScoreAfter = reputation.getReputationScore(courier);

        assertLt(courierScoreAfter, courierScoreBefore, "Courier score should decrease");
        assertEq(courierScoreAfter, 0, "Courier score should floor at 0");
    }

    // ============ TEST 9: Score caps at maximum ============

    function test_ScoreMaxCap() public {
        vm.prank(courier);
        reputation.register(true);

        for (uint256 i = 0; i < 200; i++) {
            vm.prank(address(escrow));
            reputation.recordSuccessfulDelivery(courier);
        }

        uint256 score = reputation.getReputationScore(courier);
        assertLe(score, 1000, "Score should not exceed 1000");
    }

    // ============ TEST 10: Score floor at zero ============

    function test_ScoreMinFloor() public {
        vm.prank(courier);
        reputation.register(true);

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(address(escrow));
            reputation.recordFailedDelivery(courier);
        }

        uint256 score = reputation.getReputationScore(courier);
        assertEq(score, 0, "Score should floor at 0");
    }

    // ============ TEST 11: SBT is non-transferable ============

    function test_SBT_NonTransferable() public {
        vm.prank(courier);
        uint256 tokenId = reputation.register(true);

        vm.prank(courier);
        vm.expectRevert(IReputationSBT.TransferNotAllowed.selector);
        reputation.transferFrom(courier, emitter, tokenId);
    }

    // ============ TEST 12: Admin can adjust minimum score ============

    function test_AdminCanAdjustMinScore() public {
        uint256 initialMin = reputation.minCourierScore();
        assertEq(initialMin, 50, "Initial min score should be 50");

        reputation.setMinCourierScore(100);
        assertEq(reputation.minCourierScore(), 100, "Min score should be updated");

        vm.prank(courier);
        reputation.register(true);

        assertTrue(
            reputation.meetsMinimumScore(courier, 100),
            "Courier should meet minimum"
        );

        reputation.setMinCourierScore(150);

        assertFalse(
            reputation.meetsMinimumScore(courier, 150),
            "Courier should not meet higher minimum"
        );
    }
}
