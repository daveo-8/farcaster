"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Clock, Trophy, Coins, ChevronLeft } from "lucide-react";
import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";

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
};

export default function RaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { balance, addBet } = useWallet();
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");

  const race = raceData[params.id as keyof typeof raceData];
  if (!race) return <div>Race not found</div>;

  const selectedHorseData = race.horses.find((h) => h.id === selectedHorse);
  const potentialWin =
    selectedHorseData && betAmount
      ? (Number.parseFloat(betAmount) * selectedHorseData.odds).toFixed(0)
      : "0";

  const handlePlaceBet = () => {
    if (!selectedHorse || !betAmount) {
      toast("Invalid Bet", {
        description: "Please select a horse and enter a bet amount.",
      });
      return;
    }

    const amount = Number.parseFloat(betAmount);
    if (amount <= 0 || amount > balance) {
      toast("Invalid Amount", {
        description: "Please enter a valid bet amount within your balance.",
      });
      return;
    }

    if (selectedHorseData) {
      addBet({
        raceId: race.id,
        raceName: race.name,
        horseId: selectedHorse,
        horseName: selectedHorseData.name,
        amount,
        odds: selectedHorseData.odds,
        potentialWin: Number.parseFloat(potentialWin),
      });

      toast("Bet Placed!", {
        description: `You bet ${amount} coins on ${selectedHorseData.name}. Potential win: ${potentialWin} coins.`,
      });

      setSelectedHorse(null);
      setBetAmount("");
    }
  };

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

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-8 py-6 space-y-6">
        {/* Simplified race info card */}
        <Card className="p-4 flex flex-col justify-between min-h-[130px]">
          {/* Top Section */}
          <div className="space-y-2 text-center">
            <Badge className="bg-primary/20 text-primary border-primary/30">
              Starting Soon
            </Badge>
            <div className="flex justify-center items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Starts in {race.time}</span>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 border-t pt-3">
            <span>{race.distance}</span>
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <Trophy className="h-4 w-4 text-primary" />
              {race.prize} coins
            </span>
          </div>
        </Card>

        {/* Horse selection + betting section remains the same */}
        <section>
          <h2 className="text-xl font-bold mb-4">Select a Horse</h2>
          <div className="space-y-3">
            {race.horses.map((horse) => (
              <Card
                key={horse.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedHorse === horse.id
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-secondary/50"
                }`}
                onClick={() => setSelectedHorse(horse.id)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${horse.color} flex items-center justify-center text-white font-bold text-lg`}
                  >
                    {horse.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{horse.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Jockey: {horse.jockey}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {horse.odds}x
                    </div>
                    <div className="text-xs text-muted-foreground">odds</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Betting Section */}
        {selectedHorse && (
          <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/10 to-secondary/50">
            <div>
              <h3 className="text-lg font-bold mb-2">Place Your Bet</h3>
              <p className="text-sm text-muted-foreground">
                Betting on:{" "}
                <span className="font-semibold text-foreground">
                  {selectedHorseData?.name}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bet-amount">Bet Amount</Label>
              <div className="relative">
                <Input
                  id="bet-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  coins
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available balance:</span>
                <span className="font-semibold flex items-center gap-1">
                  <Coins className="h-4 w-4 text-primary" />
                  {balance.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {[50, 100, 250, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount.toString())}
                >
                  {amount}
                </Button>
              ))}
            </div>

            {betAmount && (
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Potential Win:
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {potentialWin} coins
                  </span>
                </div>
              </div>
            )}

            <Link href="/horseRoom">
              <Button className="w-full" size="lg" onClick={handlePlaceBet}>
                Place Bet
              </Button>
            </Link>
          </Card>
        )}
      </main>
    </div>
  );
}
