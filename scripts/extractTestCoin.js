/// Extracts the contractAddress from OracleControl/.../run-latest.json
/// and the ABI from TestCoin.json for wallet-context.tsx to use


import fs from 'fs';
import path from 'path';

// ES module: use import.meta.url to get current directory
const __dirname = path.dirname(new URL(import.meta.url).pathname);


const broadcastPath = path.resolve(__dirname, '../OracleControl/horsey/horsey-foundry/broadcast/Deploy.s.sol/31337/run-latest.json');
const abiPath = path.resolve(__dirname, '../OracleControl/horsey/horsey-foundry/out/TestCoin.sol/TestCoin.json');
const outDir = path.resolve(__dirname, '../src/lib/');


const broadcast = JSON.parse(fs.readFileSync(broadcastPath, 'utf-8'));
const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));


const testCoinTx = broadcast.transactions.find(tx => tx.contractName === 'TestCoin');
const testCoinAddress = testCoinTx.contractAddress;
const testCoinAbi = abiJson.abi;

fs.writeFileSync(path.join(outDir, 'TestCoin.address.ts'), `export const TEST_COIN_ADDRESS = '${testCoinAddress}';\n`);
fs.writeFileSync(path.join(outDir, 'abis/TestCoinAbi.ts'), `export const TestCoinAbi = ${JSON.stringify(testCoinAbi, null, 2)};\n`);