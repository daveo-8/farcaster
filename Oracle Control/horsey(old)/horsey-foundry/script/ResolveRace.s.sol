// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@forge/Script.sol";
import {Horsey} from "../src/Horsey.sol";
import {MockEntropy} from "../src/MockEntropy.sol";

/// @notice Script for resolving races using the entropy system
/// @dev This script handles both requesting entropy and fulfilling the request
///      In production, the provider would fulfill requests separately
/// Usage:
///   Request resolution:  forge script script/ResolveRace.s.sol --sig "requestResolution(address)" <horsey_contract> --rpc-url <url> --broadcast --private-key <resolver_key>
///   Full cycle:          forge script script/ResolveRace.s.sol --sig "requestAndFulfill(address,address,address)" <horsey> <entropy> <provider> --rpc-url <url> --broadcast --private-key <resolver_key>
contract ResolveRaceScript is Script {
    event RaceRequested(uint256 indexed raceIndex, uint64 indexed sequenceNumber);

    function requestResolution(address horseyAddress) public returns (uint64) {
        Horsey horsey = Horsey(horseyAddress);

        // Check if betting window is closed
        uint256 currentRaceStartBlock = horsey.currentRaceStartBlock();
        uint256 currentBlock = block.number;
        uint256 bettingCloseBlock = currentRaceStartBlock + 50;

        console.log("=== Race Resolution Request ===");
        console.log("Current Block:", currentBlock);
        console.log("Betting Close Block:", bettingCloseBlock);

        if (currentBlock < bettingCloseBlock) {
            console.log("ERROR: Betting window is still OPEN");
            console.log("Cannot request resolution until block:", bettingCloseBlock);
            revert("Betting window still open");
        }

        console.log("Betting window is CLOSED - proceeding with resolution request");

        // Get entropy fee
        address entropyAddress = horsey.entropy();
        address provider = horsey.entropyProvider();
        MockEntropy entropy = MockEntropy(entropyAddress);
        uint128 fee = entropy.getFee(provider);

        console.log("Entropy Contract:", entropyAddress);
        console.log("Provider:", provider);
        console.log("Fee Required:", fee);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address resolver = vm.addr(privateKey);

        console.log("Resolver:", resolver);
        console.log("Resolver Balance:", resolver.balance);

        vm.startBroadcast(privateKey);

        // Request race resolution
        horsey.requestRaceResolution{value: fee}();

        vm.stopBroadcast();

        // Get the sequence number from the last request
        uint64 sequenceNumber = entropy.sequenceNumber() - 1;

        console.log("Resolution requested successfully!");
        console.log("Sequence Number:", sequenceNumber);

        return sequenceNumber;
    }

    function fulfillRequest(
        address entropyAddress,
        address providerAddress,
        uint64 sequenceNumber
    ) public {
        MockEntropy entropy = MockEntropy(entropyAddress);

        console.log("=== Fulfilling Entropy Request ===");
        console.log("Entropy Contract:", entropyAddress);
        console.log("Provider:", providerAddress);
        console.log("Sequence Number:", sequenceNumber);

        // Check request exists and is not fulfilled
        (address requester, , , , bool fulfilled) = entropy.getRequest(sequenceNumber);

        if (requester == address(0)) {
            console.log("ERROR: Request does not exist");
            revert("Request does not exist");
        }

        if (fulfilled) {
            console.log("ERROR: Request already fulfilled");
            revert("Request already fulfilled");
        }

        console.log("Requester:", requester);

        // Generate provider random number
        bytes32 providerRandom = keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            sequenceNumber,
            "provider_entropy"
        ));

        console.log("Provider Random:");
        console.logBytes32(providerRandom);

        // Get provider's private key (for local testing)
        // In production, this would be done by the actual provider
        uint256 providerKey = vm.envOr(
            "PROVIDER_KEY",
            uint256(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a)
        );

        vm.startBroadcast(providerKey);

        entropy.fulfill(providerAddress, sequenceNumber, providerRandom);

        vm.stopBroadcast();

        console.log("Request fulfilled successfully!");

        // Query the race result
        Horsey horsey = Horsey(requester);
        // Note: We can't easily get the race index from sequence number without logs
        // So we just output success
    }

    function requestAndFulfill(
        address horseyAddress,
        address entropyAddress,
        address providerAddress
    ) public {
        console.log("=== Full Race Resolution Cycle ===");
        console.log("");

        // Step 1: Request resolution
        console.log("Step 1: Requesting resolution...");
        uint64 sequenceNumber = requestResolution(horseyAddress);

        console.log("");
        console.log("Step 2: Fulfilling request...");

        // Small delay to ensure state is updated (in real scenario, provider monitors events)
        vm.sleep(1000);

        // Step 2: Fulfill the request
        fulfillRequest(entropyAddress, providerAddress, sequenceNumber);

        console.log("");
        console.log("=== Race Resolution Complete ===");
    }

    function getCurrentRaceState(address horseyAddress) public view {
        Horsey horsey = Horsey(horseyAddress);

        uint256 currentRaceStartBlock = horsey.currentRaceStartBlock();
        uint256 currentBlock = block.number;
        uint256 bettingCloseBlock = currentRaceStartBlock + 50;

        console.log("=== Current Race State ===");
        console.log("Current Block:", currentBlock);
        console.log("Race Start Block:", currentRaceStartBlock);
        console.log("Betting Close Block:", bettingCloseBlock);

        if (currentBlock < bettingCloseBlock) {
            console.log("Status: BETTING OPEN");
            console.log("Blocks until resolution:", bettingCloseBlock - currentBlock);
        } else {
            console.log("Status: READY FOR RESOLUTION");
            console.log("Blocks since close:", currentBlock - bettingCloseBlock);
        }
    }

    function monitorAndFulfill(address entropyAddress, address providerAddress) public {
        MockEntropy entropy = MockEntropy(entropyAddress);
        uint64 currentSequence = entropy.sequenceNumber();

        console.log("=== Monitoring Entropy Requests ===");
        console.log("Current Sequence Number:", currentSequence);

        // Check recent unfulfilled requests (last 10)
        uint64 startSeq = currentSequence > 10 ? currentSequence - 10 : 1;

        for (uint64 i = startSeq; i < currentSequence; i++) {
            (address requester, , , , bool fulfilled) = entropy.getRequest(i);

            if (requester != address(0) && !fulfilled) {
                console.log("");
                console.log("Found unfulfilled request:");
                console.log("  Sequence:", i);
                console.log("  Requester:", requester);

                fulfillRequest(entropyAddress, providerAddress, i);
            }
        }
    }
}
