UNAUDITED CODE INTENDED FOR TESTING AND EDUCATIONAL PURPOSES ONLY
DO NOT DEPLOY TO PRODUCTION

# Horsey: Verifiable Random Horse Racing DApp

A decentralized horse racing betting application with verifiable random race resolution using Pyth Entropy, built with Foundry smart contracts and indexed with Ponder.

## ⚡ TL;DR

```bash
# Install dependencies (first time only)
cd horsey-foundry && npm install && forge install && cd ..
cd horsey-ponder && npm install && cd ..
cd horsey-app && npm install && cd ..

# Start everything
./horsey.sh start

# Open http://localhost:5173 to see the live app
# Run './horsey.sh simulate' for continuous betting activity
# Run './horsey.sh stop' when done
```

## 🏗️ Project Structure

```
foundry-wagmi-ponder/
├── horsey-foundry/          # Foundry smart contracts
│   ├── src/
│   │   ├── Horsey.sol       # Main parimutuel betting contract
│   │   └── MockEntropy.sol  # Mock Pyth Entropy for local testing
│   ├── script/
│   │   ├── Deploy.s.sol     # Deployment scripts
│   │   ├── Bet.s.sol        # Contract-aware betting script
│   │   └── ResolveRace.s.sol # Entropy resolution script
│   ├── test/                # Contract tests
│   └── broadcast/           # Deployment artifacts
│
├── horsey-ponder/           # Ponder indexer & API
│   ├── src/
│   │   ├── index.ts         # Event handlers
│   │   └── api/index.ts     # Custom API endpoints
│   ├── abis/                # Contract ABIs (auto-generated via wagmi)
│   ├── ponder.config.ts     # Ponder configuration
│   └── ponder.schema.ts     # Database schema
│
├── horsey.sh                # Main control script (start/stop/clean/status)
├── start-local.sh           # Anvil + deploy only (used by horsey.sh)
├── simulate-betting.sh      # Continuous betting simulator
└── README.md                # This file
```

## 🎯 What is Horsey?

Horsey is a parimutuel betting smart contract with **verifiable random race resolution** that allows users to:
- **Place bets** on horses (1-7) during a 50-block betting window
- **Resolve races** using Pyth Entropy for provably fair random outcomes
- **Claim winnings** proportional to their share of the winning pool

The Ponder indexer tracks all events, providing GraphQL and SQL APIs for querying bets, races, and unclaimed shares.

### How It Works

1. **Betting Window**: Each race has a 50-block betting window where users can place bets
2. **Entropy Request**: After betting closes, anyone can request entropy to resolve the race
3. **Random Resolution**: Pyth Entropy provider fulfills the request with verifiable randomness
4. **Winner Selection**: The contract uses the random number to fairly determine the winning horse
5. **Claim Rewards**: Winners can claim their proportional share of the total pool

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [jq](https://jqlang.github.io/jq/download/) (for parsing JSON)

### Installation

```bash
# Install Foundry dependencies
cd horsey-foundry
npm install
forge install

# Install Ponder dependencies
cd ../horsey-ponder
npm install

# Install Frontend dependencies
cd ../horsey-app
npm install
```

### One-Command Full Stack Startup

```bash
./horsey.sh start
```

This will:
1. ✅ Start Anvil local node (port 8545)
2. ✅ Deploy Horsey and MockEntropy contracts
3. ✅ Start Ponder indexer (port 42069)
4. ✅ Start React frontend (port 5173)
5. ✅ Display all service URLs and PIDs

Then visit **http://localhost:5173** to see the live app! 🎉

### Control Script Commands

```bash
./horsey.sh start      # Start all services
./horsey.sh stop       # Stop all services
./horsey.sh restart    # Stop, clean, and restart everything
./horsey.sh status     # Check what's running
./horsey.sh clean      # Clean artifacts (broadcast, cache, db)
./horsey.sh simulate   # Run continuous betting simulator
./horsey.sh logs <svc> # Tail logs (anvil, ponder, app)
./horsey.sh help       # Show all commands
```

### Alternative: Manual Startup

If you prefer to run services separately:

```bash
# Terminal 1: Backend
./start-local.sh

# Terminal 2: Ponder
cd horsey-ponder && npm run dev

# Terminal 3: Frontend
cd horsey-app && npm run dev
```

## 🎮 Usage

### Place Bets (Foundry Scripts)

The contract-aware Foundry scripts validate betting window state before placing bets:

```bash
cd horsey-foundry
CONTRACT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# Place a single bet (horse 1-7, amount in wei)
PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 \
  forge script script/Bet.s.sol \
  --sig "placeBet(address,uint8,uint256)" $CONTRACT 3 100000000000000000 \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Place a random bet (random horse + amount)
PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 \
  forge script script/Bet.s.sol \
  --sig "placeRandomBet(address)" $CONTRACT \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Place multiple random bets at once
PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 \
  forge script script/Bet.s.sol \
  --sig "placeBatchBets(address,uint256)" $CONTRACT 5 \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Check current race state
forge script script/Bet.s.sol \
  --sig "getCurrentRaceInfo(address)" $CONTRACT \
  --rpc-url http://127.0.0.1:8545
```

### Resolve Races (Entropy Scripts)

```bash
cd horsey-foundry
CONTRACT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ENTROPY=0x5FbDB2315678afecb367f032d93F642f64180aa3
PROVIDER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

# Request race resolution (after betting window closes)
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  forge script script/ResolveRace.s.sol \
  --sig "requestResolution(address)" $CONTRACT \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Fulfill entropy request (as provider)
PROVIDER_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a \
  forge script script/ResolveRace.s.sol \
  --sig "monitorAndFulfill(address,address)" $ENTROPY $PROVIDER \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Full cycle (request + fulfill)
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  PROVIDER_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a \
  forge script script/ResolveRace.s.sol \
  --sig "requestAndFulfill(address,address,address)" $CONTRACT $ENTROPY $PROVIDER \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### Continuous Betting Simulator

Run realistic betting simulation with 5 concurrent bettors:

```bash
./simulate-betting.sh
```

This script:
- Spawns 5 background bettor processes
- Places random bets continuously
- Closes betting windows by mining blocks
- Requests and fulfills entropy for race resolution
- Processes claims for winners
- Loops through multiple races

### Query Data with Ponder

#### REST API Endpoints

```bash
# Get all shares for an address
curl http://localhost:42069/shares/0x90F79bf6EB2c4f870365E785982E1f101E93b906 | jq

# Get only unclaimed winning shares
curl http://localhost:42069/unclaimed/0x90F79bf6EB2c4f870365E785982E1f101E93b906 | jq

# Get race statistics
curl http://localhost:42069/races | jq
```

#### GraphQL API

Visit **http://localhost:42069** and run queries:

```graphql
{
  bets(limit: 10, orderBy: "blockNumber", orderDirection: "desc") {
    items {
      id
      bettor
      shareId
      raceIndex
      horse
      amount
      claimed
      timestamp
    }
  }

  races(limit: 5, orderBy: "raceIndex", orderDirection: "desc") {
    items {
      id
      raceIndex
      winner
      startBlock
      endBlock
      resolvedTimestamp
    }
  }
}
```

#### SQL API

```bash
# Direct SQL queries
curl -X POST http://localhost:42069/sql \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM bet WHERE bettor = '\''0x90F79bf6EB2c4f870365E785982E1f101E93b906'\''"}' \
  | jq
```

## 🛠️ Development

### Contract Development

```bash
cd horsey-foundry

# Run tests
forge test -vv

# Build contracts
forge build

# Generate ABIs for Ponder (auto-updates horsey-ponder/abis/)
npm run wagmi:generate

# Watch mode (auto-regenerate on changes)
npm run wagmi:watch
```

### Ponder Development

```bash
cd horsey-ponder

# Start development server
npm run dev

# Type check
npm run typecheck

# Generate types from schema
npm run codegen

# Access database
npm run db
```

### Development Workflow

1. **Edit contract**: Modify `horsey-foundry/src/Horsey.sol`
2. **Compile**: Run `forge build` in `horsey-foundry/`
3. **Generate ABIs**: Run `npm run wagmi:generate` in `horsey-foundry/`
4. **Redeploy**: Restart `start-local.sh`
5. **Restart Ponder**: Ponder will auto-detect the new deployment

## 📦 Key Features

### Smart Contracts

**Horsey.sol**
- Parimutuel betting with 7 horses
- 50-block betting windows
- Pyth Entropy integration for verifiable randomness
- Independent random value generation per horse
- Proportional payout system
- Claim mechanism for winners
- Events: `BetPlaced`, `RaceStarted`, `RaceRequested`, `RaceResolved`

**MockEntropy.sol**
- Local simulation of Pyth Entropy
- Request/fulfill pattern for randomness
- Provider registration and fee management
- Commitment-based randomness generation

### Ponder Indexer

- **Real-time indexing** of all Horsey events
- **Custom API endpoints** for unclaimed shares
- **GraphQL & SQL** query interfaces
- **Hot reloading** on contract redeployment
- **Automatic address detection** from broadcast files
- **Schema tracking**: bets with claim status, races with resolution data

### Foundry Scripts

**Bet.s.sol** - Contract-aware betting
- Validates betting window before placing bets
- Single, random, or batch bet placement
- Current race info queries

**ResolveRace.s.sol** - Entropy-based resolution
- Request entropy for race resolution
- Fulfill entropy requests (as provider)
- Monitor and auto-fulfill pending requests
- Full cycle automation

## 🔧 Configuration

### Foundry

- **Compiler**: Solidity 0.8.27
- **Optimizer**: 9,999,999 runs
- **Network**: Anvil (localhost:8545, Chain ID 31337)
- **Dependencies**: Solady, Pyth Entropy SDK

### Ponder

- **Port**: 42069
- **Cache**: Disabled for Anvil (hot reloading)
- **RPC**: http://127.0.0.1:8545
- **Start Block**: Auto-detected from deployment
- **Contract Address**: Auto-detected from Horsey transaction

### Contract Parameters

- **Betting Window**: 50 blocks
- **Minimum Bet**: 0.00001 ETH
- **Entropy Fee**: 0.0001 ETH
- **Horses**: 7 (Godolphin Verlaine, Stand and Deliver, Kesgrave Point, Hecton, Silverback Challenge, Despite Everything, Never Say Die)

## 📝 Smart Contract Events

```solidity
event BetPlaced(
    address indexed bettor,
    uint256 indexed shareId,
    uint256 indexed raceIndex,
    Horse horse,
    uint256 amount
);

event RaceStarted(
    uint256 indexed raceIndex,
    uint256 startBlock,
    uint256 endBlock
);

event RaceRequested(
    uint256 indexed raceIndex,
    uint64 indexed sequenceNumber
);

event RaceResolved(
    uint256 indexed raceIndex,
    Horse indexed winner
);
```

## 🔗 Tech Stack

- **Smart Contracts**: [Foundry](https://book.getfoundry.sh/)
- **Randomness**: [Pyth Entropy](https://docs.pyth.network/entropy)
- **Indexer**: [Ponder](https://ponder.sh/)
- **Blockchain Integration**: [viem](https://viem.sh/)
- **ABI Generation**: [Wagmi CLI](https://wagmi.sh/cli)
- **Math Library**: [Solady](https://github.com/Vectorized/solady)

## 🔑 Default Anvil Accounts

For local testing:

| Account | Role | Address | Private Key |
|---------|------|---------|-------------|
| 0 | Deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 1 | Resolver | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | Entropy Provider | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| 3-9 | Bettors | Various | Various |

**⚠️ Never use these keys on mainnet or with real funds!**

## 🐛 Troubleshooting

### Ponder shows "Broadcast file not found"

Deploy contracts first:
```bash
cd horsey-foundry
forge script script/Deploy.s.sol:DeployLocalScript \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### Betting script fails with "Betting window closed"

Check current race state:
```bash
forge script script/Bet.s.sol \
  --sig "getCurrentRaceInfo(address)" <CONTRACT> \
  --rpc-url http://127.0.0.1:8545
```

If closed, resolve the current race first, or wait for a new race to start.

### Ponder not indexing events

1. Check Ponder is monitoring the correct address (should be Horsey, not MockEntropy)
2. Verify `ponder.config.ts` uses the correct transaction index for Horsey
3. Restart Ponder: `Ctrl+C` and `npm run dev`

### Start fresh

```bash
# Stop all processes (Ctrl+C on each terminal)
pkill -f anvil
pkill -f ponder

# Clean local artifacts (run-latest.json will be regenerated on deploy)
rm -rf horsey-foundry/broadcast/Deploy.s.sol/31337/run-[0-9]*.json
rm -rf horsey-foundry/broadcast/Bet.s.sol/
rm -rf horsey-foundry/broadcast/ResolveRace.s.sol/
rm -rf horsey-foundry/cache/
rm -rf horsey-ponder/.ponder/

# Restart
./start-local.sh
# Then start Ponder in another terminal
```

### Git Ignore Strategy

The `.gitignore` is configured to:
- ✅ **Track** `broadcast/Deploy.s.sol/31337/run-latest.json` (Ponder needs this)
- ❌ **Ignore** timestamped deployment runs (`run-[0-9]*.json`)
- ❌ **Ignore** all script broadcasts (`Bet.s.sol/`, `ResolveRace.s.sol/`)
- ❌ **Ignore** cache and build artifacts

This ensures Ponder can auto-detect the contract address while keeping the repo clean.

## 🌟 Highlights

- **Verifiable Randomness** - Pyth Entropy ensures provably fair race outcomes
- **Contract-Aware Scripts** - Foundry scripts validate state before transactions
- **Zero-Config Indexing** - Ponder auto-detects contract addresses from deployments
- **Hot Reloading** - Redeploy and Ponder automatically re-indexes
- **Type-Safe** - End-to-end TypeScript types from Solidity to API
- **Full API Suite** - GraphQL, SQL, and custom REST endpoints
- **Developer-Friendly** - Comprehensive scripts and documentation

## 📚 Additional Documentation

- **Foundry Scripts**: See `horsey-foundry/script/README.md` for detailed script documentation
- **Ponder Schema**: Check `horsey-ponder/ponder.schema.ts` for database structure
- **API Reference**: Visit `http://localhost:42069` when Ponder is running

## 📄 License

MIT

## 🤝 Contributing

This is an educational project. Feel free to extend it with:
- Frontend interface with wallet connection
- Real Pyth Entropy integration for testnet/mainnet
- Advanced betting mechanics (exacta, trifecta, etc.)
- Historical race analytics
- Leaderboards and statistics
- Multi-chain deployment

---

Built with ❤️ using Foundry, Ponder, and Pyth Entropy
