#!/usr/bin/env node

const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { foundry } = require('viem/chains');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const MOCK_ENTROPY_ADDRESS = getArg('--contract', process.env.MOCK_ENTROPY_ADDRESS);
const PROVIDER_PRIVATE_KEY = getArg('--provider-key', process.env.PROVIDER_PRIVATE_KEY ||
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'); // Anvil account #2
const RPC_URL = getArg('--rpc-url', process.env.RPC_URL || 'http://127.0.0.1:8545');
const POLL_INTERVAL = parseInt(getArg('--poll-interval', '2000'));
const AUTO_FULFILL = getArg('--auto-fulfill', 'true') === 'true';

if (!MOCK_ENTROPY_ADDRESS) {
  console.error('Error: MockEntropy contract address required');
  console.error('Usage: node server.js --contract <ADDRESS> [options]');
  console.error('Options:');
  console.error('  --provider-key <KEY>     Provider private key (default: Anvil account #2)');
  console.error('  --rpc-url <URL>          RPC URL (default: http://127.0.0.1:8545)');
  console.error('  --poll-interval <MS>     Polling interval in ms (default: 2000)');
  console.error('  --auto-fulfill <BOOL>    Auto-fulfill requests (default: true)');
  process.exit(1);
}

// Setup account and clients
const account = privateKeyToAccount(PROVIDER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: foundry,
  transport: http(RPC_URL),
});

// ABI for MockEntropy
const mockEntropyAbi = parseAbi([
  'event RequestedV2(uint64 indexed sequenceNumber, address indexed provider, address indexed requester, bytes32 userRandomNumber, uint32 callbackGasLimit)',
  'event RevealedV2(uint64 indexed sequenceNumber, address indexed provider, bytes32 randomNumber)',
  'function fulfill(address provider, uint64 sequenceNumber, bytes32 providerRandomNumber) external',
  'function sequenceNumber() external view returns (uint64)',
]);

console.log('🎲 Pyth Entropy Provider Server');
console.log('================================');
console.log(`MockEntropy: ${MOCK_ENTROPY_ADDRESS}`);
console.log(`Provider:    ${account.address}`);
console.log(`RPC URL:     ${RPC_URL}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
console.log(`Auto-fulfill:  ${AUTO_FULFILL}`);
console.log('================================\n');

let lastProcessedBlock = 0n;
const processedSequences = new Set();

async function pollForRequests() {
  try {
    // Get current block number
    const currentBlock = await publicClient.getBlockNumber();

    if (lastProcessedBlock === 0n) {
      // Look back 100 blocks on first run, but not below block 0
      lastProcessedBlock = currentBlock > 100n ? currentBlock - 100n : 0n;
    }

    // Query for RequestedV2 events
    const logs = await publicClient.getLogs({
      address: MOCK_ENTROPY_ADDRESS,
      event: {
        type: 'event',
        name: 'RequestedV2',
        inputs: [
          { indexed: true, name: 'sequenceNumber', type: 'uint64' },
          { indexed: true, name: 'provider', type: 'address' },
          { indexed: true, name: 'requester', type: 'address' },
          { indexed: false, name: 'userRandomNumber', type: 'bytes32' },
          { indexed: false, name: 'callbackGasLimit', type: 'uint32' },
        ],
      },
      fromBlock: lastProcessedBlock + 1n,
      toBlock: currentBlock,
    });

    // Filter for requests to this provider
    const providerRequests = logs.filter(
      log => log.args.provider.toLowerCase() === account.address.toLowerCase()
    );

    for (const log of providerRequests) {
      const { sequenceNumber, requester, userRandomNumber, callbackGasLimit } = log.args;

      // Skip if already processed
      if (processedSequences.has(Number(sequenceNumber))) {
        continue;
      }

      console.log(`📬 New request #${sequenceNumber} from ${requester}`);
      console.log(`   User Random: ${userRandomNumber}`);
      console.log(`   Gas Limit:   ${callbackGasLimit}`);

      if (AUTO_FULFILL) {
        await fulfillRequest(sequenceNumber, userRandomNumber);
      }

      processedSequences.add(Number(sequenceNumber));
    }

    lastProcessedBlock = currentBlock;
  } catch (error) {
    console.error('Error polling for requests:', error.message);
  }
}

async function fulfillRequest(sequenceNumber, userRandomNumber) {
  try {
    // Generate cryptographically secure random number
    const providerRandom = `0x${crypto.randomBytes(32).toString('hex')}`;

    console.log(`🎲 Fulfilling request #${sequenceNumber}...`);
    console.log(`   Provider Random: ${providerRandom}`);

    // Call fulfill on MockEntropy
    const hash = await walletClient.writeContract({
      address: MOCK_ENTROPY_ADDRESS,
      abi: mockEntropyAbi,
      functionName: 'fulfill',
      args: [account.address, sequenceNumber, providerRandom],
    });

    console.log(`   TX Hash: ${hash}`);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`✅ Request #${sequenceNumber} fulfilled successfully`);

      // Find the RevealedV2 event in the receipt
      const revealedEvent = receipt.logs.find(log => {
        try {
          const decoded = publicClient.decodeEventLog({
            abi: mockEntropyAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'RevealedV2';
        } catch {
          return false;
        }
      });

      if (revealedEvent) {
        const decoded = publicClient.decodeEventLog({
          abi: mockEntropyAbi,
          data: revealedEvent.data,
          topics: revealedEvent.topics,
        });
        console.log(`   Final Random: ${decoded.args.randomNumber}\n`);
      }
    } else {
      console.error(`❌ Request #${sequenceNumber} failed\n`);
    }
  } catch (error) {
    console.error(`Error fulfilling request #${sequenceNumber}:`, error.message, '\n');
  }
}

// Start polling
console.log('🔄 Starting to poll for randomness requests...\n');
setInterval(pollForRequests, POLL_INTERVAL);

// Initial poll
pollForRequests();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down provider server...');
  process.exit(0);
});
