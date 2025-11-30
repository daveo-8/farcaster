import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const configPath = resolve(new URL(import.meta.url).pathname, '../tsconfig.json');
const jsxValue = process.argv[2] || 'react-jsx'; // default to react-jsx

const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.compilerOptions && config.compilerOptions.jsx) {
    config.compilerOptions.jsx = jsxValue;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Set jsx to '${jsxValue}' in tsconfig.json`);
} else {
    console.error('Could not find jsx option in tsconfig.json');
    process.exit(1);
}
