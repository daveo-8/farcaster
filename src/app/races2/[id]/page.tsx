"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Clock, Trophy, Coins, ChevronLeft, ArrowLeft } from "lucide-react";
import { useWallet } from "~/lib/wallet-context";
import { toast } from "sonner";
import Link from "next/link";

// ----- Chain read (fallback) -----
import type { Abi } from "viem";
import {
  createPublicClient,
  custom,
  http,
  encodeFunctionData,
  parseEther,
} from "viem";

const RACE_ABI = [
  {
    type: "function",
    name: "getRace",
    stateMutability: "view",
    inputs: [{ name: "raceId", type: "uint256" }],
    outputs: [
      { type: "string" }, // name
      { type: "string[]" }, // racers
      { type: "uint64" }, // startTime
      { type: "uint64" }, // lockTime
      { type: "bool" }, // settled
      { type: "uint8" }, // winnerIndex
      { type: "uint256" }, // totalPool
      { type: "uint256[]" }, // poolByRacer
      { type: "bool" }, // vrfRequested
    ],
  },
] as const satisfies Abi;

// ---- Horsey (betting) ABI & addresses ----

const HORSEY_ABI = [
  {
    type: "function",
    name: "bet",
    stateMutability: "payable",
    inputs: [{ name: "_horse", type: "uint8" }],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

// Addresses you provided:
const HORSEY_ADDRESS = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const RPC_URL = "http://127.0.0.1:8545";
const RACE_ADDRESS = HORSEY_ADDRESS;

const COIN_TO_ETH = 1.0; 

// ---------------- UI Types ----------------
type UiHorse = {
  id: number;
  name: string;
  jockey: string;
  odds: number;
  color: string;
};

type UiRace = {
  id: number;
  name: string;
  location: string;
  raceDate: Date;
  distance: string;
  track: string;
  prize: string;
  horses: UiHorse[];
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

const COLOR_CLASSES = [
  "bg-blue-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-fuchsia-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-lime-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-pink-600",
  "bg-purple-600",
];

function pickColor(idx: number) {
  return COLOR_CLASSES[idx % COLOR_CLASSES.length];
}

function weiToEthStr(bi: bigint) {
  const s = bi.toString().padStart(19, "0");
  const whole = s.slice(0, -18) || "0";
  const frac = s.slice(-18).slice(0, 4).padEnd(4, "0");
  return `${whole}.${frac}`;
}

// ---------------- Page ----------------
export default function RaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { balance, addBet } = useWallet();

  const [race, setRace] = useState<UiRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedHorses, setSelectedHorses] = useState<number[]>([]);
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});
  const [customMode, setCustomMode] = useState<Record<number, boolean>>({});
  const [placingOnChain, setPlacingOnChain] = useState(false);

  useEffect(() => {
    let alive = true;

    async function fromApi(): Promise<UiRace | null> {
      let res = await fetch("/api/info?full=1", { cache: "no-store" });
      if (!res.ok) {
        res = await fetch("/api/info", { cache: "no-store" });
        if (!res.ok) return null;
      }
      const data = (await res.json()) as any[];
      const found =
        data.find((r) => String(r.raceId) === params.id) ??
        data.find((r) => String(r.id) === params.id);
      if (!found) return null;

      const lockTimeSec: number | null =
        typeof found.lockTime !== "undefined"
          ? Number(found.lockTime)
          : found.time
          ? Math.floor(Date.parse(String(found.time)) / 1000)
          : null;

      const name: string = found.name ?? `Race ${params.id}`;
      const racers: string[] = Array.isArray(found.racers) ? found.racers : [];
      const totalPoolWei: bigint = found.totalPoolWei
        ? BigInt(found.totalPoolWei)
        : BigInt(found.totalPool ?? 0);
      const poolByRacerWei: bigint[] = Array.isArray(found.poolByRacerWei)
        ? found.poolByRacerWei.map((x: any) => BigInt(x))
        : Array.isArray(found.poolByRacer)
        ? found.poolByRacer.map((x: any) => BigInt(x))
        : racers.map(() => 0n);

      const ui: UiRace = {
        id: Number(params.id),
        name,
        location: "—",
        raceDate: new Date((lockTimeSec ?? Math.floor(Date.now() / 1000)) * 1000),
        distance: "—",
        track: "—",
        prize: totalPoolWei ? `Pool: ${weiToEthStr(totalPoolWei)} ETH` : "—",
        horses: racers.map((nm, i) => {
          const pool = poolByRacerWei[i] ?? 0n;
          const odds =
            pool > 0n && totalPoolWei > 0n
              ? Number((totalPoolWei * 1_000_000n) / pool) / 1_000_000
              : 1;
          return {
            id: i,
            name: nm,
            jockey: "—",
            odds,
            color: pickColor(i),
          };
        }),
      };
      return ui;
    }

    async function fromChain(): Promise<UiRace | null> {
      if (!RACE_ADDRESS) return null;
      const transport =
        typeof window !== "undefined" && (window as any).ethereum
          ? custom((window as any).ethereum)
          : RPC_URL
          ? http(RPC_URL)
          : null;

      if (!transport) return null;

      const client = createPublicClient({ transport });
      const raceId = BigInt(params.id);

      try {
        const res = await client.readContract({
          address: RACE_ADDRESS as `0x${string}`,
          abi: RACE_ABI,
          functionName: "getRace",
          args: [raceId],
        });

        const [
          name,
          racers,
          startTime,
          lockTime,
          settled,
          winnerIndex,
          totalPool,
          poolByRacer,
        ] = res as unknown as [
          string,
          string[],
          bigint,
          bigint,
          boolean,
          number,
          bigint,
          bigint[],
        ];

        const ui: UiRace = {
          id: Number(params.id),
          name: name ?? `Race ${params.id}`,
          location: "—",
          raceDate: new Date(Number(lockTime) * 1000),
          distance: "—",
          track: "—",
          prize: totalPool ? `Pool: ${weiToEthStr(totalPool)} ETH` : "—",
          horses: (racers || []).map((nm, i) => {
            const pool = (poolByRacer || [])[i] ?? 0n;
            const odds =
              pool > 0n && totalPool > 0n
                ? Number((totalPool * 1_000_000n) / pool) / 1_000_000
                : 1;
            return {
              id: i,
              name: nm,
              jockey: "—",
              odds,
              color: pickColor(i),
            };
          }),
        };
        return ui;
      } catch (e) {
        console.error("Direct chain read failed:", e);
        return null;
      }
    }

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const viaApi = await fromApi();
        if (alive && viaApi) {
          setRace(viaApi);
          return;
        }

        const viaChain = await fromChain();
        if (alive && viaChain) {
          setRace(viaChain);
          return;
        }

        if (alive) setErr(`Race ${params.id} not found`);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load race data");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [params.id]);

  // ---- Handlers ----
  const handleHorseSelect = (horseId: number) => {
    setSelectedHorses((prev) =>
      prev.includes(horseId) ? prev.filter((id) => id !== horseId) : [...prev, horseId],
    );
  };

  const handleBetAmountChange = (horseId: number, value: string) => {
    setBetAmounts((prev) => ({ ...prev, [horseId]: value }));
  };

  const handleCustomToggle = (horseId: number, mode: boolean) => {
    setCustomMode((prev) => ({ ...prev, [horseId]: mode }));
  };

// ---- On-chain bet helper ----
  async function placeOnChainBets(
    finalBets: { raceId: number; horseId: number; amount: number }[],
  ) {
    if (finalBets.length === 0) return;

    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast("Wallet not found", {
        description: "Please install MetaMask or another EVM wallet.",
      });
      return;
    }

    const ethereum = (window as any).ethereum;

    // Request accounts
    const accounts: string[] = await ethereum.request({
      method: "eth_requestAccounts",
    });
    const from = accounts[0];

    // Horse enum in Solidity: NONE, ONE, TWO, ..., SEVEN
    // So we map UI horseId 0..6 → 1..7
    for (const bet of finalBets) {
      const ethAmount = bet.amount * COIN_TO_ETH;
      if (!ethAmount || ethAmount <= 0) continue;

      const valueWei = parseEther(ethAmount.toString());

      const horseEnumValue = bet.horseId + 1;

      const data = encodeFunctionData({
        abi: HORSEY_ABI,
        functionName: "bet",
        args: [horseEnumValue],
      });

      try {
        await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: HORSEY_ADDRESS,
              value: "0x" + valueWei.toString(16),
              data,
            },
          ],
        });
      } catch (error: any) {
        // If user rejects, just stop further on-chain txs but keep local state intact.
        console.error("On-chain bet failed", error);
        throw error;
      }
    }
  }

  /* --- Place bet flow --- */
  const handlePlaceBet = async () => {
    if (!race) return;
    if (!selectedHorses.length)
      return toast("No Horses Selected", { description: "Select at least one horse." });

    let totalSpent = 0;
    const bets = selectedHorses
      .map((id) => {
        const horse = race.horses.find((h) => h.id === id);
        const amount = parseFloat(betAmounts[id]);
        if (!horse || isNaN(amount) || amount <= 0) return null;
        totalSpent += amount;
        return { horse, amount };
      })
      .filter(Boolean) as { horse: UiHorse; amount: number }[];

    if (!totalSpent)
      return toast("Invalid Bet", { description: "Enter valid bet amounts." });

    if (totalSpent > balance)
      return toast("Insufficient Balance", { description: "Not enough coins." });

    const finalBets = bets.map(({ horse, amount }) => ({
      raceId: race.id,
      raceName: race.name,
      horseId: horse.id,
      horseName: horse.name,
      amount,
      odds: horse.odds,
      potentialWin: Math.round(amount * horse.odds),
    }));

    try {
      setPlacingOnChain(true);

      await placeOnChainBets(
        finalBets.map((b) => ({
          raceId: b.raceId,
          horseId: b.horseId,
          amount: b.amount,
        })),
      );

      // persist locally and update wallet context
      const existingBets = JSON.parse(localStorage.getItem("userBets") || "[]");
      const allBets = [...existingBets, ...finalBets];
      localStorage.setItem("userBets", JSON.stringify(allBets));
      finalBets.forEach(addBet);

      toast("Bets Placed!", {
        description: `Placed ${finalBets.length} bet(s) on-chain`,
      });

      setSelectedHorses([]);
      setBetAmounts({});
      setCustomMode({});
      router.push(`/horseRoom/${race.id}`);
    } catch (error: any) {
      console.error(error);
      toast("On-chain bet failed", {
        description: error?.message ?? "Transaction was rejected or failed on-chain.",
      });
    } finally {
      setPlacingOnChain(false);
    }
  };

  /* --- Rendering --- */

  if (loading) return <div className="p-6 text-center">Loading race info…</div>;
  if (err || !race)
    return (
      <div className="p-6 text-center text-red-500">{err ?? "Race not found"}</div>
    );

  const startsIn = formatStartsIn(race.raceDate);

  // Derived values for bottom summary
  const totalAmount = selectedHorses.reduce((acc, id) => {
    const v = parseFloat(betAmounts[id] ?? "0");
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const totalPotential = selectedHorses.reduce((acc, id) => {
    const horse = race.horses.find((h) => h.id === id);
    const amt = parseFloat(betAmounts[id] ?? "0");
    if (!horse || isNaN(amt) || amt <= 0) return acc;
    return acc + Math.round(amt * (Number.isFinite(horse.odds) ? horse.odds : 1));
  }, 0);

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

      {/* Top Card */}
      <main className="max-w-lg mx-auto px-8 py-6 space-y-6">
        <Card className="p-4 flex flex-col justify-between min-h-[130px]">
          <div className="space-y-2 text-center">
            <Badge className="bg-primary/20 text-primary border-primary/30">
              Starting Soon
            </Badge>
            <div className="flex justify-center items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Starts in {startsIn}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 border-t pt-3">
            <span>{race.distance}</span>
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <Trophy className="h-4 w-4 text-primary" />
              {race.prize || "—"}
            </span>
          </div>
        </Card>

        {/* Horse Selection */}
        <section>
          <h2 className="text-xl font-bold mb-4">Select Horse(s)</h2>
          <div className="space-y-3">
            {race.horses.map((horse) => {
              const isSelected = selectedHorses.includes(horse.id);
              const thisAmount = betAmounts[horse.id] ?? "";

              return (
                <Card
                  key={horse.id}
                  onClick={() => handleHorseSelect(horse.id)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/50"
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
                      <div className="text-2xl font-bold text-primary">
                        {Number.isFinite(horse.odds) ? `${horse.odds.toFixed(2)}x` : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">odds</div>
                    </div>
                  </div>

                  {/* If selected, show the amount controls */}
                  {isSelected && (
                    <div className="mt-4 space-y-3 border-t pt-3">
                      {!customMode[horse.id] ? (
                        <>
                          <Label className="text-md font-bold">Bet Amount</Label>

                          <div className="flex gap-2 flex-wrap">
                            {[50, 100, 250, 500].map((v) => (
                              <Button
                                key={v}
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBetAmountChange(horse.id, String(v));
                                }}
                              >
                                {v}
                              </Button>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCustomToggle(horse.id, true);
                              }}
                            >
                              Custom
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCustomToggle(horse.id, false);
                            }}
                          >
                            <ArrowLeft className="h-4 w-4 mr-1" /> Back
                          </Button>

                          <Label htmlFor={`custom-${horse.id}`} className="text-lg font-bold">
                            Enter amount
                          </Label>
                          <Input
                            id={`custom-${horse.id}`}
                            type="number"
                            placeholder="Enter custom amount"
                            value={thisAmount}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleBetAmountChange(horse.id, e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      {/* Bottom Summary Card */}
      {selectedHorses.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
          <Card className="bg-[#111] border border-border/40 p-5 rounded-2xl shadow-lg">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="font-semibold flex items-center justify-center gap-1">
                  <Coins className="h-4 w-4 text-primary" />
                  {balance.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Bet Total</p>
                <p className="font-semibold text-foreground">{totalAmount.toLocaleString()}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Potential Win</p>
                <p className="font-semibold text-green-400">{totalPotential.toLocaleString()}</p>
              </div>
            </div>

            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              size="lg"
              onClick={handlePlaceBet}
              disabled={placingOnChain}
            >
              {placingOnChain ? "Placing on-chain…" : "Place Bet"}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
