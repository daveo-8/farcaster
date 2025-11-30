"use client";

import HorseRaceAnimation from "../../components/HorseRaceAnimation";

export default function AnimationTestPage() {
  const winnerIndex = 3;
  const numHorses = 7;

  return (
    <main className="min-h-screen bg-black">
      <HorseRaceAnimation
        winnerIndex={winnerIndex}
        numHorses={numHorses}
      />
    </main>
  );
}

