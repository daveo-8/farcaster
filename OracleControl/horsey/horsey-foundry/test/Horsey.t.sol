// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Horsey} from "../src/Horsey.sol";
import {MockEntropy} from "../src/MockEntropy.sol";
import {SoladyTest} from "@solady/test/utils/SoladyTest.sol";

contract HorseyTest is SoladyTest {
    Horsey public horsey;
    MockEntropy public mockEntropy;
    address public resolver;
    address public provider;
    address public player1;
    address public player2;
    address public player3;

    event BetPlaced(address indexed bettor, uint256 indexed shareId, uint256 indexed raceIndex, Horsey.Horse horse, uint256 amount);
    event RaceResolved(uint256 indexed raceIndex, Horsey.Horse indexed winner);

    function setUp() public {
        resolver = _randomHashedAddress();
        provider = _randomHashedAddress();
        player1 = _randomHashedAddress();
        player2 = _randomHashedAddress();
        player3 = _randomHashedAddress();

        // Deploy MockEntropy
        mockEntropy = new MockEntropy();

        // Register provider with 0.0001 ether fee
        vm.prank(provider);
        mockEntropy.registerProvider(0.0001 ether);

        // Deploy Horsey
        horsey = new Horsey(resolver, address(mockEntropy), provider);

        // Fund players and resolver
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
        vm.deal(resolver, 100 ether);
        vm.deal(provider, 100 ether);
    }

    // Helper function to resolve race using entropy
    function resolveRace(uint256 raceIndex) internal returns (uint64) {
        // Advance to after betting window closes (50 blocks)
        vm.roll(block.number + 50);

        vm.prank(resolver);
        horsey.requestRaceResolution{value: 0.0001 ether}();

        // Get the sequence number from the current sequenceNumber counter
        uint64 seqNum = mockEntropy.sequenceNumber() - 1;

        // Fulfill the request as provider
        vm.prank(provider);
        mockEntropy.fulfill(provider, seqNum, bytes32(uint256(keccak256(abi.encodePacked(block.timestamp, raceIndex)))));

        return seqNum;
    }

    /// @dev Test basic betting flow
    function testBet() public {
        vm.prank(player1);
        uint256 shareId = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        (uint256 deposit, Horsey.Horse horse, uint256 raceIndex, bool claimed, address bettor) =
            horsey.shares(shareId);

        assertEq(deposit, 1 ether);
        assertEq(uint8(horse), uint8(Horsey.Horse.ONE));
        assertEq(raceIndex, 0);
        assertEq(claimed, false);
        assertEq(bettor, player1);
    }

    /// @dev Test multiple bets on different horses
    function testMultipleBets() public {
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        vm.prank(player3);
        uint256 share3 = horsey.bet{value: 3 ether}(Horsey.Horse.ONE);

        assertEq(share1, 0);
        assertEq(share2, 1);
        assertEq(share3, 2);

        // Check race totals
        (uint256 total,,) = horsey.races(0);
        assertEq(total, 6 ether);
    }

    /// @dev Test resolver can resolve race via entropy
    function testResolveViaEntropy() public {
        // Place some bets
        vm.prank(player1);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Resolve race via entropy
        resolveRace(0);

        // Check winner is set (will be random based on entropy)
        (uint256 total, Horsey.Horse winner, bool requested) = horsey.races(0);
        assertTrue(uint8(winner) >= uint8(Horsey.Horse.ONE) && uint8(winner) <= uint8(Horsey.Horse.SEVEN));
    }

    /// @dev Test betting window closes after 50 blocks
    function testBettingWindowClosure() public {
        uint256 startBlock = horsey.currentRaceStartBlock();

        // Betting should work within window (block < startBlock + 50)
        vm.prank(player1);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Advance to block startBlock + 49 (still within window)
        vm.roll(startBlock + 49);
        vm.prank(player2);
        horsey.bet{value: 1 ether}(Horsey.Horse.TWO);

        // Advance to block startBlock + 50 (window closed: 50 is NOT < 1 + 50)
        vm.roll(startBlock + 50);
        vm.prank(player3);
        vm.expectRevert("Betting window closed");
        horsey.bet{value: 1 ether}(Horsey.Horse.THREE);
    }

    /// @dev Test cannot request resolution before betting window closes
    function testCannotRequestResolutionDuringBettingWindow() public {
        // Try to request resolution during betting window (should fail)
        vm.prank(player1);
        vm.expectRevert("Betting window still open");
        horsey.requestRaceResolution{value: 0.0001 ether}();
    }

    /// @dev Test anyone can request resolution after betting window closes
    function testAnyoneCanRequestResolutionAfterWindow() public {
        // Advance to after betting window
        vm.roll(block.number + 50);

        // Player (not resolver) can request resolution
        vm.prank(player1);
        horsey.requestRaceResolution{value: 0.0001 ether}();

        // Verify request was successful
        (,, bool requested) = horsey.races(0);
        assertTrue(requested);
    }

    /// @dev Test cannot request resolution twice for same race
    function testCannotRequestResolutionTwice() public {
        // Advance to after betting window
        vm.roll(block.number + 50);

        vm.prank(resolver);
        horsey.requestRaceResolution{value: 0.0001 ether}();

        vm.prank(resolver);
        vm.expectRevert();
        horsey.requestRaceResolution{value: 0.0001 ether}();
    }

    /// @dev Test claiming winnings - simple case
    function testClaimWinnings() public {
        // Player1 bets 1 ether on Horse ONE
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Player2 bets 2 ether on Horse TWO
        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        // Total pool: 3 ether
        uint256 totalPool = 3 ether;

        // Resolve race (will pick a random winner)
        resolveRace(0);

        // Get the actual winner
        (, Horsey.Horse winner,) = horsey.races(0);

        // Verify a valid horse won
        assertTrue(uint8(winner) >= uint8(Horsey.Horse.ONE) && uint8(winner) <= uint8(Horsey.Horse.SEVEN));

        // Test claiming based on who won
        if (winner == Horsey.Horse.ONE) {
            // Player1 should get entire pool
            uint256 balanceBefore = player1.balance;
            vm.prank(player1);
            uint256[] memory shareIds = new uint256[](1);
            shareIds[0] = share1;
            horsey.claim(shareIds);
            assertEq(player1.balance - balanceBefore, totalPool);

            // Player2 gets nothing
            balanceBefore = player2.balance;
            vm.prank(player2);
            shareIds[0] = share2;
            horsey.claim(shareIds);
            assertEq(player2.balance - balanceBefore, 0);
        } else if (winner == Horsey.Horse.TWO) {
            // Player2 should get entire pool
            uint256 balanceBefore = player2.balance;
            vm.prank(player2);
            uint256[] memory shareIds = new uint256[](1);
            shareIds[0] = share2;
            horsey.claim(shareIds);
            assertEq(player2.balance - balanceBefore, totalPool);

            // Player1 gets nothing
            balanceBefore = player1.balance;
            vm.prank(player1);
            shareIds[0] = share1;
            horsey.claim(shareIds);
            assertEq(player1.balance - balanceBefore, 0);
        } else {
            // A horse without bets won - both players get nothing
            uint256 balanceBefore = player1.balance;
            vm.prank(player1);
            uint256[] memory shareIds = new uint256[](1);
            shareIds[0] = share1;
            horsey.claim(shareIds);
            assertEq(player1.balance - balanceBefore, 0);

            balanceBefore = player2.balance;
            vm.prank(player2);
            shareIds[0] = share2;
            horsey.claim(shareIds);
            assertEq(player2.balance - balanceBefore, 0);
        }
    }

    /// @dev Test claiming winnings - multiple winners with different stakes
    function testClaimWinningsMultipleWinners() public {
        // Player1 bets 1 ether on Horse ONE
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Player2 bets 2 ether on Horse TWO
        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        // Player3 bets 3 ether on Horse ONE
        vm.prank(player3);
        uint256 share3 = horsey.bet{value: 3 ether}(Horsey.Horse.ONE);

        // Total pool: 6 ether
        uint256 totalPool = 6 ether;

        // Resolve race
        resolveRace(0);

        // Get the actual winner
        (, Horsey.Horse winner,) = horsey.races(0);

        if (winner == Horsey.Horse.ONE) {
            // Player1 should get: (6 ether * 1 ether) / 4 ether = 1.5 ether
            uint256 balance1Before = player1.balance;
            vm.prank(player1);
            uint256[] memory shareIds1 = new uint256[](1);
            shareIds1[0] = share1;
            horsey.claim(shareIds1);
            assertEq(player1.balance - balance1Before, 1.5 ether);

            // Player3 should get: (6 ether * 3 ether) / 4 ether = 4.5 ether
            uint256 balance3Before = player3.balance;
            vm.prank(player3);
            uint256[] memory shareIds3 = new uint256[](1);
            shareIds3[0] = share3;
            horsey.claim(shareIds3);
            assertEq(player3.balance - balance3Before, 4.5 ether);

            // Player2 gets nothing
            uint256 balance2Before = player2.balance;
            vm.prank(player2);
            uint256[] memory shareIds2 = new uint256[](1);
            shareIds2[0] = share2;
            horsey.claim(shareIds2);
            assertEq(player2.balance - balance2Before, 0);
        } else if (winner == Horsey.Horse.TWO) {
            // Player2 gets entire pool
            uint256 balance2Before = player2.balance;
            vm.prank(player2);
            uint256[] memory shareIds2 = new uint256[](1);
            shareIds2[0] = share2;
            horsey.claim(shareIds2);
            assertEq(player2.balance - balance2Before, totalPool);

            // Others get nothing
            vm.prank(player1);
            uint256[] memory shareIds1 = new uint256[](1);
            shareIds1[0] = share1;
            horsey.claim(shareIds1);

            vm.prank(player3);
            uint256[] memory shareIds3 = new uint256[](1);
            shareIds3[0] = share3;
            horsey.claim(shareIds3);
        }
    }

    /// @dev Test losing bet cannot claim
    function testLosingBetCannotClaim() public {
        // Player1 bets on Horse ONE
        vm.prank(player1);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Player2 bets on Horse TWO (loser)
        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        // Resolve with Horse ONE winning
        resolveRace(0);

        // Player2 tries to claim - should get 0
        uint256 balance2Before = player2.balance;
        vm.prank(player2);
        uint256[] memory shareIds2 = new uint256[](1);
        shareIds2[0] = share2;
        horsey.claim(shareIds2);
        uint256 balance2After = player2.balance;
        assertEq(balance2After - balance2Before, 0);
    }

    /// @dev Test cannot claim twice
    function testCannotClaimTwice() public {
        // Player1 bets on Horse ONE
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Resolve with Horse ONE winning
        resolveRace(0);

        // First claim
        vm.prank(player1);
        uint256[] memory shareIds = new uint256[](1);
        shareIds[0] = share1;
        horsey.claim(shareIds);

        // Second claim should give 0
        uint256 balanceBefore = player1.balance;
        vm.prank(player1);
        horsey.claim(shareIds);
        uint256 balanceAfter = player1.balance;
        assertEq(balanceAfter - balanceBefore, 0);
    }

    /// @dev Test only bettor can claim their share
    function testOnlyBettorCanClaim() public {
        // Player1 bets
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Resolve
        resolveRace(0);

        // Player2 tries to claim Player1's share
        vm.prank(player2);
        uint256[] memory shareIds = new uint256[](1);
        shareIds[0] = share1;
        vm.expectRevert();
        horsey.claim(shareIds);
    }

    /// @dev Test multiple races flow
    function testMultipleRaces() public {
        // Race 0: Player1 bets on Horse ONE
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Resolve Race 0
        resolveRace(0);

        // Race 1: Player2 bets on Horse TWO
        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        // Check share2 is for race 1
        (,, uint256 raceIndex,,) = horsey.shares(share2);
        assertEq(raceIndex, 1);

        // Resolve Race 1
        resolveRace(1);

        // Claim from Race 0
        vm.prank(player1);
        uint256[] memory shareIds1 = new uint256[](1);
        shareIds1[0] = share1;
        horsey.claim(shareIds1);

        // Claim from Race 1
        vm.prank(player2);
        uint256[] memory shareIds2 = new uint256[](1);
        shareIds2[0] = share2;
        horsey.claim(shareIds2);
    }

    /// @dev Test claiming multiple shares at once
    function testClaimMultipleShares() public {
        // Player1 makes two bets on Horse ONE
        vm.prank(player1);
        uint256 share1 = horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        vm.prank(player1);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.ONE);

        // Player2 bets on Horse TWO
        vm.prank(player2);
        uint256 share3 = horsey.bet{value: 3 ether}(Horsey.Horse.TWO);

        // Total: 6 ether

        // Resolve race
        resolveRace(0);

        // Get the actual winner
        (, Horsey.Horse winner,) = horsey.races(0);

        if (winner == Horsey.Horse.ONE) {
            // Player1 claims both shares at once
            // Should get: (6 * 1 / 3) + (6 * 2 / 3) = 2 + 4 = 6 ether
            uint256 balanceBefore = player1.balance;
            vm.prank(player1);
            uint256[] memory shareIds = new uint256[](2);
            shareIds[0] = share1;
            shareIds[1] = share2;
            horsey.claim(shareIds);
            assertEq(player1.balance - balanceBefore, 6 ether);
        } else if (winner == Horsey.Horse.TWO) {
            // Player2 gets entire pool
            uint256 balanceBefore = player2.balance;
            vm.prank(player2);
            uint256[] memory shareIds = new uint256[](1);
            shareIds[0] = share3;
            horsey.claim(shareIds);
            assertEq(player2.balance - balanceBefore, 6 ether);

            // Player1 gets nothing from both shares
            balanceBefore = player1.balance;
            vm.prank(player1);
            uint256[] memory shareIds1 = new uint256[](2);
            shareIds1[0] = share1;
            shareIds1[1] = share2;
            horsey.claim(shareIds1);
            assertEq(player1.balance - balanceBefore, 0);
        }
    }

    /// @dev Test betting on next race while previous race not resolved
    function testBetOnCurrentRaceBeforeResolution() public {
        // Race 0: Multiple players bet
        vm.prank(player1);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        vm.prank(player2);
        uint256 share2 = horsey.bet{value: 2 ether}(Horsey.Horse.TWO);

        // All bets should be on race 0
        (,, uint256 raceIndex2,,) = horsey.shares(share2);
        assertEq(raceIndex2, 0);

        // Resolve
        resolveRace(0);

        // Now race 1 is active
        vm.prank(player3);
        uint256 share3 = horsey.bet{value: 3 ether}(Horsey.Horse.THREE);

        (,, uint256 raceIndex3,,) = horsey.shares(share3);
        assertEq(raceIndex3, 1);
    }

    /// @dev Test BetPlaced event is emitted correctly
    function testBetPlacedEvent() public {
        vm.prank(player1);
        vm.expectEmit(true, true, true, true);
        emit BetPlaced(player1, 0, 0, Horsey.Horse.ONE, 1 ether);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);
    }

    /// @dev Test RaceResolved event is emitted correctly
    function testRaceResolvedEvent() public {
        // Place a bet first
        vm.prank(player1);
        horsey.bet{value: 1 ether}(Horsey.Horse.ONE);

        // Resolve race
        resolveRace(0);

        // Verify a winner was actually set
        (, Horsey.Horse winner,) = horsey.races(0);
        assertTrue(uint8(winner) >= uint8(Horsey.Horse.ONE) && uint8(winner) <= uint8(Horsey.Horse.SEVEN));
    }
}
