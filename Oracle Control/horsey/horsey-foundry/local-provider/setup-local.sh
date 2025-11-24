#!/bin/bash

set -e

echo "🐎 Horsey Local Entropy Setup"
echo "=============================="

# Check if Anvil is running
if ! nc -z 127.0.0.1 8545 2>/dev/null; then
    echo "❌ Error: Anvil is not running on port 8545"
    echo "Please start Anvil in another terminal with: anvil"
    exit 1
fi

echo "✅ Anvil detected on port 8545"

# Deploy MockEntropy and Horsey using the DeployLocalScript
echo ""
echo "📝 Deploying contracts..."

DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol:DeployLocalScript --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract addresses from the output
MOCK_ENTROPY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "MockEntropy deployed at:" | awk '{print $NF}')
HORSEY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Horsey deployed at:" | awk '{print $NF}')
PROVIDER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Provider registered:" | awk '{print $NF}')

if [ -z "$MOCK_ENTROPY_ADDRESS" ] || [ -z "$HORSEY_ADDRESS" ]; then
    echo "❌ Error: Failed to extract contract addresses"
    exit 1
fi

echo ""
echo "✅ Contracts deployed:"
echo "   MockEntropy: $MOCK_ENTROPY_ADDRESS"
echo "   Horsey:      $HORSEY_ADDRESS"
echo "   Provider:    $PROVIDER_ADDRESS"

# Install provider server dependencies
echo ""
echo "📦 Installing provider server dependencies..."
cd "$(dirname "$0")"
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the provider server, run:"
echo "   cd local-provider"
echo "   node server.js --contract $MOCK_ENTROPY_ADDRESS"
echo ""
echo "💡 Or export the contract address and use npm start:"
echo "   export MOCK_ENTROPY_ADDRESS=$MOCK_ENTROPY_ADDRESS"
echo "   npm start"
