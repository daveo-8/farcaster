import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'src/generated.ts',
  plugins: [
    foundry({
      project: '../horsey-foundry',
      // Include only the main contracts we want to generate types for
      include: [
        'Horsey.sol/*.json',
        'ERC20.sol/*.json',
      ],
      // Exclude test contracts, scripts, and forge-std
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
        'Common.sol/**',
        'Components.sol/**',
      ],
    }),
  ],
})
