// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HashDropEscrow.sol";
import "../src/ReputationSBT.sol";
import "../src/mocks/MockUSDC.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address insurancePool = vm.envAddress("INSURANCE_POOL_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ReputationSBT
        ReputationSBT reputation = new ReputationSBT();
        console.log("ReputationSBT deployed at:", address(reputation));

        // 2. Deploy HashDropEscrow
        HashDropEscrow escrow = new HashDropEscrow(
            usdcAddress,
            address(reputation),
            treasury,
            insurancePool
        );
        console.log("HashDropEscrow deployed at:", address(escrow));

        // 3. Grant ESCROW_ROLE to HashDropEscrow
        reputation.grantEscrowRole(address(escrow));
        console.log("ESCROW_ROLE granted to HashDropEscrow");

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("ReputationSBT:", address(reputation));
        console.log("HashDropEscrow:", address(escrow));
        console.log("Treasury:", treasury);
        console.log("Insurance Pool:", insurancePool);
        console.log("USDC:", usdcAddress);
    }
}

contract DeployTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock USDC for testnet
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy ReputationSBT
        ReputationSBT reputation = new ReputationSBT();
        console.log("ReputationSBT deployed at:", address(reputation));

        // 3. Use deployer as treasury and insurance for testnet
        address deployer = vm.addr(deployerPrivateKey);

        // 4. Deploy HashDropEscrow
        HashDropEscrow escrow = new HashDropEscrow(
            address(usdc),
            address(reputation),
            deployer, // treasury
            deployer  // insurance pool
        );
        console.log("HashDropEscrow deployed at:", address(escrow));

        // 5. Grant ESCROW_ROLE
        reputation.grantEscrowRole(address(escrow));
        console.log("ESCROW_ROLE granted to HashDropEscrow");

        // 6. Mint some USDC to deployer for testing
        usdc.mint(deployer, 100_000e6); // 100k USDC
        console.log("Minted 100,000 USDC to deployer");

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Testnet Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("MockUSDC:", address(usdc));
        console.log("ReputationSBT:", address(reputation));
        console.log("HashDropEscrow:", address(escrow));
    }
}
