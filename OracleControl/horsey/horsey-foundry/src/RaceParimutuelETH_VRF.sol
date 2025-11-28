// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Fully on-chain winner selection using VRF.
 * - No owner / no oracle.
 * - Exactly 5 active races: anyone can create new races while activeCount < 5.
 * - Anyone can request VRF after a race locks; fulfill picks the winner.
 * - Pari-mutuel payout; pull-claim.
 *
 * For local Anvil testing, deploy the mock coordinator and pass its address here.
 * For live networks, pass the real VRF coordinator + keyHash/subId/callbackGasLimit.
 */

interface IVRFCoordinatorV2Like {
    function requestRandomWords(
        bytes32 keyHash,
        uint64  subId,
        uint16  minConfirmations,
        uint32  callbackGasLimit,
        uint32  numWords
    ) external returns (uint256 requestId);
}

abstract contract VRFConsumerV2Like {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external virtual;
}

contract RaceParimutuelETH_VRF is VRFConsumerV2Like {
    // ---- VRF config (immutable) ----
    IVRFCoordinatorV2Like public immutable vrf;
    bytes32 public immutable keyHash;
    uint64  public immutable subId;
    uint32  public immutable callbackGasLimit;
    uint16  public constant MIN_CONFIRMATIONS = 3;
    uint32  private constant NUM_WORDS = 1;

    // ---- App config ----
    uint256 public constant MAX_ACTIVE_RACES = 5;
    uint256 public constant MIN_RACERS = 3;
    uint256 public constant MAX_RACERS = 8;

    // Optional rake (set to 0 for fully decentralized feel). Immutable; cannot be changed.
    uint256 public immutable feeBps;          // e.g., 0 or up to 1000 (=10%)
    address public immutable feeRecipient;    // can be address(0) if feeBps=0

    // ---- Data ----
    struct Race {
        string name;
        string[] racers;          // 3..8
        uint64 startTime;         // informational
        uint64 lockTime;          // betting closes
        bool settled;
        uint8 winnerIndex;
        uint256 totalPool;
        uint256[] poolByRacer;    // length == racers.length
        bool vrfRequested;        // randomness already requested
    }

    uint256 public nextRaceId;
    uint256 public activeCount;
    mapping(uint256 => Race) public races;

    // bets[raceId][bettor][i] = amount on racer i
    mapping(uint256 => mapping(address => uint256[])) private betsByRacer;
    // claimed[raceId][bettor] = claimed already
    mapping(uint256 => mapping(address => bool)) public claimed;

    // VRF requestId => raceId
    mapping(uint256 => uint256) public requestToRace;

    // ---- Events ----
    event RaceCreated(uint256 indexed raceId, string name, string[] racers, uint64 startTime, uint64 lockTime);
    event BetPlaced(uint256 indexed raceId, address indexed bettor, uint8 racerIndex, uint256 amount);
    event SettlementRequested(uint256 indexed raceId, uint256 requestId);
    event RaceSettled(uint256 indexed raceId, uint8 winnerIndex);
    event Claimed(uint256 indexed raceId, address indexed bettor, uint256 amount);

    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64  _subId,
        uint32  _callbackGasLimit,
        uint256 _feeBps,
        address _feeRecipient
    ) {
        require(_vrfCoordinator != address(0), "vrf=0");
        require(_feeBps <= 1_000, "fee too high (>10%)");
        vrf = IVRFCoordinatorV2Like(_vrfCoordinator);
        keyHash = _keyHash;
        subId = _subId;
        callbackGasLimit = _callbackGasLimit;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    // ---- Permissionless: create races until we have 5 active ----
    function createRace(
        string memory name,
        string[] memory racers,
        uint64 startTime,
        uint64 lockTime
    ) external {
        require(activeCount < MAX_ACTIVE_RACES, "already 5 active");
        _createRace(name, racers, startTime, lockTime);
    }

    // ---- Betting ----
    function bet(uint256 raceId, uint8 racerIndex) external payable {
        require(msg.value > 0, "no value");
        Race storage r = races[raceId];
        require(r.racers.length >= MIN_RACERS, "race not found");
        require(!r.settled, "settled");
        require(block.timestamp < r.lockTime, "betting closed");
        require(racerIndex < r.racers.length, "bad index");

        uint256[] storage my = betsByRacer[raceId][msg.sender];
        if (my.length == 0) {
            betsByRacer[raceId][msg.sender] = new uint256[](r.racers.length);
            my = betsByRacer[raceId][msg.sender];
        } else {
            require(my.length == r.racers.length, "len mismatch");
        }

        my[racerIndex] += msg.value;
        r.poolByRacer[racerIndex] += msg.value;
        r.totalPool += msg.value;

        emit BetPlaced(raceId, msg.sender, racerIndex, msg.value);
    }

    // ---- Settlement flow (permissionless) ----
    // 1) Anyone can request randomness once lockTime has passed.
    function requestSettle(uint256 raceId) external returns (uint256 reqId) {
        Race storage r = races[raceId];
        require(r.racers.length >= MIN_RACERS, "race not found");
        require(!r.settled, "already settled");
        require(block.timestamp >= r.lockTime, "too early");
        require(!r.vrfRequested, "already requested");

        r.vrfRequested = true;
        reqId = vrf.requestRandomWords(
            keyHash,
            subId,
            MIN_CONFIRMATIONS,
            callbackGasLimit,
            NUM_WORDS
        );
        requestToRace[reqId] = raceId;
        emit SettlementRequested(raceId, reqId);
    }

    // 2) VRF callback picks winner and settles.
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external override {
        require(msg.sender == address(vrf), "only VRF");
        uint256 raceId = requestToRace[requestId];
        Race storage r = races[raceId];
        require(r.vrfRequested && !r.settled, "bad state");
        require(r.racers.length >= MIN_RACERS, "race missing");

        uint256 winner = randomWords[0] % r.racers.length;
        r.winnerIndex = uint8(winner);
        r.settled = true;

        if (activeCount > 0) activeCount -= 1;

        emit RaceSettled(raceId, r.winnerIndex);
    }

    // ---- Claim ----
    function claim(uint256 raceId) external {
        Race storage r = races[raceId];
        require(r.settled, "not settled");
        require(!claimed[raceId][msg.sender], "claimed");

        uint256[] storage my = betsByRacer[raceId][msg.sender];
        require(my.length == r.racers.length, "no bets");

        uint256 winnerPool = r.poolByRacer[r.winnerIndex];
        require(winnerPool > 0, "no winner pool");

        uint256 userStake = my[r.winnerIndex];
        claimed[raceId][msg.sender] = true;

        if (userStake == 0) {
            emit Claimed(raceId, msg.sender, 0);
            return;
        }

        uint256 fee = (r.totalPool * feeBps) / 10_000;
        uint256 distributable = r.totalPool - fee;
        uint256 payout = (distributable * userStake) / winnerPool;

        (bool ok1, ) = msg.sender.call{value: payout}("");
        require(ok1, "payout failed");

        if (fee > 0 && feeRecipient != address(0)) {
            uint256 feeShare = (fee * userStake) / winnerPool;
            (bool ok2, ) = payable(feeRecipient).call{value: feeShare}("");
            require(ok2, "fee send failed");
        }

        emit Claimed(raceId, msg.sender, payout);
    }

    // ---- Views ----
    function activeRaceIds() external view returns (uint256[] memory ids) {
        uint256 cap = nextRaceId;
        uint256 found;
        ids = new uint256[](MAX_ACTIVE_RACES);
        if (cap == 0) return ids;
        uint256 start = cap > 64 ? cap - 64 : 0;
        for (uint256 id = start; id < cap; id++) {
            Race storage r = races[id];
            if (r.racers.length >= MIN_RACERS && !r.settled) {
                ids[found++] = id;
                if (found == MAX_ACTIVE_RACES) break;
            }
        }
        assembly { mstore(ids, found) }
    }

    function getRace(uint256 raceId) external view returns (
        string memory name,
        string[] memory racers,
        uint64 startTime,
        uint64 lockTime,
        bool settled,
        uint8 winnerIndex,
        uint256 totalPool,
        uint256[] memory poolByRacer,
        bool vrfRequested
    ) {
        Race storage r = races[raceId];
        return (r.name, r.racers, r.startTime, r.lockTime, r.settled, r.winnerIndex, r.totalPool, r.poolByRacer, r.vrfRequested);
    }

    function previewPayout(uint256 raceId, address bettor) external view returns (uint256) {
        Race storage r = races[raceId];
        if (!r.settled) return 0;
        uint256[] storage my = betsByRacer[raceId][bettor];
        if (my.length != r.racers.length) return 0;
        uint256 winnerPool = r.poolByRacer[r.winnerIndex];
        if (winnerPool == 0) return 0;
        uint256 fee = (r.totalPool * feeBps) / 10_000;
        uint256 distributable = r.totalPool - fee;
        return (distributable * my[r.winnerIndex]) / winnerPool;
    }

    // ---- Internals ----
    function _createRace(
        string memory name,
        string[] memory racers,
        uint64 startTime,
        uint64 lockTime
    ) internal {
        require(bytes(name).length > 0, "name empty");
        require(racers.length >= MIN_RACERS && racers.length <= MAX_RACERS, "3..8 racers");
        require(lockTime > block.timestamp, "lock in future");
        require(startTime <= lockTime, "start <= lock");

        uint256 raceId = nextRaceId++;
        Race storage r = races[raceId];
        r.name = name;
        r.racers = racers;
        r.startTime = startTime;
        r.lockTime = lockTime;
        r.poolByRacer = new uint256[](racers.length);

        activeCount += 1;
        emit RaceCreated(raceId, name, racers, startTime, lockTime);
    }

    receive() external payable {}
}

