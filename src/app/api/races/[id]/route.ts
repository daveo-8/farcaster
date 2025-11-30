import { NextResponse } from "next/server";

const PONDER_RACES_URL = "http://localhost:42069/races";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const idStr = params.id;
  const idNum = Number(idStr);

  if (Number.isNaN(idNum)) {
    return NextResponse.json(
      { error: "Invalid race id" },
      { status: 400 }
    );
  }

  const res = await fetch(PONDER_RACES_URL, { cache: "no-store" });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch races from Ponder" },
      { status: 500 }
    );
  }

  const data = await res.json();
  const races = Array.isArray(data) ? data : data.races ?? [];

  const race = races.find(
    (r: any) => Number(r.race_index ?? r.id) === idNum
  );

  if (!race) {
    return NextResponse.json(
      { error: `Race ${idNum} not found` },
      { status: 404 }
    );
  }

  const winner = race.winner;

  return NextResponse.json({
    id: idNum,
    settled: winner !== null,
    winnerIndex: winner, 
  });
}

