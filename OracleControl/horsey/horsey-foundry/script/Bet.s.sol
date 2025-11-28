// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@forge/Script.sol";
import {Horsey} from "../src/Horsey.sol";

/// @notice Script for placing bets on horse races
/// @dev Usage:
///   Single bet:   forge script script/Bet.s.sol --sig "placeBet(address,uint8,uint256)" <contract> <horse> <amount_wei> --rpc-url <url> --broadcast --private-key <key>
///   Random bet:   forge script script/Bet.s.sol --sig "placeRandomBet(address)" <contract> --rpc-url <url> --broadcast --private-key <key>
///   Batch bets:   forge script script/Bet.s.sol --sig "placeBatchBets(address,uint256)" <contract> <count> --rpc-url <url> --broadcast --private-key <key>
contract BetScript is Script {
    function placeBet(address horseyAddress, uint8 horse, uint256 amount) public {
        require(horse >= 1 && horse <= 7, "Invalid horse number (1-7)");

        Horsey horsey = Horsey(horseyAddress);

        // Check if betting window is still open
        uint256 currentRaceStartBlock = horsey.currentRaceStartBlock();
        uint256 currentBlock = block.number;

        console.log("Current Race Start Block:", currentRaceStartBlock);
        console.log("Current Block:", currentBlock);
        console.log("Betting Window Closes At:", currentRaceStartBlock + 50);

        if (currentBlock >= currentRaceStartBlock + 50) {
            console.log("WARNING: Betting window is CLOSED");
            revert("Betting window closed");
        }

        uint256 blocksRemaining = (currentRaceStartBlock + 50) - currentBlock;
        console.log("Blocks Remaining in Betting Window:", blocksRemaining);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address bettor = vm.addr(privateKey);

        console.log("Bettor:", bettor);
        console.log("Betting on Horse:", horse);
        console.log("Amount:", amount);

        vm.startBroadcast(privateKey);

        uint256 shareId = horsey.bet{value: amount}(Horsey.Horse(horse));

        console.log("Bet placed successfully!");
        console.log("Share ID:", shareId);

        vm.stopBroadcast();
    }

    function placeRandomBet(address horseyAddress) public {
        // Generate random horse (1-7)
        uint8 horse = uint8((uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao))) % 7) + 1);

        // Generate random amount between 0.01 and 0.5 ETH
        uint256 amount = ((uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, horse))) % 49) + 1) * 0.01 ether;

        console.log("Placing random bet:");
        console.log("  Horse:", horse);
        console.log("  Amount:", amount);

        placeBet(horseyAddress, horse, amount);
    }

    function placeBatchBets(address horseyAddress, uint256 count) public {
        Horsey horsey = Horsey(horseyAddress);

        // Check if betting window is still open
        uint256 currentRaceStartBlock = horsey.currentRaceStartBlock();
        uint256 currentBlock = block.number;

        if (currentBlock >= currentRaceStartBlock + 50) {
            console.log("ERROR: Betting window is CLOSED");
            revert("Betting window closed");
        }

        uint256 blocksRemaining = (currentRaceStartBlock + 50) - currentBlock;
        console.log("Betting window open for", blocksRemaining, "more blocks");
        console.log("Placing", count, "bets...");
        console.log("");

        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);

        for (uint256 i = 0; i < count; i++) {
            // Generate pseudo-random values
            uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, i)));
            uint8 horse = uint8((seed % 7) + 1);
            uint256 amount = ((seed % 49) + 1) * 0.01 ether;

            uint256 shareId = horsey.bet{value: amount}(Horsey.Horse(horse));

            console.log("Bet", i + 1, "- Horse:", horse);
            console.log("  Amount:", amount, "Share ID:", shareId);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("All bets placed successfully!");
    }

    function getCurrentRaceInfo(address horseyAddress) public view {
        Horsey horsey = Horsey(horseyAddress);

        uint256 currentRaceStartBlock = horsey.currentRaceStartBlock();
        uint256 currentBlock = block.number;
        uint256 bettingCloseBlock = currentRaceStartBlock + 50;

        console.log("=== Current Race Information ===");
        console.log("Current Block:", currentBlock);
        console.log("Race Start Block:", currentRaceStartBlock);
        console.log("Betting Close Block:", bettingCloseBlock);

        if (currentBlock < bettingCloseBlock) {
            console.log("Status: BETTING OPEN");
            console.log("Blocks Remaining:", bettingCloseBlock - currentBlock);
        } else {
            console.log("Status: BETTING CLOSED");
            console.log("Blocks Since Close:", currentBlock - bettingCloseBlock);
        }
    }
}
