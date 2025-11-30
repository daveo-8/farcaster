import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PonderProvider } from '@ponder/react'
import { Buffer } from 'buffer'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'

import App from './App.tsx'
import { config } from './wagmi.ts'
import { ponderClient } from './lib/ponder.ts'

import './index.css'

globalThis.Buffer = Buffer

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <PonderProvider client={ponderClient}>
          <App />
        </PonderProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
