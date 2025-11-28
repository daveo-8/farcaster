#!/bin/bash

# Horsey DApp Control Script
# Manages all services: Anvil, Ponder, Frontend, and Simulator

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDRY_DIR="$SCRIPT_DIR/horsey-foundry"
PONDER_DIR="$SCRIPT_DIR/horsey-ponder"
APP_DIR="$SCRIPT_DIR/horsey-app"

# PID files
ANVIL_PID_FILE="/tmp/horsey_anvil.pid"
PONDER_PID_FILE="/tmp/horsey_ponder.pid"
APP_PID_FILE="/tmp/horsey_app.pid"
SIMULATOR_PID_FILE="/tmp/horsey_simulator.pid"

# Functions
print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🐎 Horsey DApp Control${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

check_port() {
  local port=$1
  lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

get_pid_from_file() {
  local pid_file=$1
  if [ -f "$pid_file" ]; then
    cat "$pid_file"
  fi
}

is_process_running() {
  local pid=$1
  if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

stop_service() {
  local name=$1
  local pid_file=$2
  local port=$3

  local pid=$(get_pid_from_file "$pid_file")

  if is_process_running "$pid"; then
    echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
    kill $pid 2>/dev/null || true
    sleep 1

    # Force kill if still running
    if is_process_running "$pid"; then
      echo -e "${YELLOW}Force killing $name...${NC}"
      kill -9 $pid 2>/dev/null || true
    fi
    rm -f "$pid_file"
    echo -e "${GREEN}✅ $name stopped${NC}"
  else
    # Try to kill by port if pid file is stale
    if [ -n "$port" ] && check_port $port; then
      echo -e "${YELLOW}Killing process on port $port...${NC}"
      lsof -ti :$port | xargs kill -9 2>/dev/null || true
      echo -e "${GREEN}✅ Process on port $port stopped${NC}"
    fi
    rm -f "$pid_file"
  fi
}

cmd_stop() {
  print_header
  echo -e "${YELLOW}Stopping all services...${NC}"
  echo ""

  # Stop simulator
  stop_service "Simulator" "$SIMULATOR_PID_FILE" ""
  pkill -f "simulate-betting.sh" 2>/dev/null || true

  # Stop frontend
  stop_service "Frontend" "$APP_PID_FILE" "5173"
  pkill -f "vite.*horsey-app" 2>/dev/null || true

  # Stop Ponder
  stop_service "Ponder" "$PONDER_PID_FILE" "42069"
  pkill -f "ponder dev" 2>/dev/null || true

  # Stop Anvil
  stop_service "Anvil" "$ANVIL_PID_FILE" "8545"
  pkill -f "anvil" 2>/dev/null || true

  # Stop start-local.sh wrapper
  pkill -f "start-local.sh" 2>/dev/null || true

  echo ""
  echo -e "${GREEN}✅ All services stopped${NC}"
}

cmd_clean() {
  print_header
  echo -e "${YELLOW}Cleaning artifacts...${NC}"
  echo ""

  # Stop everything first
  cmd_stop
  echo ""

  echo -e "${CYAN}Cleaning Foundry artifacts...${NC}"
  rm -rf "$FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-"[0-9]*.json 2>/dev/null || true
  rm -rf "$FOUNDRY_DIR/broadcast/Bet.s.sol/" 2>/dev/null || true
  rm -rf "$FOUNDRY_DIR/broadcast/ResolveRace.s.sol/" 2>/dev/null || true
  rm -rf "$FOUNDRY_DIR/broadcast/Claim.s.sol/" 2>/dev/null || true
  rm -rf "$FOUNDRY_DIR/cache/" 2>/dev/null || true
  echo -e "${GREEN}✅ Foundry artifacts cleaned${NC}"

  echo -e "${CYAN}Cleaning Ponder artifacts...${NC}"
  rm -rf "$PONDER_DIR/.ponder/" 2>/dev/null || true
  echo -e "${GREEN}✅ Ponder artifacts cleaned${NC}"

  echo -e "${CYAN}Cleaning temporary files...${NC}"
  rm -f /tmp/horsey_*.pid 2>/dev/null || true
  rm -f /tmp/horsey_*.log 2>/dev/null || true
  echo -e "${GREEN}✅ Temporary files cleaned${NC}"

  echo ""
  echo -e "${GREEN}✅ All artifacts cleaned${NC}"
}

cmd_start() {
  print_header
  echo -e "${YELLOW}Starting Horsey DApp...${NC}"
  echo ""

  # Check if Anvil is already running
  if check_port 8545; then
    echo -e "${RED}❌ Anvil already running on port 8545${NC}"
    echo -e "${YELLOW}Run './horsey.sh stop' first${NC}"
    exit 1
  fi

  # Start Anvil
  echo -e "${CYAN}Starting Anvil...${NC}"
  cd "$FOUNDRY_DIR"
  anvil > /tmp/horsey_anvil.log 2>&1 &
  ANVIL_PID=$!
  echo $ANVIL_PID > "$ANVIL_PID_FILE"
  sleep 2

  if ! is_process_running $ANVIL_PID; then
    echo -e "${RED}❌ Failed to start Anvil${NC}"
    cat /tmp/horsey_anvil.log
    exit 1
  fi
  echo -e "${GREEN}✅ Anvil running (PID: $ANVIL_PID)${NC}"

  # Deploy contracts
  echo -e "${CYAN}Deploying contracts...${NC}"
  forge script script/Deploy.s.sol:DeployLocalScript \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast > /tmp/horsey_deploy.log 2>&1

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    cat /tmp/horsey_deploy.log
    cmd_stop
    exit 1
  fi

  CONTRACT_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "Horsey") | .contractAddress' broadcast/Deploy.s.sol/31337/run-latest.json | head -1)
  ENTROPY_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockEntropy") | .contractAddress' broadcast/Deploy.s.sol/31337/run-latest.json | head -1)
  TEST_COIN_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "TestCoin") | .contractAddress' broadcast/Deploy.s.sol/31337/run-latest.json | head -1)

  echo -e "${GREEN}✅ Contracts deployed${NC}"
  echo -e "${GREEN}   Horsey: $CONTRACT_ADDRESS${NC}"
  echo -e "${GREEN}   MockEntropy: $ENTROPY_ADDRESS${NC}"
  echo -e "${GREEN}   TestCoin: $TEST_COIN_ADDRESS${NC}"

  cd "$SCRIPT_DIR"

  # Extract TestCoin address and ABI for frontend
  echo -e "${CYAN}Extracting TestCoin address and ABI...${NC}"
  node "../../scripts/extractTestCoin.js"
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to extract TestCoin info${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ TestCoin info extracted${NC}"

  # Start Ponder
  echo -e "${CYAN}Starting Ponder...${NC}"
  cd "$PONDER_DIR"
  npm run dev > /tmp/horsey_ponder.log 2>&1 &
  PONDER_PID=$!
  echo $PONDER_PID > "$PONDER_PID_FILE"

  # Wait for Ponder to be ready
  for i in {1..30}; do
    if check_port 42069; then
      break
    fi
    sleep 1
  done

  if ! check_port 42069; then
    echo -e "${RED}❌ Ponder failed to start${NC}"
    tail -50 /tmp/horsey_ponder.log
    cmd_stop
    exit 1
  fi
  echo -e "${GREEN}✅ Ponder running (PID: $PONDER_PID)${NC}"

  cd "$SCRIPT_DIR"

  # Start Frontend
  echo -e "${CYAN}Starting Frontend...${NC}"
  cd "$APP_DIR"
  npm run dev > /tmp/horsey_app.log 2>&1 &
  APP_PID=$!
  echo $APP_PID > "$APP_PID_FILE"

  # Wait for Frontend to be ready
  for i in {1..30}; do
    if check_port 5173; then
      break
    fi
    sleep 1
  done

  if ! check_port 5173; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    tail -50 /tmp/horsey_app.log
    cmd_stop
    exit 1
  fi
  echo -e "${GREEN}✅ Frontend running (PID: $APP_PID)${NC}"

  cd "$SCRIPT_DIR"

  # Display summary
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ All services started successfully!${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${GREEN}📡 Services:${NC}"
  echo -e "   Anvil:    http://127.0.0.1:8545"
  echo -e "   Ponder:   http://localhost:42069"
  echo -e "   Frontend: http://localhost:5173"
  echo ""
  echo -e "${GREEN}📝 Logs:${NC}"
  echo -e "   Anvil:    tail -f /tmp/horsey_anvil.log"
  echo -e "   Ponder:   tail -f /tmp/horsey_ponder.log"
  echo -e "   Frontend: tail -f /tmp/horsey_app.log"
  echo ""
  echo -e "${GREEN}🎮 Next steps:${NC}"
  echo -e "   1. Open http://localhost:5173 in your browser"
  echo -e "   2. Run './horsey.sh simulate' to start betting activity"
  echo -e "   3. Run './horsey.sh stop' to stop all services"
  echo ""
}

cmd_simulate() {
  print_header

  # Check if services are running
  if ! check_port 8545; then
    echo -e "${RED}❌ Anvil is not running${NC}"
    echo -e "${YELLOW}Run './horsey.sh start' first${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Starting continuous betting simulator...${NC}"
  echo -e "${CYAN}This will run until you press Ctrl+C${NC}"
  echo ""

  cd "$SCRIPT_DIR"
  ./simulate-betting.sh
}

cmd_status() {
  print_header
  echo -e "${YELLOW}Checking service status...${NC}"
  echo ""

  # Check Anvil
  if check_port 8545; then
    local pid=$(get_pid_from_file "$ANVIL_PID_FILE")
    echo -e "${GREEN}✅ Anvil${NC}    - Running on port 8545 (PID: $pid)"
  else
    echo -e "${RED}❌ Anvil${NC}    - Not running"
  fi

  # Check Ponder
  if check_port 42069; then
    local pid=$(get_pid_from_file "$PONDER_PID_FILE")
    echo -e "${GREEN}✅ Ponder${NC}   - Running on port 42069 (PID: $pid)"
  else
    echo -e "${RED}❌ Ponder${NC}   - Not running"
  fi

  # Check Frontend
  if check_port 5173; then
    local pid=$(get_pid_from_file "$APP_PID_FILE")
    echo -e "${GREEN}✅ Frontend${NC} - Running on port 5173 (PID: $pid)"
  else
    echo -e "${RED}❌ Frontend${NC} - Not running"
  fi

  # Check Simulator
  if pgrep -f "simulate-betting.sh" > /dev/null; then
    echo -e "${GREEN}✅ Simulator${NC} - Running"
  else
    echo -e "${RED}❌ Simulator${NC} - Not running"
  fi

  echo ""

  # Display contract addresses if deployed
  if [ -f "$FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-latest.json" ]; then
    CONTRACT_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "Horsey") | .contractAddress' "$FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-latest.json" | head -1)
    ENTROPY_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockEntropy") | .contractAddress' "$FOUNDRY_DIR/broadcast/Deploy.s.sol/31337/run-latest.json" | head -1)

    echo -e "${GREEN}📄 Contracts:${NC}"
    echo -e "   Horsey:      $CONTRACT_ADDRESS"
    echo -e "   MockEntropy: $ENTROPY_ADDRESS"
    echo ""
  fi
}

cmd_logs() {
  local service=$1

  case $service in
    anvil)
      tail -f /tmp/horsey_anvil.log
      ;;
    ponder)
      tail -f /tmp/horsey_ponder.log
      ;;
    app|frontend)
      tail -f /tmp/horsey_app.log
      ;;
    *)
      echo -e "${RED}Unknown service: $service${NC}"
      echo -e "${YELLOW}Available: anvil, ponder, app${NC}"
      exit 1
      ;;
  esac
}

cmd_restart() {
  cmd_stop
  sleep 2
  cmd_clean
  sleep 1
  cmd_start
}

cmd_help() {
  print_header
  echo -e "${GREEN}Usage:${NC} ./horsey.sh <command>"
  echo ""
  echo -e "${CYAN}Commands:${NC}"
  echo -e "  ${GREEN}start${NC}       Start all services (Anvil + Deploy + Ponder + Frontend)"
  echo -e "  ${GREEN}stop${NC}        Stop all running services"
  echo -e "  ${GREEN}restart${NC}     Stop, clean, and start all services"
  echo -e "  ${GREEN}clean${NC}       Clean all artifacts (broadcast files, cache, db)"
  echo -e "  ${GREEN}status${NC}      Check status of all services"
  echo -e "  ${GREEN}simulate${NC}    Start continuous betting simulator"
  echo -e "  ${GREEN}logs${NC} <svc>  Tail logs for a service (anvil, ponder, app)"
  echo -e "  ${GREEN}help${NC}        Show this help message"
  echo ""
  echo -e "${CYAN}Examples:${NC}"
  echo -e "  ./horsey.sh start              # Start everything"
  echo -e "  ./horsey.sh status             # Check what's running"
  echo -e "  ./horsey.sh simulate           # Run betting simulation"
  echo -e "  ./horsey.sh logs ponder        # Watch Ponder logs"
  echo -e "  ./horsey.sh restart            # Full restart with cleanup"
  echo -e "  ./horsey.sh stop               # Stop all services"
  echo ""
  echo -e "${CYAN}Service URLs:${NC}"
  echo -e "  Frontend:  http://localhost:5173"
  echo -e "  Ponder:    http://localhost:42069"
  echo -e "  Anvil:     http://127.0.0.1:8545"
  echo ""
}

# Main command dispatcher
case "${1:-help}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  clean)
    cmd_clean
    ;;
  restart)
    cmd_restart
    ;;
  status)
    cmd_status
    ;;
  simulate)
    cmd_simulate
    ;;
  logs)
    cmd_logs "$2"
    ;;
  help|--help|-h)
    cmd_help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo ""
    cmd_help
    exit 1
    ;;
esac
