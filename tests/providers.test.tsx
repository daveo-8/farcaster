
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock next/dynamic to synchronously return the WagmiProvider as a passthrough
vi.mock('next/dynamic', () => ({
  default: () => ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock MiniAppProvider and SafeFarcasterSolanaProvider as passthroughs
vi.mock('@neynar/react', () => ({
  MiniAppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('~/components/providers/SafeFarcasterSolanaProvider', () => ({
  SafeFarcasterSolanaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Providers } from '~/app/providers';

describe('Providers', () => {
  it('should render children correctly through all providers', () => {
    const { getByText } = render(
      <Providers>
        <div>Test Child</div>
      </Providers>
    );
    expect(getByText('Test Child')).toBeTruthy();
  });
});