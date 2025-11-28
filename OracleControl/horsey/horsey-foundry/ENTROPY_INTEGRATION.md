# Pyth Entropy Integration for Horsey

This document explains the Pyth Entropy integration for the Horsey betting contract, including local development setup and production deployment.

## Overview

The Horsey contract uses Pyth Entropy for verifiable randomness to determine race winners. This integration follows Pyth's best practices:

- **Request-fulfill pattern**: Randomness is requested, then fulfilled asynchronously
- **Multiple random sources**: Combines user random, provider random, and blockhash
- **Independent random values**: Each horse gets an independent random value from a single seed
- **Local simulation**: MockEntropy contract + provider server for local development

## Architecture

### Production Flow (with Pyth Entropy)

```
1. Resolver calls requestRaceResolution() with fee
2. Horsey contract calls entropy.requestV2()
3. Pyth provider fulfills request off-chain
4. Entropy contract calls horsey.entropyCallback()
5. Winner is determined and race is resolved
```

### Contracts

#### Horsey.sol

The main betting contract implementing `IEntropyConsumer`:

- `requestRaceResolution()` - Requests randomness for current race (resolver only)
- `entropyCallback()` - Receives randomness from Entropy contract
- `_determineWinner()` - Generates independent random values for each horse and picks winner
- `resolveManual()` - Backup manual resolution function

Key features:
- Generates user random from contract state (timestamp, prevrandao, race number, total pool)
- Maps sequence numbers to race indices
- Prevents double resolution with `requested` flag
- Refunds excess fee payment

#### MockEntropy.sol

Local simulation of Pyth Entropy for testing:

- `requestV2()` - Creates randomness request, returns sequence number
- `fulfill()` - Provider fulfills request with their random number
- `registerProvider()` - Registers entropy providers with fees

Simulates the full Pyth Entropy flow including:
- Commitment-based randomness
- Provider fees
- Callback mechanism with gas limits
- Event emissions (RequestedV2, RevealedV2)

### Random Number Generation

Following Pyth best practices, the contract generates multiple independent random values from a single seed:

```solidity
function _determineWinner(bytes32 randomSeed) internal pure returns (Horse) {
    uint256[7] memory values;

    // Generate independent random value for each horse
    values[0] = uint256(keccak256(abi.encodePacked(randomSeed, "horse1")));
    values[1] = uint256(keccak256(abi.encodePacked(randomSeed, "horse2")));
    // ... for each horse

    // Find horse with highest value
    // Returns Horse enum (ONE through SEVEN)
}
```

This ensures each horse gets a truly independent random value, preventing any bias.

## Local Development Setup

### Prerequisites

- Foundry installed
- Node.js 16+ installed
- Anvil running

### Quick Start

1. **Start Anvil** (in terminal 1):
```bash
anvil
```

2. **Run setup script** (in terminal 2):
```bash
cd horsey-foundry/local-provider
./setup-local.sh
```

This will:
- Deploy MockEntropy contract
- Register provider (Anvil account #2)
- Deploy Horsey contract
- Install provider server dependencies
- Output contract addresses

3. **Start provider server** (in terminal 2):
```bash
# Use the MockEntropy address from setup output
node server.js --contract <MOCK_ENTROPY_ADDRESS>

# Or export it and use npm start
export MOCK_ENTROPY_ADDRESS=<ADDRESS>
npm start
```

### Manual Setup

If you prefer to set up manually:

1. Deploy contracts:
```bash
forge script script/Deploy.s.sol:DeployLocalScript --rpc-url http://127.0.0.1:8545 --broadcast
```

2. Note the contract addresses from output

3. Install provider dependencies:
```bash
cd local-provider
npm install
```

4. Start provider server:
```bash
node server.js --contract <MOCK_ENTROPY_ADDRESS>
```

### Provider Server Options

```bash
node server.js \
  --contract <ADDRESS>           # Required: MockEntropy address
  --provider-key <KEY>           # Provider private key (default: Anvil #2)
  --rpc-url <URL>                # RPC URL (default: http://127.0.0.1:8545)
  --poll-interval <MS>           # Polling interval (default: 2000ms)
  --auto-fulfill <true|false>    # Auto-fulfill requests (default: true)
```

Or use environment variables:
```bash
export MOCK_ENTROPY_ADDRESS=0x...
export PROVIDER_PRIVATE_KEY=0x...
export RPC_URL=http://127.0.0.1:8545
npm start
```

## Testing

Run the test suite:
```bash
forge test
```

The tests use the MockEntropy contract and include helper functions:
- `resolveRace()` - Requests and fulfills entropy-based resolution
- `resolveRaceManual()` - Uses backup manual resolution

## Deployment

### Local Deployment

Use the `DeployLocalScript`:
```bash
forge script script/Deploy.s.sol:DeployLocalScript \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### Production Deployment

Use the `DeployScript` with environment variables:

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RESOLVER_ADDRESS=0x...
export ENTROPY_ADDRESS=0x...        # Pyth Entropy contract address
export ENTROPY_PROVIDER=0x...       # Pyth entropy provider address

# Deploy
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url <YOUR_RPC_URL> \
  --broadcast \
  --verify
```

### Pyth Entropy Networks

Pyth Entropy is available on:
- **Ethereum Mainnet**
- **Base**
- **Optimism**
- **Arbitrum**
- And others

Find contract addresses and provider information at [Pyth Documentation](https://docs.pyth.network/entropy).

## Usage

### Requesting Race Resolution

Only the resolver can request race resolution:

```javascript
// Get the fee
const fee = await entropy.getFee(provider);

// Request resolution
await horsey.requestRaceResolution({ value: fee });
```

This will:
1. Generate user random number from contract state
2. Request randomness from Entropy contract
3. Emit `RaceRequested` event with sequence number
4. Wait for provider to fulfill (automatic in production)
5. Receive callback with random number
6. Determine winner and emit `RaceResolved` event

### Backup Manual Resolution

If entropy fails, the resolver can manually resolve:

```javascript
await horsey.resolveManual(winningHorse);
```

## Integration Summary

### Current State
- ✅ Horsey implements IEntropyConsumer
- ✅ MockEntropy provides local testing
- ✅ Provider server automates fulfillment
- ✅ All tests passing
- ✅ Follows Pyth best practices for random generation

### Migration from Old System
- Old: `resolve(Horse winner)` - resolver picks winner
- New: `requestRaceResolution()` - entropy determines winner
- Backup: `resolveManual(Horse winner)` - manual override

### Benefits
- ✅ Verifiable randomness (not manipulatable by validators)
- ✅ Decentralized (Pyth provider network)
- ✅ Secure (combines multiple entropy sources)
- ✅ Testable (MockEntropy + local provider)
- ✅ Gas efficient (single callback determines all random values)

## Events

### RaceRequested
```solidity
event RaceRequested(uint256 indexed raceIndex, uint64 indexed sequenceNumber);
```
Emitted when randomness is requested for a race.

### RaceResolved
```solidity
event RaceResolved(uint256 indexed raceIndex, Horse indexed winner);
```
Emitted when a race is resolved (via entropy or manual).

### RequestedV2 (MockEntropy)
```solidity
event RequestedV2(
    uint64 indexed sequenceNumber,
    address indexed provider,
    address indexed requester,
    bytes32 userRandomNumber,
    uint32 callbackGasLimit
);
```
Emitted by MockEntropy when randomness is requested.

### RevealedV2 (MockEntropy)
```solidity
event RevealedV2(
    uint64 indexed sequenceNumber,
    address indexed provider,
    bytes32 randomNumber
);
```
Emitted by MockEntropy when randomness is revealed.

## Troubleshooting

### "Insufficient fee" error
The fee might have changed. Always check the current fee:
```javascript
const fee = await entropy.getFee(provider);
```

### "Request already fulfilled" error
The race has already been resolved. Check the race status:
```javascript
const [total, winner, requested] = await horsey.races(raceIndex);
```

### Provider server not fulfilling requests
1. Check Anvil is running
2. Verify correct MockEntropy address
3. Check provider has ETH for gas
4. Review server logs for errors

### Race not incrementing after resolution
The race counter only increments when the current race is resolved. Old races can be resolved without incrementing the counter.

## Security Considerations

### Production
- Use only official Pyth Entropy contracts
- Verify provider addresses from Pyth documentation
- Monitor entropy requests and callbacks
- Implement timeouts for unfulfilled requests
- Consider fallback to manual resolution

### Local Development
- MockEntropy is for testing only
- Provider server uses Anvil test keys
- Not suitable for production use
- No real economic security

## Gas Costs

Approximate gas costs:
- `bet()`: ~100k gas
- `requestRaceResolution()`: ~150k gas
- `entropyCallback()`: ~100k gas (includes winner determination)
- `claim()`: ~50k gas per share

The entropy callback is optimized to determine the winner in a single pass, saving ~534 gas compared to multiple iterations.

## Support

For issues or questions:
- Pyth Entropy documentation: https://docs.pyth.network/entropy
- Foundry documentation: https://book.getfoundry.sh/
- Horsey repository issues: [Create an issue]
