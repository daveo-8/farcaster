import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type TimerItem = { id: string; name: string; time: string; stats?: Record<string, any> };

function infoPath() {
  return path.join(process.cwd(), "public", "info.txt");
}

async function readInfo(): Promise<TimerItem[]> {
  const raw = await fs.readFile(infoPath(), "utf8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function writeInfo(items: TimerItem[]) {
  await fs.writeFile(infoPath(), JSON.stringify(items, null, 2), "utf8");
}

// GET /api/info/<id> -> return one record
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const items = await readInfo();
    const item = items.find((i) => i.id === params.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to read" }, { status: 500 });
  }
}

// DELETE /api/info/<id> -> delete one record by id (optional but handy)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const items = await readInfo();
    const next = items.filter((i) => i.id !== params.id);
    if (next.length === items.length) {
      return NextResponse.json({ removed: false }, { status: 204 });
    }
    await writeInfo(next);
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
