// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputationSBT {
    // ============ Structs ============
    struct Reputation {
        uint256 score;
        uint256 totalDeliveries;
        uint256 successfulDeliveries;
        uint256 failedDeliveries;
        uint256 disputes;
        uint256 lastActivityTimestamp;
        bool isCourier;
        bool isActive;
    }

    // ============ Events ============
    event UserRegistered(address indexed user, bool isCourier, uint256 tokenId);

    event ReputationUpdated(address indexed user, uint256 newScore, uint256 totalDeliveries);

    event DisputeRecorded(address indexed user, bool wasAtFault);

    // ============ Errors ============
    error AlreadyRegistered();
    error NotRegistered();
    error TransferNotAllowed();
    error ScoreTooLow();

    // ============ Functions ============
    function register(bool asCourier) external returns (uint256 tokenId);

    function recordSuccessfulDelivery(address user) external;

    function recordFailedDelivery(address user) external;

    function recordDispute(address user, bool wasAtFault) external;

    function getReputationScore(address user) external view returns (uint256);

    function getReputation(address user) external view returns (Reputation memory);

    function isRegistered(address user) external view returns (bool);

    function meetsMinimumScore(address user, uint256 minScore) external view returns (bool);

    function minCourierScore() external view returns (uint256);
}
