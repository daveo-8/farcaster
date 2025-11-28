// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IEntropyConsumer {
    function getEntropy() external view returns (address);
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;
}

contract MockEntropy {
    struct Request {
        address requester;
        bytes32 commitment;
        uint32 callbackGasLimit;
        uint128 feeAmount;
        bool fulfilled;
    }

    event RequestedV2(
        uint64 indexed sequenceNumber,
        address indexed provider,
        address indexed requester,
        bytes32 userRandomNumber,
        uint32 callbackGasLimit
    );

    event RevealedV2(
        uint64 indexed sequenceNumber,
        address indexed provider,
        bytes32 randomNumber
    );

    event ProviderRegistered(address indexed provider);

    mapping(address => bool) public isProvider;
    mapping(address => uint128) public providerFees;
    mapping(uint64 => Request) public requests;

    uint64 public sequenceNumber;

    constructor() {
        sequenceNumber = 1;
    }

    function registerProvider(uint128 feeInWei) external {
        isProvider[msg.sender] = true;
        providerFees[msg.sender] = feeInWei;
        emit ProviderRegistered(msg.sender);
    }

    function getFee(address provider) external view returns (uint128) {
        return providerFees[provider];
    }

    function requestV2(
        address provider,
        bytes32 userRandomNumber,
        uint32 callbackGasLimit
    ) external payable returns (uint64) {
        require(isProvider[provider], "Provider not registered");

        uint128 fee = providerFees[provider];
        require(msg.value >= fee, "Insufficient fee");

        uint64 currentSequence = sequenceNumber;

        requests[currentSequence] = Request({
            requester: msg.sender,
            commitment: keccak256(abi.encodePacked(userRandomNumber, provider)),
            callbackGasLimit: callbackGasLimit,
            feeAmount: fee,
            fulfilled: false
        });

        emit RequestedV2(
            currentSequence,
            provider,
            msg.sender,
            userRandomNumber,
            callbackGasLimit
        );

        sequenceNumber++;

        return currentSequence;
    }

    function fulfill(
        address provider,
        uint64 _sequenceNumber,
        bytes32 providerRandomNumber
    ) external {
        require(isProvider[provider], "Provider not registered");

        Request storage request = requests[_sequenceNumber];
        require(request.requester != address(0), "Request does not exist");
        require(!request.fulfilled, "Request already fulfilled");

        // Combine commitment with provider random and blockhash for final randomness
        bytes32 randomNumber = keccak256(
            abi.encodePacked(
                request.commitment,
                providerRandomNumber,
                blockhash(block.number - 1)
            )
        );

        request.fulfilled = true;

        emit RevealedV2(_sequenceNumber, provider, randomNumber);

        // Call the consumer's callback
        try IEntropyConsumer(request.requester).entropyCallback{
            gas: request.callbackGasLimit
        }(_sequenceNumber, provider, randomNumber) {
            // Success
        } catch {
            // Callback failed but request is still marked as fulfilled
        }

        // Transfer fee to provider
        payable(provider).transfer(request.feeAmount);
    }

    function getRequest(uint64 _sequenceNumber) external view returns (
        address requester,
        bytes32 commitment,
        uint32 callbackGasLimit,
        uint128 feeAmount,
        bool fulfilled
    ) {
        Request memory request = requests[_sequenceNumber];
        return (
            request.requester,
            request.commitment,
            request.callbackGasLimit,
            request.feeAmount,
            request.fulfilled
        );
    }
}
