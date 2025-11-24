// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FixedPointMathLib} from "@solady/src/utils/FixedPointMathLib.sol";

interface IEntropyConsumer {
    function getEntropy() external view returns (address);
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;
}

interface IEntropy {
    function requestV2(
        address provider,
        bytes32 userRandomNumber,
        uint32 callbackGasLimit
    ) external payable returns (uint64);

    function getFee(address provider) external view returns (uint128);
}

contract Horsey is IEntropyConsumer {
    enum Horse {
        NONE,
        ONE,
        TWO,
        THREE,
        FOUR,
        FIVE,
        SIX,
        SEVEN
    }

    event BetPlaced(address indexed bettor, uint256 indexed shareId, uint256 indexed raceIndex, Horse horse, uint256 amount);
    event RaceStarted(uint256 indexed raceIndex, uint256 startBlock, uint256 endBlock);
    event RaceRequested(uint256 indexed raceIndex, uint64 indexed sequenceNumber);
    event RaceResolved(uint256 indexed raceIndex, Horse indexed winner);

    struct Share {
        uint256 deposit;
        Horse horse;
        uint256 raceIndex;
        bool claimed;
        address bettor;
    }

    uint256 currentRace = 0;
    mapping(address => uint256[]) public bettorShares;
    uint256 shareIndex = 0;
    mapping(uint256 => Share) public shares;

    uint256 constant MINIMUM_BET = 0.00001 ether;
    uint256 constant BETTING_WINDOW = 50; // Number of blocks betting is open

    address public resolver;
    address public immutable entropy;
    address public immutable entropyProvider;

    // Betting window tracking
    uint256 public currentRaceStartBlock;

    // Map entropy sequence numbers to race indices
    mapping(uint64 => uint256) public sequenceToRace;

    constructor(address _resolver, address _entropy, address _entropyProvider) {
        if (_resolver == address(0)) revert();
        if (_entropy == address(0)) revert();
        if (_entropyProvider == address(0)) revert();

        resolver = _resolver;
        entropy = _entropy;
        entropyProvider = _entropyProvider;

        // Initialize first race betting window
        currentRaceStartBlock = block.number;

        emit RaceStarted(0, block.number, block.number + BETTING_WINDOW);
    }

    struct Race {
        mapping(Horse => uint256) horsePool;
        uint256 total;
        Horse winner;
        bool requested;
    }
    mapping(uint256 => Race) public races;

    function bet(Horse _horse) public payable returns (uint256) {
        // Check betting window is still open
        require(
            block.number < currentRaceStartBlock + BETTING_WINDOW,
            "Betting window closed"
        );

        shares[shareIndex] = Share({
            deposit: msg.value,
            horse: _horse,
            raceIndex: currentRace,
            claimed: false,
            bettor: msg.sender
        });

        races[currentRace].horsePool[_horse] += msg.value;
        races[currentRace].total += msg.value;

        emit BetPlaced(msg.sender, shareIndex, currentRace, _horse, msg.value);

        shareIndex++;
        return shareIndex - 1;
    }

    // IEntropyConsumer implementation
    function getEntropy() external view returns (address) {
        return entropy;
    }

    // Request randomness for the current race
    // Can only be called after betting window closes (at block startBlock + BETTING_WINDOW or later)
    function requestRaceResolution() public payable {
        require(
            block.number >= currentRaceStartBlock + BETTING_WINDOW,
            "Betting window still open"
        );
        require(!races[currentRace].requested, "Already requested");

        races[currentRace].requested = true;

        // Generate user random number from current state
        bytes32 userRandomNumber = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                currentRace,
                races[currentRace].total
            )
        );

        // Get the fee and request randomness
        uint128 fee = IEntropy(entropy).getFee(entropyProvider);
        require(msg.value >= fee, "Insufficient fee");

        uint64 sequenceNumber = IEntropy(entropy).requestV2{value: fee}(
            entropyProvider,
            userRandomNumber,
            500000 // Gas limit for callback
        );

        sequenceToRace[sequenceNumber] = currentRace;

        emit RaceRequested(currentRace, sequenceNumber);

        // Refund excess payment
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    // Callback from Entropy contract with randomness
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider
        bytes32 randomNumber
    ) external {
        if (msg.sender != entropy) revert();

        uint256 raceIndex = sequenceToRace[sequenceNumber];
        if (races[raceIndex].winner != Horse.NONE) revert(); // Already resolved

        // Determine winner from randomness
        Horse winner = _determineWinner(randomNumber);

        races[raceIndex].winner = winner;

        emit RaceResolved(raceIndex, winner);

        // Only increment currentRace if this is the current race
        if (raceIndex == currentRace) {
            currentRace++;
            // Reset betting window for new race
            currentRaceStartBlock = block.number;

            emit RaceStarted(currentRace, block.number, block.number + BETTING_WINDOW);
        }
    }

    // Generate independent random values for each horse and determine winner
    function _determineWinner(bytes32 randomSeed) internal pure returns (Horse) {
        uint256[7] memory values;

        // Generate independent random value for each horse
        values[0] = uint256(keccak256(abi.encodePacked(randomSeed, "horse1")));
        values[1] = uint256(keccak256(abi.encodePacked(randomSeed, "horse2")));
        values[2] = uint256(keccak256(abi.encodePacked(randomSeed, "horse3")));
        values[3] = uint256(keccak256(abi.encodePacked(randomSeed, "horse4")));
        values[4] = uint256(keccak256(abi.encodePacked(randomSeed, "horse5")));
        values[5] = uint256(keccak256(abi.encodePacked(randomSeed, "horse6")));
        values[6] = uint256(keccak256(abi.encodePacked(randomSeed, "horse7")));

        // Find the horse with the highest value
        uint256 maxValue = values[0];
        uint8 winnerIndex = 0;

        for (uint8 i = 1; i < 7; i++) {
            if (values[i] > maxValue) {
                maxValue = values[i];
                winnerIndex = i;
            }
        }

        // Convert index to Horse enum (ONE = 1, TWO = 2, etc.)
        return Horse(winnerIndex + 1);
    }

    function claim(uint256[] calldata _shareIds) public {
        uint256 totalClaim = 0;
        for (uint256 i = 0; i < _shareIds.length; i++) {
            Share storage share = shares[_shareIds[i]];
            if (share.bettor != msg.sender) revert();
            // should this ever happen?
            if (share.claimed) continue;
            Horse winner = races[share.raceIndex].winner;
            if (winner == Horse.NONE) continue;

            if (winner == share.horse) {
                uint256 total = races[share.raceIndex].total;
                totalClaim += FixedPointMathLib.fullMulDiv(total, share.deposit, races[share.raceIndex].horsePool[share.horse]);
            }

            share.claimed = true;
        }

        if (totalClaim > 0) {
            (bool success, ) = payable(msg.sender).call{value: totalClaim}("");
            if (!success) revert();
        }
    }

    function getHorseNames() public pure returns (string[7] memory) {
        return [
            "Godolphin Verlaine",
            "Stand and Deliver",
            "Kesgrave Point",
            "Hecton",
            "Silverback Challenge",
            "Despite Everything",
            "Never Say Die"
        ];
    }
}
