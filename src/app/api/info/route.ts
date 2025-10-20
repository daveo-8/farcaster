// app/api/info/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type TimerItem = { name: string; time: string };

function infoPath() {
  // store the file under /public so it's also accessible as /info.txt
  return path.join(process.cwd(), "public", "info.txt");
}

async function readInfo(): Promise<TimerItem[]> {
  const p = infoPath();
  const raw = await fs.readFile(p, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data;
}

async function writeInfo(items: TimerItem[]): Promise<void> {
  const p = infoPath();
  // pretty print for readability during dev
  await fs.writeFile(p, JSON.stringify(items, null, 2), "utf8");
}

export async function GET() {
  try {
    const items = await readInfo();
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to read info" }, { status: 500 });
  }
}

/**
 * DELETE /api/info?name=...&time=...
 * Removes a single item that matches both name and time.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const time = searchParams.get("time");

    if (!name || !time) {
      return NextResponse.json({ error: "Missing name or time" }, { status: 400 });
    }

    const items = await readInfo();
    const beforeLen = items.length;
    const next = items.filter((i) => !(i.name === name && i.time === time));

    if (next.length === beforeLen) {
      // nothing removed; return 204 to indicate "no content/changes"
      return NextResponse.json({ removed: false }, { status: 204 });
    }

    await writeInfo(next);
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update info" }, { status: 500 });
  }
}
