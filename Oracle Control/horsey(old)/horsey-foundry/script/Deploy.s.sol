// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@forge/Script.sol";
import {Horsey} from "../src/Horsey.sol";
import {MockEntropy} from "../src/MockEntropy.sol";

contract DeployScript is Script {
    function run() external {
        // Get the deployer's private key from environment or use default anvil key
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        address resolver = vm.envOr("RESOLVER_ADDRESS", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));
        address entropy = vm.envAddress("ENTROPY_ADDRESS");
        address entropyProvider = vm.envAddress("ENTROPY_PROVIDER");

        vm.startBroadcast(deployerPrivateKey);

        Horsey horsey = new Horsey(resolver, entropy, entropyProvider);

        console.log("Horsey deployed at:", address(horsey));
        console.log("Resolver:", resolver);
        console.log("Entropy:", entropy);
        console.log("Entropy Provider:", entropyProvider);

        vm.stopBroadcast();
    }
}

contract DeployLocalScript is Script {
    function run() external {
        // Get the deployer's private key from environment or use default anvil key
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        address resolver = vm.envOr("RESOLVER_ADDRESS", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));

        // Anvil account #2 for provider (has ETH)
        address provider = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
        uint256 providerPrivateKey = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockEntropy
        MockEntropy mockEntropy = new MockEntropy();
        console.log("MockEntropy deployed at:", address(mockEntropy));

        // Register provider with 0.0001 ether fee
        vm.stopBroadcast();

        vm.startBroadcast(providerPrivateKey);
        mockEntropy.registerProvider(0.0001 ether);
        console.log("Provider registered:", provider);

        vm.stopBroadcast();
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Horsey
        Horsey horsey = new Horsey(resolver, address(mockEntropy), provider);

        console.log("Horsey deployed at:", address(horsey));
        console.log("Resolver:", resolver);
        console.log("Entropy Provider:", provider);

        vm.stopBroadcast();
    }
}
