// app/api/head/live/route.ts
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createPublicClient, webSocket } from "viem";

const RPC_WS_URL = process.env.RPC_WS_URL || "ws://127.0.0.1:8545";

// --- Shared WS client & subscribers ---

type Subscriber = (n: bigint) => void;

let clientPromise: Promise<ReturnType<typeof createPublicClient>> | null = null;
let unsubscribeBlocks: (() => void) | null = null;
const subscribers = new Set<Subscriber>();

async function ensureBlockFeed() {
  if (!clientPromise) {
    clientPromise = Promise.resolve(
      createPublicClient({
        transport: webSocket(RPC_WS_URL),
      }),
    );
  }

  const client = await clientPromise;

  if (!unsubscribeBlocks) {
    unsubscribeBlocks = client.watchBlocks({
      onBlock: (block) => {
        const n = block.number ?? 0n;
        for (const sub of subscribers) {
          try {
            sub(n);
          } catch (err) {
            console.error("block subscriber error", err);
          }
        }
      },
      emitMissed: true,
      includeTransactions: false,
    });
  }
}

export async function GET(_req: NextRequest) {
  await ensureBlockFeed();

  let send: Subscriber | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      // function that broadcasts current block to THIS client
      send = (n: bigint) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ currentBlock: Number(n) })}\n\n`,
            ),
          );
        } catch (err) {
          // controller is likely closed; ignore,
          // cleanup happens in cancel()
          // console.error("SSE enqueue failed", err);
        }
      };

      subscribers.add(send);

      // optional initial "connected" comment
      try {
        controller.enqueue(encoder.encode(`: connected\n\n`));
      } catch {
        // ignore
      }

      // Heartbeat to keep proxies / browsers happy
      pingTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // If enqueue fails, stop trying to ping
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
        }
      }, 15000);
    },

    // Called when the client disconnects or the stream is otherwise cancelled
    cancel() {
      if (send) {
        subscribers.delete(send);
        send = null;
      }
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }

      // Optional: if there are no subscribers left, you could also
      // stop the block subscription:
      // if (subscribers.size === 0 && unsubscribeBlocks) {
      //   unsubscribeBlocks();
      //   unsubscribeBlocks = null;
      // }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // If you call this from a different origin, enable CORS here:
      // "Access-Control-Allow-Origin": "*",
    },
  });
}
