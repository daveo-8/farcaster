"use client"

// Core imports
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

// UI components
import { Card } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

// Icons
import { Clock, Trophy, Coins, ChevronLeft } from "lucide-react"

// Custom wallet context (handles balance and bet logic)
import { useWallet } from "~/lib/wallet-context"

// Toast notifications
import { toast } from "sonner"

// ----- Static Race Data -----
const raceData = {
  "1": {
    id: 1,
    name: "Churchill Downs Classic",
    location: "Louisville, KY",
    time: "15m",
    distance: "1.5 miles",
    track: "Dirt",
    prize: "50,000",
    horses: [
      { id: 1, name: "Thunder Strike", jockey: "M. Smith", odds: 3.5, color: "bg-red-500" },
      { id: 2, name: "Lightning Bolt", jockey: "J. Johnson", odds: 4.2, color: "bg-blue-500" },
      { id: 3, name: "Storm Chaser", jockey: "R. Williams", odds: 5.8, color: "bg-green-500" },
      { id: 4, name: "Wind Runner", jockey: "K. Brown", odds: 6.5, color: "bg-yellow-500" },
      { id: 5, name: "Fire Dancer", jockey: "L. Davis", odds: 7.2, color: "bg-purple-500" },
      { id: 6, name: "Ocean Wave", jockey: "T. Miller", odds: 8.0, color: "bg-cyan-500" },
      { id: 7, name: "Mountain King", jockey: "S. Wilson", odds: 9.5, color: "bg-orange-500" },
      { id: 8, name: "Desert Fox", jockey: "A. Moore", odds: 12.0, color: "bg-pink-500" },
    ],
  },
}

export default function RaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { balance, addBet } = useWallet()

  // Multiple horse selection and bet amounts
  const [selectedHorses, setSelectedHorses] = useState<number[]>([])
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({})

  const race = raceData[params.id as keyof typeof raceData]
  if (!race) return <div>Race not found</div>

  // --- Handlers ---

  // Select/deselect horses
  const handleHorseSelect = (horseId: number) => {
    setSelectedHorses((prev) =>
      prev.includes(horseId)
        ? prev.filter((id) => id !== horseId)
        : [...prev, horseId]
    )
  }

  // Handle individual bet input
  const handleBetAmountChange = (horseId: number, value: string) => {
    setBetAmounts((prev) => ({ ...prev, [horseId]: value }))
  }

  // Place all valid bets
  const handlePlaceBet = () => {
    if (selectedHorses.length === 0) {
      toast("No Horses Selected", {
        description: "Please select at least one horse.",
      })
      return
    }

    let totalSpent = 0
    const validBets = []

    for (const horseId of selectedHorses) {
      const amount = Number.parseFloat(betAmounts[horseId])
      const horse = race.horses.find((h) => h.id === horseId)
      if (!horse || isNaN(amount) || amount <= 0) continue

      totalSpent += amount
      const potentialWin = (amount * horse.odds).toFixed(0)
      validBets.push({
        raceId: race.id,
        raceName: race.name,
        horseId: horse.id,
        horseName: horse.name,
        amount,
        odds: horse.odds,
        potentialWin: Number(potentialWin),
      })
    }

    if (validBets.length === 0) {
      toast("Invalid Bet", {
        description: "Please enter at least one valid bet amount.",
      })
      return
    }

    if (totalSpent > balance) {
      toast("Insufficient Balance", {
        description: "You don't have enough coins to cover all bets.",
      })
      return
    }

    validBets.forEach((bet) => addBet(bet))
    localStorage.setItem("userBets", JSON.stringify(validBets))

    toast("Bets Placed!", {
      description: `You placed ${validBets.length} bet(s) totaling ${totalSpent} coins.`,
    })

    setSelectedHorses([])
    setBetAmounts({})
  }

  // --- Page Layout ---
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{race.name}</h1>
            <p className="text-sm text-muted-foreground">Place your bet</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-8 py-6 space-y-6">
        {/* Race info card */}
        <Card className="p-4 flex flex-col justify-between min-h-[130px]">
          <div className="space-y-2 text-center">
            <Badge className="bg-primary/20 text-primary border-primary/30">Starting Soon</Badge>
            <div className="flex justify-center items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Starts in {race.time}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 border-t pt-3">
            <span>{race.distance}</span>
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <Trophy className="h-4 w-4 text-primary" />
              {race.prize} coins
            </span>
          </div>
        </Card>

        {/* Horse selection */}
        <section>
          <h2 className="text-xl font-bold mb-4">Select Horse(s)</h2>
          <div className="space-y-3">
            {race.horses.map((horse) => (
              <Card
                key={horse.id}
                onClick={() => handleHorseSelect(horse.id)}
                className={`p-4 cursor-pointer transition-all ${
                  selectedHorses.includes(horse.id)
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${horse.color} flex items-center justify-center text-white font-bold text-lg`}
                  >
                    {horse.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{horse.name}</h3>
                    <p className="text-sm text-muted-foreground">Jockey: {horse.jockey}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{horse.odds}x</div>
                    <div className="text-xs text-muted-foreground">odds</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Betting card */}
        {selectedHorses.length > 0 && (
          <Card className="p-6 space-y-6 bg-gradient-to-br from-primary/10 to-secondary/50">
            <h3 className="text-lg font-bold">Place Your Bets</h3>

            {selectedHorses.map((horseId) => {
              const horse = race.horses.find((h) => h.id === horseId)
              const amount = betAmounts[horseId] || ""
              const potentialWin = amount
                ? (Number.parseFloat(amount) * (horse?.odds || 0)).toFixed(0)
                : "0"

              return (
                <div key={horseId} className="space-y-3 border-b pb-4 last:border-none">
                  <p className="font-semibold">
                    Betting On: <span className="text-foreground">{horse?.name}</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor={`bet-${horseId}`}>Bet Amount</Label>
                    <div className="relative">
                      <Input
                        id={`bet-${horseId}`}
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => handleBetAmountChange(horseId, e.target.value)}
                        className="pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        coins
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {[50, 100, 250, 500].map((v) => (
                        <Button
                          key={v}
                          variant="outline"
                          size="sm"
                          onClick={() => handleBetAmountChange(horseId, String(v))}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>

                    {amount && (
                      <div className="p-3 rounded-lg bg-card border border-border flex justify-between">
                        <span className="text-sm text-muted-foreground">Potential Win:</span>
                        <span className="text-xl font-bold text-primary">{potentialWin} coins</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="pt-2 mt-4 pb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available balance:</span>
                <span className="font-semibold flex items-center gap-1">
                  <Coins className="h-4 w-4 text-primary" />
                  {balance.toLocaleString()}
                </span>
              </div>
            </div>

            <Link href="/horseRoom">
              <Button className="w-full" size="lg" onClick={handlePlaceBet}>
                Place Bet
              </Button>
            </Link>
          </Card>
        )}
      </main>
    </div>
  )
}
