"use client";
import { useEffect, useMemo, useState } from "react";

import { Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useWallet } from "~/lib/wallet-context";
import { Card } from "~/components/ui/card";
import { startWhiteBars } from "./whiteBars";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

/* ---------------- Daily Reward Chest (red version) ---------------- */
function DailyRewardChest() {
  const LS_KEY = "dailyRewardLastClaim";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const accent = "#ff3b3b"; // 🔴 red color

  const [lastClaim, setLastClaim] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Load saved timestamp once
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (stored) setLastClaim(Number(stored));
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const available = useMemo(() => !lastClaim || now - lastClaim >= DAY_MS, [lastClaim, now]);
  const remainingMs = useMemo(
    () => (available ? 0 : Math.max(0, DAY_MS - (now - (lastClaim ?? 0)))),
    [available, now, lastClaim]
  );

  function format(ms: number) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function claim() {
    if (!available) return;
    const t = Date.now();
    localStorage.setItem(LS_KEY, String(t));
    setLastClaim(t);
    alert("🎁 You claimed your daily reward!");
  }

  return (
    <div className="flex items-center justify-end mb-4 mt-4 pr-4 select-none">
      {/* Timer */}
      <div className="text-right leading-tight mr-3">
        <div className="text-xs text-muted-foreground">Daily Reward</div>
        {available ? (
          <div className="text-sm font-semibold text-green-500">Ready to claim</div>
        ) : (
          <div className="text-sm font-semibold" style={{ color: accent }}>
            Next in {format(remainingMs)}
          </div>
        )}
      </div>

      {/* Chest button */}
      <button
        onClick={claim}
        disabled={!available}
        aria-label={available ? "Claim daily reward" : "Daily reward on cooldown"}
        className={`relative rounded-xl p-2 border shadow-sm transition ${
          available ? "hover:scale-105 animate-bounce" : "opacity-60 cursor-not-allowed"
        }`}
        style={{
          borderColor: accent,
          background: "linear-gradient(180deg, rgba(255,59,59,0.15), rgba(255,59,59,0.06))",
        }}
      >
        {/* Chest icon */}
        <div className="relative w-12 h-10">
          {/* Base */}
          <div className="absolute bottom-0 left-0 right-0 h-7 rounded-b-md" style={{ background: accent }} />
          {/* Lid */}
          <div className="absolute -top-1 left-0 right-0 h-5 rounded-t-md" style={{ background: accent }} />
          {/* Lock */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-4 rounded-sm bg-yellow-400" />
        </div>
      </button>
    </div>
  );
}
/* ------------------------------------------------------------------ */

export function HomeTab() {
  const { stats } = useWallet();

  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      stop = await startWhiteBars();
    })();
    return () => {
      if (stop) stop();
    };
  }, []);

  return (
    <div className="">

      <section>
  <div className="mt-4 mb-4 flex items-center justify-between">
    <h2 className="text-xl font-bold">Upcoming Races</h2>
    <DailyRewardChest />
  </div>
  <div id="white-bars-root" className="space-y-3" />
</section>


      <section>
        <h2 className="text-xl font-bold mt-4 mb-4">Your Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalBets}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Bets</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalWins}</div>
            <div className="text-xs text-muted-foreground mt-1">Wins</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-primary">{stats.winRate.toFixed(0)}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
          </Card>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Starting in 15m
          </span>
        </div>

        <Card className="overflow-hidden">
          <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary">
            <img
              src="/horse-racing-track.webp"
              alt="Featured race track"
              className="w-full h-full object-cover opacity-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent pointer-events-none z-0" />
            <div className="absolute inset-0 p-4 space-y-3 overflow-y-auto z-10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src="/placeholder.svg?height=80&width=80" />
                    <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold mb-0.5">Test Name 1</h3>
                    <span className="text-sm text-red-400 animate-pulse drop-shadow-[0_0_6px_var(--tw-shadow-color)] [--tw-shadow-color:theme(colors.red.400)]">
                      🔥 On a Heater
                    </span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-lg">$12,450</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src="/placeholder.svg?height=80&width=80" />
                    <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold mb-0.5">Test Name 2</h3>
                    <span className="text-sm text-blue-400 animate-pulse">🎉 Day One Player</span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-lg">$9,820</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src="/placeholder.svg?height=80&width=80" />
                    <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold mb-0.5">Test Name 3</h3>
                    <span className="text-sm text-green-400 animate-pulse">🐢 Slow & Steady</span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-lg">$7,530</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src="/placeholder.svg?height=80&width=80" />
                    <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold mb-0.5">Test Name 4</h3>
                    <span className="text-sm text-yellow-400 animate-pulse">💰 High Roller</span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-lg">$5,420</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src="/placeholder.svg?height=80&width=80" />
                    <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold mb-0.5">Test Name 5</h3>
                    <span className="text-sm text-purple-400 animate-pulse">👑 VIP Elite</span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-lg">$4,110</span>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
