#!/bin/bash

# Continuous Betting Simulation using Foundry Scripts
# Uses contract-aware Foundry scripts for state management and entropy resolution

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Get absolute path to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDRY_DIR="$SCRIPT_DIR/horsey-foundry"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🐎 Horsey DApp - Continuous Betting Simulation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Read contract addresses (use head -1 to get first match only)
CONTRACT_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "Horsey") | .contractAddress' $FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-latest.json | head -1)
ENTROPY_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockEntropy") | .contractAddress' $FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-latest.json | head -1)

echo -e "${GREEN}Horsey Contract:${NC}    $CONTRACT_ADDRESS"
echo -e "${GREEN}MockEntropy Contract:${NC} $ENTROPY_ADDRESS"
echo ""

# Anvil test account private keys (accounts 0-9)
PRIVATE_KEYS=(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"  # Account 0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  # Account 1 (Resolver)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"  # Account 2 (Entropy Provider)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"  # Account 3
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"  # Account 4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"  # Account 5
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"  # Account 6
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"  # Account 7
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"  # Account 8
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"  # Account 9
)

RESOLVER_KEY="${PRIVATE_KEYS[1]}"
PROVIDER_KEY="${PRIVATE_KEYS[2]}"
PROVIDER_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

# Bettor names for display
BETTOR_NAMES=("Alice" "Bob" "Charlie" "Diana" "Eve" "Frank" "Grace" "Henry")

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down simulation...${NC}"
  # Kill all background bettor processes
  jobs -p | xargs kill 2>/dev/null || true
  echo -e "${GREEN}✅ Simulation stopped${NC}"
  exit 0
}

trap cleanup INT TERM

# Function to get random number in range
random_range() {
  local min=$1
  local max=$2
  echo $((min + RANDOM % (max - min + 1)))
}

# Background bettor process - uses Foundry script
bettor_process() {
  local bettor_id=$1
  local private_key="${PRIVATE_KEYS[$bettor_id]}"
  local bettor_name="${BETTOR_NAMES[$((bettor_id - 3))]}"  # Offset for accounts 3-9

  cd "$FOUNDRY_DIR"

  while true; do
    # Random chance to place a bet (60% chance each iteration)
    if [ $((RANDOM % 100)) -lt 60 ]; then
      # Try to place a random bet (script will check if betting window is open)
      PRIVATE_KEY=$private_key forge script script/Bet.s.sol \
        --sig "placeRandomBet(address)" $CONTRACT_ADDRESS \
        --rpc-url http://127.0.0.1:8545 \
        --broadcast \
        --silent \
        > /dev/null 2>&1 || true  # Ignore errors (betting might be closed)
    fi

    # Wait 2-5 seconds before trying again
    sleep $(random_range 2 5)
  done
}

# Function to run a single race
run_race() {
  local race_num=$1
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🏁 Race #$race_num${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$FOUNDRY_DIR"

  # Display current race info
  echo -e "${CYAN}Checking race state...${NC}"
  forge script script/Bet.s.sol \
    --sig "getCurrentRaceInfo(address)" $CONTRACT_ADDRESS \
    --rpc-url http://127.0.0.1:8545 2>/dev/null || true

  echo ""
  echo -e "${GREEN}💰 Betting window open - bettors are placing bets...${NC}"
  echo ""

  # Let bettors bet for a while (wait for ~30-50 blocks)
  local betting_blocks=$(random_range 30 50)
  echo -e "${YELLOW}Waiting for $betting_blocks blocks of betting activity...${NC}"

  # Mine blocks to simulate time passing
  for ((i=1; i<=betting_blocks; i++)); do
    cast rpc anvil_mine 1 --rpc-url http://127.0.0.1:8545 > /dev/null 2>&1
    sleep 50
  done

  echo -e "${YELLOW}🔒 Betting window should be closed now${NC}"
  echo ""

  # Request race resolution
  echo -e "${GREEN}🎲 Requesting race resolution...${NC}"
  PRIVATE_KEY=$RESOLVER_KEY forge script script/ResolveRace.s.sol \
    --sig "requestResolution(address)" $CONTRACT_ADDRESS \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast 2>/dev/null || {
      echo -e "${RED}Failed to request resolution - may need to wait for betting window to close${NC}"
      return
    }

  echo ""
  echo -e "${YELLOW}⏳ Waiting for entropy provider to fulfill request...${NC}"

  # Small delay to simulate provider monitoring
  sleep 2

  # Fulfill the entropy request
  echo -e "${GREEN}🎰 Entropy provider fulfilling request...${NC}"
  cd "$FOUNDRY_DIR"
  PROVIDER_KEY=$PROVIDER_KEY forge script script/ResolveRace.s.sol \
    --sig "monitorAndFulfill(address,address)" $ENTROPY_ADDRESS $PROVIDER_ADDRESS \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast 2>/dev/null || {
      echo -e "${RED}Failed to fulfill request${NC}"
    }
  cd "$SCRIPT_DIR"

  echo ""
  echo -e "${GREEN}✅ Race #$race_num resolved${NC}"

  # Note: Claims can be queried via Ponder API at /unclaimed/:address
  # Winners can claim their shares using the Horsey contract claim() function
  echo ""
  echo -e "${CYAN}💸 Winners can claim via Ponder API: /unclaimed/:address${NC}"
  echo ""

  cd "$SCRIPT_DIR"
}

# Main simulation
echo -e "${YELLOW}Starting simulation with 5 concurrent bettors...${NC}"
echo ""

# Start bettor processes in background (accounts 3-7)
for i in {3..7}; do
  bettor_process $i &
done

echo -e "${GREEN}✅ All bettors active and betting${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the simulation${NC}"
echo ""

sleep 3

# Main race loop
RACE_NUMBER=1
while true; do
  run_race $RACE_NUMBER
  RACE_NUMBER=$((RACE_NUMBER + 1))

  # Brief pause between races
  echo -e "${BLUE}⏸️  Next race starting in 5 seconds...${NC}"
  sleep 5
done
