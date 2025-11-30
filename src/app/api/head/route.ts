// app/api/head/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

const RPC_HTTP_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

const client = createPublicClient({ transport: http(RPC_HTTP_URL) });

export async function GET() {
  const n = await client.getBlockNumber();
  return NextResponse.json({ currentBlock: Number(n) });
}
