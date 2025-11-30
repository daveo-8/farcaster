import { useQuery } from '@tanstack/react-query'
import { useReadContract } from 'wagmi'
import { horseyAbi } from './generated'

interface Bet {
  id: string
  bettor: string
  share_id: string
  race_index: string
  horse: number
  amount: string
  timestamp: string
  block_number: string
  transaction_hash: string
  claimed: boolean
}

interface Race {
  id: string
  race_index: string
  start_block: string
  end_block: string
  requested_block: string | null
  sequence_number: string | null
  winner: number | null
  resolved_timestamp: string | null
  resolved_block_number: string | null
  resolved_transaction_hash: string | null
}

// Horsey contract address - auto-read from deployment or use env var
const CONTRACT_ADDRESS = (import.meta.env.VITE_HORSEY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as const;

function App() {
  // Read horse names from contract
  const { data: horseNames } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: horseyAbi,
    functionName: 'getHorseNames',
  });

  // Helper to get horse name by ID (1-indexed)
  const getHorseName = (horseId: number) => {
    if (!horseNames || horseId < 1 || horseId > 7) {
      return `Horse ${horseId}`;
    }
    return horseNames[horseId - 1];
  };

  // Query recent bets with polling
  const { data: betsData, isLoading: betsLoading } = useQuery({
    queryKey: ['bets'],
    queryFn: async () => {
      const response = await fetch('http://localhost:42069/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM bet ORDER BY timestamp DESC LIMIT 10' }),
      });
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Query recent races with polling
  const { data: racesData, isLoading: racesLoading } = useQuery({
    queryKey: ['races'],
    queryFn: async () => {
      const response = await fetch('http://localhost:42069/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM race ORDER BY race_index DESC LIMIT 5' }),
      });
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });

  const bets = betsData?.rows;
  const races = racesData?.rows;

  // Helper to get race status
  const getRaceStatus = (race: Race) => {
    if (race.winner !== null) {
      return { status: 'Resolved', color: '#10b981' };
    } else if (race.requested_block !== null) {
      return { status: 'Resolving...', color: '#f59e0b' };
    } else {
      return { status: 'Betting', color: '#3b82f6' };
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0' }}>🐎 Horsey</h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0' }}>Verifiable Random Horse Racing DApp</p>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Live data from Ponder indexer • Contract: {CONTRACT_ADDRESS}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        {/* Races Section */}
        <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <h2 style={{ marginTop: '0', fontSize: '1.5rem' }}>Recent Races</h2>
          {racesLoading ? (
            <p style={{ color: '#6b7280' }}>Loading races...</p>
          ) : races && Array.isArray(races) && races.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {races.map((race: Race) => {
                const { status, color } = getRaceStatus(race);
                return (
                  <div key={race.id} style={{
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.125rem' }}>Race #{race.race_index}</strong>
                      <span style={{
                        background: color,
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      <div>Betting: Block {race.start_block} → {race.end_block}</div>
                      {race.winner !== null && (
                        <div style={{ marginTop: '0.25rem', color: '#059669', fontWeight: '600' }}>
                          🏆 Winner: {getHorseName(race.winner)}
                        </div>
                      )}
                      {race.requested_block && race.winner === null && (
                        <div style={{ marginTop: '0.25rem', color: '#f59e0b' }}>
                          ⏳ Requested at block {race.requested_block}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#9ca3af',
              background: 'white',
              borderRadius: '0.375rem',
              border: '1px dashed #d1d5db'
            }}>
              <p>No races found</p>
              <p style={{ fontSize: '0.875rem' }}>Start Ponder indexer and place some bets!</p>
            </div>
          )}
        </div>

        {/* Bets Section */}
        <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <h2 style={{ marginTop: '0', fontSize: '1.5rem' }}>Recent Bets</h2>
          {betsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading bets...</p>
          ) : bets && Array.isArray(bets) && bets.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {bets.map((bet: Bet) => (
                <div key={bet.id} style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                        {bet.bettor.slice(0, 6)}...{bet.bettor.slice(-4)}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', marginTop: '0.25rem' }}>
                        {(Number(bet.amount) / 1e18).toFixed(4)} ETH
                      </div>
                    </div>
                    {bet.claimed && (
                      <span style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        CLAIMED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    on <strong>{getHorseName(bet.horse)}</strong> • Race #{bet.race_index}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#9ca3af',
              background: 'white',
              borderRadius: '0.375rem',
              border: '1px dashed #d1d5db'
            }}>
              <p>No bets found</p>
              <p style={{ fontSize: '0.875rem' }}>Start Ponder indexer and place some bets!</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
        <h3 style={{ marginTop: '0', fontSize: '1rem', color: '#1e40af' }}>🎲 How It Works</h3>
        <ol style={{ margin: '0.5rem 0 0 1rem', padding: '0', fontSize: '0.875rem', color: '#1e3a8a' }}>
          <li>Betting window opens for 50 blocks</li>
          <li>After window closes, anyone can request entropy for race resolution</li>
          <li>Pyth Entropy provider fulfills the request with verifiable randomness</li>
          <li>Contract uses random number to fairly select the winning horse</li>
          <li>Winners can claim their proportional share of the total pool</li>
        </ol>
      </div>
    </div>
  )
}

export default App
