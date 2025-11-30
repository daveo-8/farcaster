// send1000Coins.js (CommonJS version)
const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  const recipient = process.argv[2];

  if (!recipient) {
    console.error("Usage: node send1000Coins.js <recipientAddress>");
    process.exit(1);
  }

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY is not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const amount = ethers.parseEther("1000");

  console.log(`Sender:    ${wallet.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount:    1000 ETH`);
  console.log("Sending...");

  const tx = await wallet.sendTransaction({
    to: recipient,
    value: amount,
  });

  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("✅ Done! 1000 coins sent.");
}

main().catch(console.error);
