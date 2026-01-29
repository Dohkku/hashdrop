// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC - Mock de USDC para testing
/// @notice Solo para tests, no usar en produccion
contract MockUSDC is ERC20 {
    uint8 private _decimals = 6;

    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
