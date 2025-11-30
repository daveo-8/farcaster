# Horsey Foundry Scripts

This directory contains Foundry scripts for interacting with the Horsey contract in a contract-aware manner.

## Scripts Overview

### 1. Deploy.s.sol
Deployment scripts for the Horsey contract and MockEntropy.

**Usage:**
```bash
# Deploy to local Anvil (automatic in start-local.sh)
forge script script/Deploy.s.sol:DeployLocalScript \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### 2. Bet.s.sol
Place bets on horse races with automatic betting window validation.

**Features:**
- Checks if betting window is open before placing bets
- Single bet, random bet, or batch bets
- Query current race state

**Usage:**
```bash
# Place a single bet (horse 1-7, amount in wei)
PRIVATE_KEY=0x... forge script script/Bet.s.sol \
  --sig "placeBet(address,uint8,uint256)" <CONTRACT_ADDRESS> 3 100000000000000000 \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Place a random bet
PRIVATE_KEY=0x... forge script script/Bet.s.sol \
  --sig "placeRandomBet(address)" <CONTRACT_ADDRESS> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Place multiple random bets in one transaction
PRIVATE_KEY=0x... forge script script/Bet.s.sol \
  --sig "placeBatchBets(address,uint256)" <CONTRACT_ADDRESS> 5 \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Check current race info (view only)
forge script script/Bet.s.sol \
  --sig "getCurrentRaceInfo(address)" <CONTRACT_ADDRESS> \
  --rpc-url http://127.0.0.1:8545
```

### 3. ResolveRace.s.sol
Manage race resolution through the entropy system.

**Features:**
- Request entropy for race resolution
- Fulfill entropy requests (simulates provider)
- Full cycle automation
- Monitor and fulfill pending requests

**Usage:**
```bash
# Request race resolution (requires betting window to be closed)
PRIVATE_KEY=<RESOLVER_KEY> forge script script/ResolveRace.s.sol \
  --sig "requestResolution(address)" <CONTRACT_ADDRESS> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Fulfill a specific entropy request (as provider)
PROVIDER_KEY=<PROVIDER_KEY> forge script script/ResolveRace.s.sol \
  --sig "fulfillRequest(address,address,uint64)" <ENTROPY_ADDRESS> <PROVIDER_ADDRESS> <SEQUENCE_NUMBER> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Monitor and fulfill all pending requests
PROVIDER_KEY=<PROVIDER_KEY> forge script script/ResolveRace.s.sol \
  --sig "monitorAndFulfill(address,address)" <ENTROPY_ADDRESS> <PROVIDER_ADDRESS> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Full cycle: request + fulfill (development only)
PRIVATE_KEY=<RESOLVER_KEY> PROVIDER_KEY=<PROVIDER_KEY> forge script script/ResolveRace.s.sol \
  --sig "requestAndFulfill(address,address,address)" <CONTRACT_ADDRESS> <ENTROPY_ADDRESS> <PROVIDER_ADDRESS> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### 4. Claim.s.sol
Claim winnings from resolved races.

**Features:**
- Claim specific shares
- Automatically find and claim all winnings
- Display share information
- View all shares for an address

**Usage:**
```bash
# Automatically find and claim all winnings
PRIVATE_KEY=0x... forge script script/Claim.s.sol \
  --sig "findAndClaimWinnings(address)" <CONTRACT_ADDRESS> \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Claim specific share IDs
PRIVATE_KEY=0x... forge script script/Claim.s.sol \
  --sig "claimShares(address,uint256[])" <CONTRACT_ADDRESS> "[1,2,3]" \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# View info for a specific share (view only)
forge script script/Claim.s.sol \
  --sig "displayShareInfo(address,uint256)" <CONTRACT_ADDRESS> 0 \
  --rpc-url http://127.0.0.1:8545

# View all shares for an address (view only)
forge script script/Claim.s.sol \
  --sig "displayAllUserShares(address,address)" <CONTRACT_ADDRESS> <USER_ADDRESS> \
  --rpc-url http://127.0.0.1:8545
```

## Example Workflow

### Local Development

1. **Start the local environment:**
   ```bash
   ./start-local.sh
   ```

2. **Place some bets (from different accounts):**
   ```bash
   cd horsey-foundry

   # Account 3 bets
   PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 \
     forge script script/Bet.s.sol --sig "placeRandomBet(address)" <CONTRACT> \
     --rpc-url http://127.0.0.1:8545 --broadcast

   # Account 4 bets
   PRIVATE_KEY=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a \
     forge script script/Bet.s.sol --sig "placeBatchBets(address,uint256)" <CONTRACT> 3 \
     --rpc-url http://127.0.0.1:8545 --broadcast
   ```

3. **Wait for betting window to close (50 blocks), then resolve:**
   ```bash
   # Mine blocks to close betting window
   cast rpc anvil_mine 50 --rpc-url http://127.0.0.1:8545

   # Request resolution (account 1 is resolver)
   PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
     forge script script/ResolveRace.s.sol --sig "requestResolution(address)" <CONTRACT> \
     --rpc-url http://127.0.0.1:8545 --broadcast

   # Fulfill as provider (account 2)
   PROVIDER_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a \
     forge script script/ResolveRace.s.sol \
     --sig "monitorAndFulfill(address,address)" <ENTROPY> <PROVIDER> \
     --rpc-url http://127.0.0.1:8545 --broadcast
   ```

4. **Claim winnings:**
   ```bash
   # Check what account 3 can claim
   PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 \
     forge script script/Claim.s.sol --sig "findAndClaimWinnings(address)" <CONTRACT> \
     --rpc-url http://127.0.0.1:8545 --broadcast
   ```

### Automated Simulation

For continuous automated testing:

```bash
./simulate-betting-v2.sh
```

This script:
- Runs 5 concurrent bettors placing random bets
- Automatically closes betting windows by mining blocks
- Resolves races through entropy request/fulfill cycle
- Claims winnings for participants
- Loops continuously through multiple races

## Anvil Account Keys

For local testing, these are the default Anvil account private keys:

- Account 0 (Deployer): `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Account 1 (Resolver): `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- Account 2 (Provider): `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
- Accounts 3-9: Available for testing as bettors

## Benefits of Foundry Scripts vs Shell Scripts

1. **Contract-aware**: Scripts can read contract state and make intelligent decisions
2. **Type-safe**: Compile-time checks for function signatures and types
3. **Reusable**: Functions can be called programmatically or via CLI
4. **Better error handling**: Proper revert messages and validation
5. **Testable**: Can write tests for script logic
6. **Gas simulation**: See gas costs before broadcasting
