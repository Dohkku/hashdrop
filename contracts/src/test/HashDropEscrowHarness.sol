// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../HashDropEscrow.sol";

/// @title HashDropEscrowHarness - Test harness for HashDropEscrow
/// @notice Exposes internal state manipulation for testing purposes only
/// @dev DO NOT DEPLOY TO PRODUCTION
contract HashDropEscrowHarness is HashDropEscrow {
    constructor(
        address _stablecoin,
        address _reputation,
        address _treasury,
        address _insurancePool
    ) HashDropEscrow(_stablecoin, _reputation, _treasury, _insurancePool) {}

    /// @notice Test helper to set order state directly
    /// @dev Only for testing - bypasses normal flow
    function setOrderState(uint256 orderId, OrderState newState) external {
        Order storage order = _orders[orderId];
        order.state = newState;
        if (newState == OrderState.PICKED_UP) {
            order.pickedUpAt = block.timestamp;
        }
    }

    /// @notice Expose internal orders mapping for testing
    function getOrderInternal(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }
}
