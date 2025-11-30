import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PONDER_SQL_URL =
  process.env.PONDER_SQL_URL || "http://127.0.0.1:42069/sql";

type LeaderRow = {
  bettor: string;
  total_bets: number;
  total_staked: string;
  total_won: string;
};

async function ponderSql<T = any>(query: string): Promise<T[]> {
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

  const json = (await res.json()) as { rows?: T[] } | T[];
  return Array.isArray(json) ? json : json.rows ?? [];
}

export async function GET() {
  const query = `
    SELECT
      LOWER(b.bettor) AS bettor,
      COUNT(*) AS total_bets,
      SUM(CAST(b.amount AS NUMERIC)) AS total_staked,
      SUM(
        CASE WHEN r.winner = b.horse
             THEN CAST(b.amount AS NUMERIC)
             ELSE 0
        END
      ) AS total_won
    FROM bet b
    LEFT JOIN race r ON b.race_index = r.race_index
    GROUP BY LOWER(b.bettor)
    ORDER BY total_won DESC NULLS LAST
    LIMIT 10;
  `;

  try {
    const rows = await ponderSql<LeaderRow>(query);
    return NextResponse.json({ leaderboard: rows }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/leaderboard] error:", e);
    return NextResponse.json(
      { error: "Failed to load leaderboard", details: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
