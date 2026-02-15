// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeliveryVerifier {
    /// @notice Verify a Groth16 ZK proof
    /// @param pA Proof element A (G1 point)
    /// @param pB Proof element B (G2 point)
    /// @param pC Proof element C (G1 point)
    /// @param pubSignals Public signals [valid, secretHash, orderId, courierAddress]
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[4] calldata pubSignals
    ) external view returns (bool);
}
