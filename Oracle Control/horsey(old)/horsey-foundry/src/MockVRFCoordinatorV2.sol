// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVRFConsumerV2Like {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

contract MockVRFCoordinatorV2 {
    uint256 public nextRequestId = 1;

    event RandomWordsRequested(uint256 indexed requestId, bytes32 keyHash, uint64 subId, uint32 callbackGasLimit, uint32 numWords);
    event RandomWordsFulfilled(uint256 indexed requestId);

    function requestRandomWords(
        bytes32 keyHash,
        uint64  subId,
        uint16  /*minConfirmations*/,
        uint32  callbackGasLimit,
        uint32  numWords
    ) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        emit RandomWordsRequested(requestId, keyHash, subId, callbackGasLimit, numWords);
    }

    // test helper: anyone can fulfill with chosen randomness
    function fulfill(address consumer, uint256 requestId, uint256 randomWord) external {
    uint256[] memory arr = new uint256[](1);
            arr[0] = randomWord;
        IVRFConsumerV2Like(consumer).rawFulfillRandomWords(requestId, arr);
        emit RandomWordsFulfilled(requestId);
    }
}
