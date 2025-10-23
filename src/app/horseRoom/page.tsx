"use client"

import { useRouter } from "next/navigation"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { ChevronLeft, Circle } from "lucide-react"

export default function HorseRoomPage() {
  const router = useRouter()

  // Mock race data
  const race = {
    id: 1,
    name: "Churchill Downs Classic",
    horses: [
      { id: 1, name: "Thunder Strike", odds: 3.5, color: "bg-red-500", totalBets: 2500 },
      { id: 2, name: "Lightning Bolt", odds: 4.2, color: "bg-blue-500", totalBets: 1800 },
      { id: 3, name: "Storm Chaser", odds: 5.8, color: "bg-green-500", totalBets: 1200 },
      { id: 4, name: "Wind Runner", odds: 6.5, color: "bg-yellow-500", totalBets: 950 },
      { id: 5, name: "Fire Dancer", odds: 7.2, color: "bg-purple-500", totalBets: 800 },
    ],
  }

  // Example bet (mocked)
  const bets = [{ raceId: 1, horseId: 2, amount: 100, potentialWin: 420 }]

  // Sort by best odds
  const sortedHorses = [...race.horses].sort((a, b) => a.odds - b.odds)

  return (
    <div className="min-h-screen flex flex-col pb-16 bg-background text-foreground">
      {/* ===== Header ===== */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="w-full px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Horse Room</h1>
        </div>
      </header>

      {/* ===== Content Sections ===== */}
      <main className="flex-1 w-full flex flex-col divide-y divide-border">
        {/* Top Section (2/5) */}
        <section className="flex-[2] flex items-center justify-center p-6">
          <Card className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/30 shadow-sm">
            <h2 className="text-lg font-bold">{race.name}</h2>
          </Card>
        </section>

        {/* Middle Section (2/5) - Live Odds */}
        <section className="flex-[2] overflow-y-auto p-6">
          <Card className="w-full h-full bg-gradient-to-br from-secondary/10 to-primary/20 p-5 shadow-sm overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-center">Current Live Odds</h2>
            <div className="space-y-3">
              {sortedHorses.map((horse, index) => {
                const userBet = bets.find(
                  (b) => b.horseId === horse.id && b.raceId === race.id
                )

                return (
                  <div
                    key={horse.id}
                    className={`p-3 rounded-lg transition-all ${
                      userBet
                        ? "ring-2 ring-primary/70 bg-primary/5"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    {/* Top Row: horse info and total bets */}
                    <div className="flex items-center justify-between">
                      {/* Left: number, name, odds */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-md ${horse.color} flex items-center justify-center text-white font-bold`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {userBet && (
                            <Circle className="h-3 w-3 text-green-500 fill-green-500" />
                          )}
                          <h3 className="font-semibold text-base">{horse.name}</h3>
                          <p className="text-sm text-muted-foreground">{horse.odds}x</p>
                        </div>
                      </div>

                      {/* Right: total bets */}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-semibold">
                          {horse.totalBets.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* User bet info (below) */}
                    {userBet && (
                      <div className="mt-2 pl-12 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Your Bet:</span>
                          <span className="font-semibold text-foreground">
                            {userBet.amount} coins
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Potential Win:</span>
                          <span className="font-semibold text-primary">
                            {userBet.potentialWin} coins
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </section>

        {/* Bottom Section (1/5) - Chat Button */}
        <section className="flex-[1] flex items-center justify-center p-6">
          <Button
            className="w-full text-base py-3 rounded-lg shadow-md"
            onClick={() => console.log("Chat opened")}
          >
            Open Chat
          </Button>
        </section>
      </main>
    </div>
  )
}