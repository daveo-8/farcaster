import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// SQL over HTTP endpoint for @ponder/react
app.post("/sql", async (c) => {
  const body = await c.req.json();
  const { query } = body;

  if (!query) {
    return c.json({ error: "Missing query parameter" }, 400);
  }

  try {
    const result = await db.execute(query);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Helper function to handle SSE streaming (manual implementation)
const handleSSE = async (c: any, query: string) => {
  try {
    // Set SSE headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (data: any, event: string = "message") => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Send initial data
        try {
          const result = await db.execute(query);
          sendEvent(result, "data");
        } catch (error: any) {
          sendEvent({ error: error.message }, "error");
          controller.close();
          return;
        }

        // Poll for updates every 2 seconds
        const interval = setInterval(async () => {
          try {
            const result = await db.execute(query);
            sendEvent(result, "data");
          } catch (error: any) {
            sendEvent({ error: error.message }, "error");
          }
        }, 2000);

        // Cleanup on connection close
        const cleanup = () => {
          clearInterval(interval);
          controller.close();
        };

        // Note: In a real implementation, you'd want to detect client disconnection
        // For now, we'll just keep the stream open
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error in handleSSE:", error);
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
};

// SSE endpoint for live updates - GET version
app.get("/sql/live", async (c) => {
  // Get all query params
  const url = new URL(c.req.url);
  const allParams = Object.fromEntries(url.searchParams.entries());

  console.log("SSE GET request:", {
    allParams,
    url: c.req.url,
    raw: c.req.raw
  });

  // Try different ways to get the query
  let query = c.req.query("query") ||
              url.searchParams.get("query") ||
              url.searchParams.get("q");

  if (!query) {
    console.error("No query found. Params:", allParams);
    return c.text(`Missing query parameter. Received params: ${JSON.stringify(allParams)}`, 400);
  }

  console.log("Executing query:", query);
  return handleSSE(c, query);
});

// SSE endpoint for live updates - POST version (for @ponder/react)
app.post("/sql/live", async (c) => {
  const body = await c.req.json();
  const { query } = body;

  console.log("SSE POST request:", { query });

  if (!query) {
    return c.json({ error: "Missing query parameter" }, 400);
  }

  return handleSSE(c, query);
});

// Get unclaimed shares for an address
app.get("/unclaimed/:address", async (c) => {
  const address = c.req.param("address");

  if (!address) {
    return c.json({ error: "Missing address parameter" }, 400);
  }

  try {
    // Query all bets for this address that are in resolved races
    const query = `
      SELECT
        b.id,
        b.bettor,
        b.share_id,
        b.race_index,
        b.horse,
        b.amount,
        b.timestamp,
        b.block_number,
        b.transaction_hash,
        b.claimed,
        r.winner,
        r.resolved_timestamp
      FROM bet b
      INNER JOIN race r ON b.race_index = r.race_index
      WHERE
        LOWER(b.bettor) = LOWER('${address}')
        AND r.winner IS NOT NULL
        AND b.horse = r.winner
        AND b.claimed = false
      ORDER BY b.race_index DESC, b.share_id ASC
    `;

    const result = await db.execute(query);

    return c.json({
      address,
      unclaimedShares: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all shares (claimed and unclaimed) for an address
app.get("/shares/:address", async (c) => {
  const address = c.req.param("address");

  if (!address) {
    return c.json({ error: "Missing address parameter" }, 400);
  }

  try {
    const query = `
      SELECT
        b.id,
        b.bettor,
        b.share_id,
        b.race_index,
        b.horse,
        b.amount,
        b.timestamp,
        b.block_number,
        b.transaction_hash,
        b.claimed,
        r.winner,
        r.resolved_timestamp,
        CASE
          WHEN r.winner IS NULL THEN 'pending'
          WHEN b.horse = r.winner AND b.claimed = false THEN 'unclaimed_win'
          WHEN b.horse = r.winner AND b.claimed = true THEN 'claimed'
          ELSE 'lost'
        END as status
      FROM bet b
      LEFT JOIN race r ON b.race_index = r.race_index
      WHERE LOWER(b.bettor) = LOWER('${address}')
      ORDER BY b.race_index DESC, b.share_id ASC
    `;

    const result = await db.execute(query);

    const stats = result.rows.reduce((acc: any, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    return c.json({
      address,
      shares: result.rows,
      count: result.rows.length,
      stats,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get race statistics
app.get("/races", async (c) => {
  try {
    const query = `
      SELECT
        r.*,
        COUNT(b.id) as bet_count,
        SUM(b.amount) as total_pool,
        SUM(CASE WHEN b.horse = r.winner THEN b.amount ELSE 0 END) as winner_pool
      FROM race r
      LEFT JOIN bet b ON r.race_index = b.race_index
      GROUP BY r.id, r.race_index, r.start_block, r.end_block, r.requested_block,
               r.sequence_number, r.winner, r.resolved_timestamp, r.resolved_block_number,
               r.resolved_transaction_hash
      ORDER BY r.race_index DESC
    `;

    const result = await db.execute(query);

    return c.json({
      races: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// helper to validate a lowercase hex address
const normalizeAddress = (address: string) => {
    if (!address) return null;
    const lower = address.toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(lower) ? lower : null;
};

// for recent betting activity
app.get("/activity/recent", async (c) => {
    const limitParam = Number(c.req.query("limit") ?? "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1)) : 50;

    try {
        const query = `
            SELECT
                b.id,
                b.bettor,
                b.share_id,
                b.race_index,
                b.horse,
                b.amount,
                b.timestamp,
                b.block_number,
                b.transaction_hash,
                r.winner,
                CASE
                    WHEN r.winner IS NULL THEN 'pending'
                    WHEN b.horse = r.winner THEN 'won'
                    ELSE 'lost'
                END as outcome
            FROM bet b
            LEFT JOIN race r ON b.race_index = r.race_index
            ORDER BY b.block_number DESC
            LIMIT ${limit}
        `;

        const result = await db.execute(query);
        return c.json({
            count: result.rows.length,
            limit,
            bets: result.rows,
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// leaderboard stuff
app.get("leaderboard", async (c) => {
    const limitParam = Number(c.req.query("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

    const addressFilter = normalizeAddress(c.req.query("address") ?? "");

    try {
        const whereClause = addressFilter ? `WHERE LOWER(bettor) = '${addressFilter}'` : "";

        const query = `
            SELECT
                LOWER(b.bettor) as bettor,
                COUNT(*)::INTEGER as total_bets,
                SUM(b.amount)::NUMERIC as total_staked,
                SUM(CASE WHEN r.winner IS NOT NULL THEN 1 ELSE 0 END)::INTEGER as settled_bets,
                SUM(CASE WHEN r.winner = b.horse THEN 1 ELSE 0 END)::INTEGER as wins,
                SUM(CASE WHEN r.winner = b.horse THEN b.amount ELSE 0 END) as winning_stake
            FROM bet b
            LEFT JOIN race r ON b.race_index = r.race_index
            ${whereClause}
            GROUP BY LOWER(b.bettor)
            ORDER BY total_staked DESC
            LIMIT ${limit}
        `;

        const result = await db.execute(query);
        const leaderboard = result.rows.map((row: any) => {
            const settled = Number(row.settled_bets || 0);
            const wins = Number(row.wins || 0);
            const winRate = settled > 0 ? Number((wins / settled) * 100).toFixed(2) : 0;

            return {
                ...row,
                win_rate: winRate,
            };
        });

        return c.json({
            count: leaderboard.length,
            limit,
            addressFilter,
            leaderboard,
        });
    } catch (error: any) {
        return c.json({error: error.message}, 500);
    }
});

// GraphQL endpoints
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
