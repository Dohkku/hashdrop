// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ReputationSBT.sol";

contract ReputationSBTTest is Test {
    ReputationSBT public reputation;

    address public owner = address(this);
    address public escrow = address(0x100);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    event UserRegistered(address indexed user, bool isCourier, uint256 tokenId);
    event ReputationUpdated(address indexed user, uint256 newScore, uint256 totalDeliveries);

    function setUp() public {
        reputation = new ReputationSBT();
        reputation.grantEscrowRole(escrow);
    }

    // ============ Registration Tests ============

    function test_Register() public {
        vm.prank(user1);
        uint256 tokenId = reputation.register(true);

        assertEq(tokenId, 1);
        assertEq(reputation.ownerOf(tokenId), user1);
        assertEq(reputation.getTokenId(user1), tokenId);
        assertTrue(reputation.isRegistered(user1));
    }

    function test_Register_SetsInitialReputation() public {
        vm.prank(user1);
        reputation.register(true);

        IReputationSBT.Reputation memory rep = reputation.getReputation(user1);
        assertEq(rep.score, 100);
        assertEq(rep.totalDeliveries, 0);
        assertEq(rep.successfulDeliveries, 0);
        assertTrue(rep.isCourier);
        assertTrue(rep.isActive);
    }

    function test_Register_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit UserRegistered(user1, true, 1);

        vm.prank(user1);
        reputation.register(true);
    }

    function test_Register_RevertIfAlreadyRegistered() public {
        vm.prank(user1);
        reputation.register(true);

        vm.prank(user1);
        vm.expectRevert(IReputationSBT.AlreadyRegistered.selector);
        reputation.register(false);
    }

    // ============ Successful Delivery Tests ============

    function test_RecordSuccessfulDelivery() public {
        vm.prank(user1);
        reputation.register(true);

        vm.prank(escrow);
        reputation.recordSuccessfulDelivery(user1);

        IReputationSBT.Reputation memory rep = reputation.getReputation(user1);
        assertEq(rep.totalDeliveries, 1);
        assertEq(rep.successfulDeliveries, 1);
        assertGt(rep.score, 100); // Score should increase
    }

    function test_RecordSuccessfulDelivery_ScoreIncrement() public {
        vm.prank(user1);
        reputation.register(true);

        uint256 scoreBefore = reputation.getReputationScore(user1);

        vm.prank(escrow);
        reputation.recordSuccessfulDelivery(user1);

        uint256 scoreAfter = reputation.getReputationScore(user1);

        // Increment should be ~9 (10 * (1000 - 100) / 1000)
        assertEq(scoreAfter - scoreBefore, 9);
    }

    function test_RecordSuccessfulDelivery_DiminishingReturns() public {
        vm.prank(user1);
        reputation.register(true);

        // Record many deliveries to increase score
        for (uint256 i = 0; i < 50; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 scoreBefore = reputation.getReputationScore(user1);

        vm.prank(escrow);
        reputation.recordSuccessfulDelivery(user1);

        uint256 scoreAfter = reputation.getReputationScore(user1);

        // Increment should be smaller at higher scores
        assertLe(scoreAfter - scoreBefore, 5);
    }

    function test_RecordSuccessfulDelivery_RevertIfNotEscrow() public {
        vm.prank(user1);
        reputation.register(true);

        vm.prank(user2);
        vm.expectRevert();
        reputation.recordSuccessfulDelivery(user1);
    }

    // ============ Failed Delivery Tests ============

    function test_RecordFailedDelivery() public {
        vm.prank(user1);
        reputation.register(true);

        // First increase score
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 scoreBefore = reputation.getReputationScore(user1);

        vm.prank(escrow);
        reputation.recordFailedDelivery(user1);

        uint256 scoreAfter = reputation.getReputationScore(user1);
        IReputationSBT.Reputation memory rep = reputation.getReputation(user1);

        assertEq(scoreBefore - scoreAfter, 50); // FAILURE_PENALTY
        assertEq(rep.failedDeliveries, 1);
    }

    function test_RecordFailedDelivery_ScoreFloorAtZero() public {
        vm.prank(user1);
        reputation.register(true);

        // Record failed delivery on low score
        vm.prank(escrow);
        reputation.recordFailedDelivery(user1);

        vm.prank(escrow);
        reputation.recordFailedDelivery(user1);

        vm.prank(escrow);
        reputation.recordFailedDelivery(user1);

        uint256 score = reputation.getReputationScore(user1);
        assertEq(score, 0);
    }

    // ============ Dispute Tests ============

    function test_RecordDispute_AtFault() public {
        vm.prank(user1);
        reputation.register(true);

        // Build up score first
        for (uint256 i = 0; i < 30; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 scoreBefore = reputation.getReputationScore(user1);

        vm.prank(escrow);
        reputation.recordDispute(user1, true);

        uint256 scoreAfter = reputation.getReputationScore(user1);
        IReputationSBT.Reputation memory rep = reputation.getReputation(user1);

        assertEq(scoreBefore - scoreAfter, 200); // DISPUTE_PENALTY
        assertEq(rep.disputes, 1);
    }

    function test_RecordDispute_NotAtFault() public {
        vm.prank(user1);
        reputation.register(true);

        uint256 scoreBefore = reputation.getReputationScore(user1);

        vm.prank(escrow);
        reputation.recordDispute(user1, false);

        uint256 scoreAfter = reputation.getReputationScore(user1);
        IReputationSBT.Reputation memory rep = reputation.getReputation(user1);

        assertEq(scoreBefore, scoreAfter); // No penalty
        assertEq(rep.disputes, 1);
    }

    // ============ Decay Tests ============

    function test_ScoreDecay() public {
        vm.prank(user1);
        reputation.register(true);

        // Build up score
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 scoreBefore = reputation.getReputationScore(user1);

        // Fast forward 30 days (1 decay period)
        vm.warp(block.timestamp + 30 days);

        uint256 scoreAfter = reputation.getReputationScore(user1);

        // Score should decay by 5%
        uint256 expectedScore = (scoreBefore * 9500) / 10000;
        assertEq(scoreAfter, expectedScore);
    }

    function test_ScoreDecay_MultiplePeriods() public {
        vm.prank(user1);
        reputation.register(true);

        // Build up score
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 scoreBefore = reputation.getReputationScore(user1);

        // Fast forward 90 days (3 decay periods)
        vm.warp(block.timestamp + 90 days);

        uint256 scoreAfter = reputation.getReputationScore(user1);

        // Score should decay by 5% three times
        uint256 expectedScore = scoreBefore;
        for (uint256 i = 0; i < 3; i++) {
            expectedScore = (expectedScore * 9500) / 10000;
        }
        assertEq(scoreAfter, expectedScore);
    }

    // ============ SBT Tests ============

    function test_CannotTransfer() public {
        vm.prank(user1);
        uint256 tokenId = reputation.register(true);

        vm.prank(user1);
        vm.expectRevert(IReputationSBT.TransferNotAllowed.selector);
        reputation.transferFrom(user1, user2, tokenId);
    }

    function test_CannotSafeTransfer() public {
        vm.prank(user1);
        uint256 tokenId = reputation.register(true);

        vm.prank(user1);
        vm.expectRevert(IReputationSBT.TransferNotAllowed.selector);
        reputation.safeTransferFrom(user1, user2, tokenId);
    }

    // ============ Minimum Score Tests ============

    function test_MeetsMinimumScore() public {
        vm.prank(user1);
        reputation.register(true);

        assertTrue(reputation.meetsMinimumScore(user1, 50));
        assertTrue(reputation.meetsMinimumScore(user1, 100));
        assertFalse(reputation.meetsMinimumScore(user1, 101));
    }

    function test_SetMinCourierScore() public {
        assertEq(reputation.minCourierScore(), 50);

        reputation.setMinCourierScore(200);

        assertEq(reputation.minCourierScore(), 200);
    }

    // ============ Fuzz Tests ============

    function testFuzz_MultipleRegistrations(uint8 numUsers) public {
        numUsers = uint8(bound(numUsers, 1, 50));

        for (uint256 i = 0; i < numUsers; i++) {
            address user = address(uint160(i + 1000));
            vm.prank(user);
            uint256 tokenId = reputation.register(i % 2 == 0);

            assertEq(tokenId, i + 1);
            assertTrue(reputation.isRegistered(user));
        }
    }

    function testFuzz_ScoreNeverExceedsMax(uint8 numDeliveries) public {
        numDeliveries = uint8(bound(numDeliveries, 1, 200));

        vm.prank(user1);
        reputation.register(true);

        for (uint256 i = 0; i < numDeliveries; i++) {
            vm.prank(escrow);
            reputation.recordSuccessfulDelivery(user1);
        }

        uint256 score = reputation.getReputationScore(user1);
        assertLe(score, 1000); // MAX_SCORE
    }
}
