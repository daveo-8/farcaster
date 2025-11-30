"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Clock, Trophy, Coins, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "~/lib/wallet-context";

// ⭐ Use your already written animation component
import HorseRaceAnimation from "~/components/HorseRaceAnimation";

// ---- Type definitions: add more fields depending on your backend / contract ----
interface UiHorse {
  index: number; // 0-based
  name: string;
  odds: number; // e.g. 2.5 = 2.5x
  totalBetAmount?: number;
}

interface UiRace {
  id: string;
  title: string;
  description?: string;
  horses: UiHorse[];
  // Here we only care about settled + winnerIndex, others can be added as needed
  settled: boolean;
  winnerIndex: number | null; // 0-based
  startTime?: string;
  closeTime?: string;
}

// ---- Page component ----
export default function RaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { address, balance } = useWallet();

  const [race, setRace] = useState<UiRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Betting related local state
  const [selectedHorseIndex, setSelectedHorseIndex] = useState<number | null>(
    null
  );
  const [betAmount, setBetAmount] = useState<string>("");

  // ----- Load race data -----
  useEffect(() => {
    let alive = true;

    async function loadRace() {
      setLoading(true);
      setErr(null);

      try {
        // 👇 Using example API here; replace with your own
        const res = await fetch(`/api/races/${params.id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load race: ${res.statusText}`);
        }

        const data = (await res.json()) as UiRace;

        if (!alive) return;
        setRace(data);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message ?? "Failed to load race");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRace();
    return () => {
      alive = false;
    };
  }, [params.id]);

  // Whether the race already has results
  const hasResult = useMemo(() => {
    if (!race) return false;
    return (
      race.settled &&
      race.winnerIndex !== null &&
      race.winnerIndex >= 0 &&
      race.winnerIndex < race.horses.length
    );
  }, [race]);

  // Betting button logic (example only — replace with contract logic)
  async function handlePlaceBet() {
    if (!race) return;
    if (!address) {
      toast.error("Please connect wallet first.");
      return;
    }
    if (selectedHorseIndex === null) {
      toast.error("Please select a horse.");
      return;
    }
    const amountNum = Number(betAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid bet amount.");
      return;
    }

    try {
      toast.loading("Placing bet...", { id: "bet" });

      // ❗ Example only: replace with your real bet API / contract call
      const res = await fetch(`/api/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId: race.id,
          horseIndex: selectedHorseIndex, // 0-based
          amount: amountNum,
        }),
      });

      if (!res.ok) {
        const e = await res.text();
        throw new Error(e || "Bet failed");
      }

      toast.success("Bet placed!", { id: "bet" });
      // Refresh race data after bet
      router.refresh?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Bet failed", { id: "bet" });
    }
  }

  // ====== Render section ======

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto" />
          <p className="text-slate-300">Loading race...</p>
        </div>
      </div>
    );
  }

  if (err || !race) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <Card className="bg-slate-900/80 border-slate-800 max-w-md w-full mx-4 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-slate-50"
              onClick={() => router.push("/races2")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Race not found</h1>
          </div>
          <p className="text-slate-400">
            {err ?? "The race you are looking for does not exist."}
          </p>
          <Button
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={() => router.push("/races2")}
          >
            Back to Races
          </Button>
        </Card>
      </div>
    );
  }

  // ✅ If results exist -> show winner + animation
  if (hasResult) {
    const winnerHorse = race.horses[race.winnerIndex!];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-slate-50"
              onClick={() => router.push("/races2")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600/90 text-emerald-50">
                  <Trophy className="w-3 h-3 mr-1" />
                  Finished
                </Badge>
                <span className="text-xs text-slate-400">
                  Race #{race.id}
                </span>
              </div>
              <h1 className="text-lg font-semibold mt-1">{race.title}</h1>
            </div>
            {address && (
              <div className="text-right text-xs text-slate-400">
                <div className="font-mono truncate max-w-[180px]">
                  {address}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>{balance?.toLocaleString?.() ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <Card className="bg-slate-900/70 border-slate-800 overflow-hidden">
            <div className="px-6 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/90 text-amber-950 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    Winner
                  </Badge>
                  <span className="text-xs text-slate-400">
                    Race #{race.id}
                  </span>
                </div>
                <h2 className="text-xl font-semibold mt-1">
                  Horse #{race.winnerIndex! + 1} – {winnerHorse?.name}
                </h2>
              </div>
            </div>

            {/* ⭐ Show your animation inside the card */}
            <div className="bg-black">
              <HorseRaceAnimation
                winnerIndex={race.winnerIndex!} // 0-based
                numHorses={race.horses.length}
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-300">
              <span>
                Thanks for playing! You can go back to{" "}
                <Link
                  href="/races2"
                  className="text-emerald-400 hover:underline"
                >
                  race list
                </Link>{" "}
                to join another race.
              </span>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // 🐎 Otherwise: race still open / unsettled -> show betting UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-slate-50"
            onClick={() => router.push("/races2")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-600/90 text-sky-50">
                <Clock className="w-3 h-3 mr-1" />
                Open for betting
              </Badge>
              <span className="text-xs text-slate-400">
                Race #{race.id}
              </span>
            </div>
            <h1 className="text-lg font-semibold mt-1">{race.title}</h1>
          </div>
          {address && (
            <div className="text-right text-xs text-slate-400">
              <div className="font-mono truncate max-w-[180px]">
                {address}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>{balance?.toLocaleString?.() ?? "-"}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: horse list */}
        <Card className="flex-1 bg-slate-900/70 border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Select a Horse</h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose which horse you think will win the race.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {race.horses.map((h) => {
              const isSelected = selectedHorseIndex === h.index;
              return (
                <button
                  key={h.index}
                  type="button"
                  onClick={() => setSelectedHorseIndex(h.index)}
                  className={`w-full text-left px-6 py-4 flex items-center justify-between hover:bg-slate-800/60 transition ${
                    isSelected ? "bg-slate-800/80" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Horse #{h.index + 1}
                      </span>
                      {isSelected && (
                        <Badge className="bg-emerald-600/90 text-emerald-50">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{h.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-400 text-sm">
                      <Trophy className="w-4 h-4" />
                      <span>{h.odds.toFixed(2)}x</span>
                    </div>
                    {typeof h.totalBetAmount === "number" && (
                      <p className="text-xs text-slate-500 mt-1">
                        Pool: {h.totalBetAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right: betting panel */}
        <Card className="w-full lg:w-80 bg-slate-900/70 border-slate-800 h-fit">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold">Place your Bet</h2>
            <p className="text-xs text-slate-400 mt-1">
              Select a horse on the left, then enter your stake.
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Selected Horse</Label>
              <div className="px-3 py-2 rounded border border-slate-700 bg-slate-900/80 text-sm text-slate-200">
                {selectedHorseIndex === null ? (
                  <span className="text-slate-500">
                    No horse selected yet.
                  </span>
                ) : (
                  <>
                    Horse #{selectedHorseIndex + 1} –{" "}
                    {
                      race.horses.find((h) => h.index === selectedHorseIndex)
                        ?.name
                    }
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bet" className="text-xs text-slate-300">
                Bet Amount
              </Label>
              <Input
                id="bet"
                type="number"
                min="0"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Enter amount..."
                className="bg-slate-900/70 border-slate-700 text-sm"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Wallet balance</span>
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>{balance?.toLocaleString?.() ?? "-"}</span>
              </span>
            </div>
          </div>

          <div className="px-6 pb-4">
            <Button className="w-full" size="lg" onClick={handlePlaceBet}>
              Place Bet
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
