// app/api/info/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PONDER_SQL_URL =
  process.env.PONDER_SQL_URL || "http://localhost:42069/sql";

const FALLBACK_BLOCK_TIME_SEC = Number(
  process.env.FALLBACK_BLOCK_TIME_SEC || 12,
);

const AVG_BLOCK_SAMPLE = Number(process.env.AVG_BLOCK_SAMPLE || 50);

const MAX_RACES_FETCH = Number(process.env.MAX_RACES_FETCH || 100);

const DEFAULT_HORSE_COUNT = Number(process.env.DEFAULT_HORSE_COUNT || 7);

const HORSEY_ADDRESS =
  (process.env.HORSEY_ADDRESS as `0x${string}`) ??
  ("0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" as const);

const client = createPublicClient({ transport: http(RPC_URL) });

type RaceRow = {
  id: string;
  race_index: string; // numeric string
  start_block: string; // numeric string
  end_block: string; // numeric string
  requested_block: string | null; // numeric string or null
  sequence_number: string | null;
  winner: number | null; // integer or null
  resolved_timestamp: string | null; // ISO or timestamp string
  resolved_block_number: string | null; // numeric string or null
  resolved_transaction_hash: string | null; // hex or null
};

type BetAggRow = {
  race_index: string; // numeric string
  horse: number; // integer (enum index, 1-based)
  total_wei: string; // string number (wei)
};

type MaxHorseRow = {
  max_horse: number | null;
};

const HORSEY_ABI = [
  {
    type: "function",
    name: "getHorseNames",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string[7]" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ponderSql<T = any>(
  query: string,
): Promise<{ rows: T[] }> {
  const res = await fetch(PONDER_SQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ponder SQL error (${res.status}): ${text || "Unknown error"}`,
    );
  }
  return res.json();
}

async function getAvgBlockTimeSec(
  sample = AVG_BLOCK_SAMPLE,
): Promise<number> {
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

// Read horse names from the Horsey contract
async function getHorseNamesFromChain(): Promise<string[]> {
  try {
    const result = await client.readContract({
      address: HORSEY_ADDRESS,
      abi: HORSEY_ABI,
      functionName: "getHorseNames",
    });

    // result is string[7]
    return Array.from(result as string[]);
  } catch (err) {
    console.error("⚠️ Failed to fetch horse names from chain:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Shaping 
// ---------------------------------------------------------------------------
function shapeRaceFromPonder(opts: {
  race: RaceRow;
  currentBlock: bigint;
  avgBlockTimeSec: number;
  poolByHorse: Map<number, bigint>; // horse -> wei
  horseCount: number;
  horseNames: string[];
}) {
  const {
    race,
    currentBlock,
    avgBlockTimeSec,
    poolByHorse,
    horseCount,
    horseNames,
  } = opts;

  const raceIndex = Number(race.race_index);
  const startBlock = BigInt(race.start_block);
  const endBlock = BigInt(race.end_block);

  // Winner / settlement
  const settled = race.winner !== null;
  const winnerIndex = race.winner ?? 0;

  const nowSec = Math.floor(Date.now() / 1000);

  let lockTimeSec: number;
  if (settled) {
    const resolvedMs = race.resolved_timestamp
      ? Date.parse(race.resolved_timestamp)
      : Date.now();
    lockTimeSec = Math.floor(
      (isNaN(resolvedMs) ? Date.now() : resolvedMs) / 1000,
    );
  } else {
    const remainingBlocks = Number(
      endBlock > currentBlock ? endBlock - currentBlock : 0n,
    );
    lockTimeSec = nowSec + remainingBlocks * avgBlockTimeSec;
  }

  const elapsedBlocks = Number(
    currentBlock > startBlock ? currentBlock - startBlock : 0n,
  );
  const startTimeSec = nowSec - elapsedBlocks * avgBlockTimeSec;

  const horseIds = Array.from({ length: horseCount }, (_, i) => i + 1);

  const racers = horseIds.map((h, idx) => {
    const name = horseNames[idx] ?? horseNames[h - 1];
    return name && name.length ? name : `Horse ${h}`;
  });

  const poolByRacerWei = horseIds.map(
    (h) => poolByHorse.get(h) ?? 0n,
  );
  const totalPoolWei = bigintSum(poolByRacerWei);

  const locked =
    !settled && lockTimeSec <= nowSec;
  const status: "open" | "locked" | "settled" = settled
    ? "settled"
    : locked
    ? "locked"
    : "open";

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
    const [
      { rows: raceRows },
      { rows: betAggRows },
      { rows: maxHorseRows },
      horseNamesFromChain,
    ] = await Promise.all([
      ponderSql<RaceRow>(
        `SELECT * FROM race ORDER BY race_index DESC LIMIT ${MAX_RACES_FETCH}`,
      ),
      ponderSql<BetAggRow>(`
        SELECT race_index, horse, SUM(CAST(amount AS NUMERIC)) AS total_wei
        FROM bet
        GROUP BY race_index, horse
      `),
      ponderSql<MaxHorseRow>(`
        SELECT MAX(horse) AS max_horse
        FROM bet
      `),
      getHorseNamesFromChain(),
    ]);

    const globalHorseCountFromBets =
      maxHorseRows[0]?.max_horse && maxHorseRows[0].max_horse > 0
        ? maxHorseRows[0].max_horse
        : DEFAULT_HORSE_COUNT;

    const horseNames = horseNamesFromChain;
    const horseCount =
      (horseNames && horseNames.length) || globalHorseCountFromBets;

    // Build pool map: race_index -> (horse -> wei)
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
        horseCount,
        horseNames,
      }),
    );

    const filtered = shaped
      .filter((r) => r.lockTime > nowSec || r.settled)
      .sort((a, b) => a.lockTime - b.lockTime);

    return NextResponse.json(filtered, { status: 200 });
  } catch (e: any) {
    console.error("❌ /api/info (ponder) error:", e);
    return NextResponse.json(
      {
        error: "Failed to read from Ponder",
        details: String(e?.message ?? e),
      },
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
