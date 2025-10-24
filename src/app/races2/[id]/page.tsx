"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Clock, Trophy, Coins, ChevronLeft } from "lucide-react";
import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";
import Link from "next/link";

type JsonHorse = {
  id: string;
  name: string;
  jockey: string;
  odds: string;
  color: string;
};

type JsonRace = {
  id: string;
  name: string;
  time: string;
  choices: string[];
  stats: Record<string, any>;
  location: string;
  distance: string;
  track: string;
  prize: string;
  horses: JsonHorse[];
};

// ---- Helpers ----
const formatStartsIn = (target: Date) => {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

export default function RaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { balance, addBet } = useWallet();

  const [race, setRace] = useState<{
    id: number;
    name: string;
    location: string;
    raceDate: Date;
    distance: string;
    track: string;
    prize: string;
    horses: { id: number; name: string; jockey: string; odds: number; color: string }[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedHorses, setSelectedHorses] = useState<number[]>([]);
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});

  // ---- Fetch Race Data ----
  useEffect(() => {
    let alive = true;
    const fetchRace = async () => {
      try {
        setLoading(true);
        const res = await fetch("/info.txt", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch info.txt (${res.status})`);
        const data = (await res.json()) as JsonRace[];
        const found = data.find((r) => r.id === params.id);
        if (!found) throw new Error(`Race ${params.id} not found`);

        const mapped = {
          id: Number(found.id),
          name: found.name,
          location: found.location,
          raceDate: new Date(found.time),
          distance: found.distance,
          track: found.track,
          prize: found.prize,
          horses: found.horses.map((h) => ({
            id: Number(h.id),
            name: h.name,
            jockey: h.jockey,
            odds: Number(h.odds),
            color: h.color,
          })),
        };

        if (alive) setRace(mapped);
      } catch (e: any) {
        if (alive) setErr(e.message || "Failed to load race data");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchRace();
    return () => {
      alive = false;
    };
  }, [params.id]);

  // ---- Handlers ----
  const handleHorseSelect = (horseId: number) => {
    setSelectedHorses((prev) =>
      prev.includes(horseId)
        ? prev.filter((id) => id !== horseId)
        : [...prev, horseId]
    );
  };

  const handleBetAmountChange = (horseId: number, value: string) => {
    setBetAmounts((prev) => ({ ...prev, [horseId]: value }));
  };

  const handlePlaceBet = () => {
    if (!race) return;
    if (!selectedHorses.length)
      return toast("No Horses Selected", {
        description: "Select at least one horse.",
      });

    let totalSpent = 0;
    const bets = selectedHorses
      .map((id) => {
        const horse = race.horses.find((h) => h.id === id);
        const amount = parseFloat(betAmounts[id]);
        if (!horse || isNaN(amount) || amount <= 0) return null;
        totalSpent += amount;
        return { horse, amount };
      })
      .filter(Boolean) as { horse: typeof race.horses[0]; amount: number }[];

    if (!totalSpent)
      return toast("Invalid Bet", {
        description: "Enter valid bet amounts.",
      });
    if (totalSpent > balance)
      return toast("Insufficient Balance", {
        description: "Not enough coins.",
      });

    const finalBets = bets.map(({ horse, amount }) => ({
      raceId: race.id,
      raceName: race.name,
      horseId: horse.id,
      horseName: horse.name,
      amount,
      odds: horse.odds,
      potentialWin: Math.round(amount * horse.odds),
    }));

    // ---- Save bets ----
    const existingBets = JSON.parse(localStorage.getItem("userBets") || "[]");
    const allBets = [...existingBets, ...finalBets];
    localStorage.setItem("userBets", JSON.stringify(allBets));
    finalBets.forEach(addBet);

    toast("Bets Placed!", { description: `Placed ${finalBets.length} bet(s)` });

    setSelectedHorses([]);
    setBetAmounts({});
    router.push(`/horseRoom/${race.id}`);
  };

  if (loading) return <div className="p-6 text-center">Loading race info…</div>;
  if (err || !race)
    return <div className="p-6 text-center text-red-500">{err}</div>;

  const startsIn = formatStartsIn(race.raceDate);

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

      {/* Simplified Top Card */}
      <main className="max-w-lg mx-auto px-8 py-6 space-y-6">
        <Card className="p-4 flex flex-col justify-between min-h-[130px]">
          <div className="space-y-2 text-center">
            <Badge className="bg-primary/20 text-primary border-primary/30">
              Starting Soon
            </Badge>
            <div className="flex justify-center items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                Starts in {startsIn}{" "}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 border-t pt-3">
            <span>
              {race.distance}
            </span>
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <Trophy className="h-4 w-4 text-primary" />
              {race.prize} coins
            </span>
          </div>
        </Card>

        {/* Horse Selection */}
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

        {/* Bet Section */}
        {selectedHorses.length > 0 && (
          <Card className="p-6 space-y-6 bg-gradient-to-br from-primary/10 to-secondary/50">
            <h3 className="text-lg font-bold">Place Your Bet</h3>
            {selectedHorses.map((horseId) => {
              const horse = race.horses.find((h) => h.id === horseId)!;
              const amount = betAmounts[horseId] || "";
              const potentialWin = amount
                ? (Number(amount) * horse.odds).toFixed(0)
                : "0";

              return (
                <div
                  key={horseId}
                  className="space-y-3 border-b pb-4 last:border-none"
                >
                  <p className="font-semibold">
                    Betting On:{" "}
                    <span className="text-foreground">{horse.name}</span>
                  </p>
                  <Label htmlFor={`bet-${horseId}`}>Bet Amount</Label>
                  <div className="relative">
                    <Input
                      id={`bet-${horseId}`}
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) =>
                        handleBetAmountChange(horseId, e.target.value)
                      }
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
                        onClick={() =>
                          handleBetAmountChange(horseId, String(v))
                        }
                      >
                        {v}
                      </Button>
                    ))}
                  </div>

                  {amount && (
                    <div className="p-3 rounded-lg bg-card border border-border flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Potential Win:
                      </span>
                      <span className="text-xl font-bold text-primary">
                        {potentialWin} coins
                      </span>
                    </div>
                  )}
                </div>
              );
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

            <Button className="w-full" size="lg" onClick={handlePlaceBet}>
              Place Bet
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}