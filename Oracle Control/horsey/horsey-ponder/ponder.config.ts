import { createConfig } from "ponder";
import { getAddress, hexToNumber } from "viem";

import { horseyAbi } from "./abis/HorseyAbi";

// Import broadcast file for automatic address management
// This file will be created when you deploy to Anvil
// Run: cd horsey-foundry && npm run deploy:local
let HorseyDeploy: any;
try {
  // @ts-ignore - Dynamic import of JSON file
  HorseyDeploy = require("../horsey-foundry/broadcast/Deploy.s.sol/31337/run-latest.json");
} catch (e) {
  console.warn("⚠️  Broadcast file not found. Deploy the Horsey contract first:");
  console.warn("   1. Start Anvil: cd horsey-foundry && npm run anvil");
  console.warn("   2. Deploy contract: cd horsey-foundry && npm run deploy:local");
  HorseyDeploy = { transactions: [{ contractAddress: "0x0000000000000000000000000000000000000000" }], receipts: [{ blockNumber: "0x0" }] };
}

// Find Horsey contract (not MockEntropy)
const horseyTx = HorseyDeploy.transactions.find((tx: any) => tx.contractName === "Horsey");
const horseyReceipt = HorseyDeploy.receipts.find((r: any, i: number) => HorseyDeploy.transactions[i]?.contractName === "Horsey");

const address = getAddress(horseyTx?.contractAddress || HorseyDeploy.transactions[0]!.contractAddress);
const startBlock = hexToNumber(horseyReceipt?.blockNumber || HorseyDeploy.receipts[0]!.blockNumber);

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: "http://127.0.0.1:8545",
      disableCache: true,
    },
  },
  contracts: {
    Horsey: {
      chain: "anvil",
      abi: horseyAbi,
      address,
      startBlock,
    },
  },
});
