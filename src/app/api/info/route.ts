// app/api/info/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";

// ----------------------------------------------------------------------------
// Config (you can move to .env.local as needed)
// ----------------------------------------------------------------------------
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PONDER_SQL_URL = process.env.PONDER_SQL_URL || "http://localhost:42069/sql";

// Fallback average block time (seconds) if RPC sampling fails
const FALLBACK_BLOCK_TIME_SEC = Number(process.env.FALLBACK_BLOCK_TIME_SEC || 12);

// Sample window for average block time
const AVG_BLOCK_SAMPLE = Number(process.env.AVG_BLOCK_SAMPLE || 50);

// Optional: max races to pull from Ponder before filtering/sorting
const MAX_RACES_FETCH = Number(process.env.MAX_RACES_FETCH || 100);

const client = createPublicClient({ transport: http(RPC_URL) });

// Types that mirror your App + Ponder
type RaceRow = {
  id: string;
  race_index: string;              // numeric string
  start_block: string;             // numeric string
  end_block: string;               // numeric string
  requested_block: string | null;  // numeric string or null
  sequence_number: string | null;
  winner: number | null;           // integer or null
  resolved_timestamp: string | null;         // ISO or timestamp string
  resolved_block_number: string | null;      // numeric string or null
  resolved_transaction_hash: string | null;  // hex or null
};

type BetAggRow = {
  race_index: string;   // numeric string
  horse: number;        // integer (1-indexed in your UI)
  total_wei: string;    // string number (wei)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ponderSql<T = any>(query: string): Promise<{ rows: T[] }> {
  const res = await fetch(PONDER_SQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ponder SQL error (${res.status}): ${text || "Unknown error"}`);
  }
  return res.json();
}

async function getAvgBlockTimeSec(sample = AVG_BLOCK_SAMPLE): Promise<number> {
  try {
    const headNum = await client.getBlockNumber();
    if (headNum <= 0n) return FALLBACK_BLOCK_TIME_SEC;

    const a = await client.getBlock({ blockNumber: headNum });
    const bNum = headNum > BigInt(sample) ? headNum - BigInt(sample) : 0n;
    const b = await client.getBlock({ blockNumber: bNum });

    const dt = Number(a.timestamp - b.timestamp); // seconds
    const dn = Number(headNum - bNum) || 1;
    const avg = Math.max(1, Math.floor(dt / dn));
    return avg;
  } catch {
    return FALLBACK_BLOCK_TIME_SEC;
  }
}

function bigintSum(values: (string | bigint)[]): bigint {
  return values.reduce<bigint>((acc, v) => acc + BigInt(v), 0n);
}

function toEthStrings(arr: bigint[]): string[] {
  return arr.map((x) => formatEther(x));
}

// ---------------------------------------------------------------------------
// Shaping (keeps existing API output contract, adds block fields)
// ---------------------------------------------------------------------------
function shapeRaceFromPonder(opts: {
  race: RaceRow;
  currentBlock: bigint;
  avgBlockTimeSec: number;
  poolByHorse: Map<number, bigint>; // horse -> wei
}) {
  const { race, currentBlock, avgBlockTimeSec, poolByHorse } = opts;

  const raceIndex = Number(race.race_index);
  const startBlock = BigInt(race.start_block);
  const endBlock = BigInt(race.end_block);

  // Winner / settlement
  const settled = race.winner !== null;
  const winnerIndex = race.winner ?? 0;

  const nowSec = Math.floor(Date.now() / 1000);

  let lockTimeSec: number;
  if (settled) {
    const resolvedMs = race.resolved_timestamp ? Date.parse(race.resolved_timestamp) : Date.now();
    lockTimeSec = Math.floor((isNaN(resolvedMs) ? Date.now() : resolvedMs) / 1000);
  } else {
    const remainingBlocks = Number(endBlock > currentBlock ? endBlock - currentBlock : 0n);
    lockTimeSec = nowSec + remainingBlocks * avgBlockTimeSec;
  }

  const elapsedBlocks = Number(currentBlock > startBlock ? currentBlock - startBlock : 0n);
  const startTimeSec = nowSec - elapsedBlocks * avgBlockTimeSec;

  const horsesWithBets = [...poolByHorse.keys()].sort((a, b) => a - b);
  const racers = horsesWithBets.map((h) => `Horse ${h}`);

  const poolArray: [number, bigint][] = horsesWithBets.map((h) => [h, poolByHorse.get(h)!]);
  const poolByRacerWei = poolArray.map(([, v]) => v);
  const totalPoolWei = bigintSum(poolByRacerWei);

  const locked = !settled && lockTimeSec <= nowSec;
  const status: "open" | "locked" | "settled" = settled ? "settled" : locked ? "locked" : "open";

  const blocksRemainingAtResponse = Math.max(
    0,
    Number(endBlock > currentBlock ? endBlock - currentBlock : 0n),
  );

  return {
    // legacy/whitebar compatibility
    id: String(raceIndex),
    name: `Race #${raceIndex}`,
    time: new Date(lockTimeSec * 1000).toISOString(),

    // full data for races/[id]
    raceId: String(raceIndex),
    racers,
    startTime: startTimeSec,
    lockTime: lockTimeSec,
    settled,
    winnerIndex,
    vrfRequested: race.requested_block !== null,

    //  NEW: block-based helpers
    endBlock: Number(endBlock),
    currentBlockAtResponse: Number(currentBlock),
    blocksRemainingAtResponse,
    avgBlockTimeSec,

    // raw (stringified)
    totalPoolWei: totalPoolWei.toString(),
    poolByRacerWei: poolByRacerWei.map((x) => x.toString()),

    // pretty
    totalPoolEth: formatEther(totalPoolWei),
    poolByRacerEth: toEthStrings(poolByRacerWei),

    // UI helpers
    status,
    locked,
    secondsToLock: Math.max(0, lockTimeSec - nowSec),
  };

}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const [{ rows: raceRows }, { rows: betAggRows }] = await Promise.all([
      ponderSql<RaceRow>(`SELECT * FROM race ORDER BY race_index DESC LIMIT ${MAX_RACES_FETCH}`),
      ponderSql<BetAggRow>(`
        SELECT race_index, horse, SUM(CAST(amount AS NUMERIC)) AS total_wei
        FROM bet
        GROUP BY race_index, horse
      `),
    ]);

    const poolMap = new Map<number, Map<number, bigint>>();
    for (const row of betAggRows) {
      const rIdx = Number(row.race_index);
      const horse = Number(row.horse);
      const wei = BigInt(row.total_wei);
      if (!poolMap.has(rIdx)) poolMap.set(rIdx, new Map());
      const m = poolMap.get(rIdx)!;
      m.set(horse, (m.get(horse) || 0n) + wei);
    }

    const [currentBlock, avgBlockTimeSec] = await Promise.all([
      client.getBlockNumber(),
      getAvgBlockTimeSec(),
    ]);

    const nowSec = Math.floor(Date.now() / 1000);
    const shaped = raceRows.map((race) =>
      shapeRaceFromPonder({
        race,
        currentBlock,
        avgBlockTimeSec,
        poolByHorse: poolMap.get(Number(race.race_index)) || new Map(),
      }),
    );

    const filtered = shaped
      .filter((r) => r.lockTime > nowSec || r.settled)
      .sort((a, b) => a.lockTime - b.lockTime);

    return NextResponse.json(filtered, { status: 200 });
  } catch (e: any) {
    console.error("❌ /api/info (ponder) error:", e);
    return NextResponse.json(
      { error: "Failed to read from Ponder", details: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Delete not supported; races are indexed data" },
    { status: 405 },
  );
}
