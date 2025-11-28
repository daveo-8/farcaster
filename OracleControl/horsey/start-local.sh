#!/bin/bash

# Local Development Startup Script
# Compiles contracts, starts Anvil, deploys contracts, and keeps running

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
FOUNDRY_DIR="horsey-foundry"
BROADCAST_DIR="$FOUNDRY_DIR/broadcast/Deploy.s.sol/31337"
ANVIL_PORT=8545
ANVIL_PID_FILE="/tmp/horsey_anvil.pid"
ANVIL_IP=http://0.0.0.0

# Cleanup function
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down...${NC}"

  # Kill Anvil if running
  if [ -f "$ANVIL_PID_FILE" ]; then
    ANVIL_PID=$(cat "$ANVIL_PID_FILE")
    if kill -0 $ANVIL_PID 2>/dev/null; then
      echo -e "${BLUE}Stopping Anvil (PID: $ANVIL_PID)...${NC}"
      kill $ANVIL_PID
    fi
    rm -f "$ANVIL_PID_FILE"
  fi

  echo -e "${GREEN}✅ Cleanup complete${NC}"
  exit 0
}

trap cleanup INT TERM

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🐎 Horsey DApp - Local Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Clean old broadcast files
echo -e "${YELLOW}🧹 Cleaning old broadcast files...${NC}"
if [ -d "$BROADCAST_DIR" ]; then
  # Keep only run-latest.json, delete all run-*.json files
  find "$BROADCAST_DIR" -name "run-*.json" ! -name "run-latest.json" -delete
  echo -e "${GREEN}✅ Cleaned broadcast directory${NC}"
else
  echo -e "${BLUE}ℹ️  No broadcast directory to clean${NC}"
fi
echo ""

# Step 2: Compile contracts
echo -e "${YELLOW}🔨 Compiling contracts...${NC}"
cd "$FOUNDRY_DIR"
forge build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Contract compilation failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Contracts compiled successfully${NC}"
echo ""

# Step 3: Check if Anvil is already running
if lsof -Pi :$ANVIL_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${RED}❌ Port $ANVIL_PORT is already in use${NC}"
  echo -e "${YELLOW}Please stop the existing process or use a different port${NC}"
  cd ..
  exit 1
fi

# Step 4: Start Anvil
echo -e "${YELLOW}🔥 Starting Anvil local node...${NC}"
anvil > /tmp/horsey_anvil.log 2>&1 &
ANVIL_PID=$!
echo $ANVIL_PID > "$ANVIL_PID_FILE"

# Wait for Anvil to start
sleep 2

# Verify Anvil is running
if ! kill -0 $ANVIL_PID 2>/dev/null; then
  echo -e "${RED}❌ Failed to start Anvil${NC}"
  cat /tmp/horsey_anvil.log
  cd ..
  exit 1
fi

echo -e "${GREEN}✅ Anvil running (PID: $ANVIL_PID)${NC}"
echo -e "${BLUE}   RPC: $ANVIL_IP:$ANVIL_PORT${NC}"
echo ""

# Step 5: Deploy contracts
echo -e "${YELLOW}🚀 Deploying contracts...${NC}"
#forge script script/Deploy.s.sol:DeployLocalScript \
#  --rpc-url $ANVIL_IP:$ANVIL_PORT \
#  --broadcast

forge create --rpc-url http://127.0.0.1:8545   --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   --broadcast   src/MockVRFCoordinatorV2.sol:MockVRFCoordinatorV2

forge create --rpc-url http://127.0.0.1:8545   --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   --broadcast   src/RaceParimutuelETH_VRF.sol:RaceParimutuelETH_VRF   --constructor-args   0x5FbDB2315678afecb367f032d93F642f64180aa3   0x0000000000000000000000000000000000000000000000000000000000000001   1   500000   0   0x0000000000000000000000000000000000000000



if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Contract deployment failed${NC}"
  cd ..
  cleanup
  exit 1
fi

echo -e "${GREEN}✅ Contracts deployed successfully${NC}"
echo ""

# Step 6: Display deployment info
CONTRACT_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "Horsey") | .contractAddress' broadcast/Deploy.s.sol/31337/run-latest.json 2>/dev/null)
ENTROPY_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockEntropy") | .contractAddress' broadcast/Deploy.s.sol/31337/run-latest.json 2>/dev/null)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Horsey Contract:${NC}    $CONTRACT_ADDRESS"
echo -e "${GREEN}MockEntropy Contract:${NC} $ENTROPY_ADDRESS"
echo -e "${GREEN}Anvil RPC:${NC}          $ANVIL_IP:$ANVIL_PORT"
echo ""
echo -e "${BLUE}Anvil Accounts:${NC}"
echo -e "  0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer)"
echo -e "  1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Resolver)"
echo -e "  2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Entropy Provider)"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo -e "   Anvil: tail -f /tmp/horsey_anvil.log"
echo ""
echo -e "${GREEN}🎮 Ready for testing!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

cd ..

# Keep script running and tail Anvil logs
tail -f /tmp/horsey_anvil.log
