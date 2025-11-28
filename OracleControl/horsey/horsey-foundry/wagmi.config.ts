import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

export default defineConfig({
  out: '../horsey-ponder/abis/HorseyAbi.ts',
  plugins: [
    foundry({
      project: './',
      // Include only specific contracts we want to generate types for
      include: [
        'Horsey.sol/*.json',
      ],
      // Exclude test contracts, mocks, and forge-std
      exclude: [
        '**.s.sol/*.json',
        '**.t.sol/*.json',
        'Mock*.sol/*.json',
        'Test*.sol/**',
        'Std*.sol/**',
        'Script.sol/**',
        'Vm.sol/**',
        'console*.sol/**',
        'build-info/**',
        'forge-std/**',
      ],
    }),
  ],
})
