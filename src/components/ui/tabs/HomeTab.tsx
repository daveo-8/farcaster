"use client";
import { useEffect, useMemo, useState } from "react";

import { Coins, Clock, TrendingUp, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useWallet } from "~/lib/wallet-context";
import { Card } from "~/components/ui/card";
import { startWhiteBars } from "./whiteBars";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

type Leader = {
  bettor: string;
  total_bets: number;
  total_staked: string | number;
  total_won: string | number;
};

type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
};

function shortAddress(addr: string) {
  if (!addr) return "???";
  if (addr.startsWith("0x") && addr.length > 10) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr;
}

function formatCoins(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString();
}

function rankBadge(index: number) {
  switch (index) {
    case 0:
      return { text: "👑 Top Dog", className: "text-yellow-400" };
    case 1:
      return { text: "🔥 On a Heater", className: "text-red-400" };
    case 2:
      return { text: "💰 High Roller", className: "text-green-400" };
    default:
      return { text: "🎲 Grinder", className: "text-blue-400" };
  }
}

const EVENTS: EventItem[] = [
  {
    id: "black-friday",
    title: "Black Friday Flash Sale",
    description: "Bonus coins and boosted rewards to kick off the holiday grind.",
    date: "2025-11-29",
  },
  {
    id: "christmas",
    title: "Christmas Race Festival",
    description: "Limited-time festive races with extra rewards on daily chests.",
    date: "2025-12-25",
  },
  {
    id: "new-year",
    title: "New Year Coin Rush",
    description: "Ring in the new year with boosted multipliers and XP bonuses.",
    date: "2026-01-01",
  },
];

function FirstVisitDisclaimer() {
  const KEY = "disclaimerAccepted";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" ? localStorage.getItem(KEY) : "1";
    if (!ok) setOpen(true);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function accept() {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Disclaimer</h3>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <p>
            This app uses a simulated, non-monetary currency for entertainment and testing only.
            Balances, rewards, and wagers have no real-world value and cannot be bought, sold, or
            redeemed for money or goods.
          </p>
          <p>
            By selecting Accept, you confirm you understand this is not real gambling and agree to
            use the app accordingly.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
          <button
            onClick={accept}
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyRewardChest() {
  const { addCoins } = useWallet();
  const LS_KEY = "dailyRewardLastClaim";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const accent = "#ff3b3b";

  const [lastClaim, setLastClaim] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (stored) setLastClaim(Number(stored));
  }, []);

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
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(
      2,
      "0"
    )}`;
  }

  function claim() {
    if (!available) return;
    const t = Date.now();
    localStorage.setItem(LS_KEY, String(t));
    setLastClaim(t);
    addCoins(500);
    alert("You claimed your daily reward.");
  }

  return (
    <div className="flex items-center justify-end mb-4 mt-4 pr-4 select-none">
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
        <div className="relative w-12 h-10">
          <div
            className="absolute bottom-0 left-0 right-0 h-7 rounded-b-md"
            style={{ background: accent }}
          />
          <div
            className="absolute -top-1 left-0 right-0 h-5 rounded-t-md"
            style={{ background: accent }}
          />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-4 rounded-sm bg-yellow-400" />
        </div>
      </button>
    </div>
  );
}

export function HomeTab() {
  const { stats } = useWallet();

  const totalBets = stats?.totalBets ?? 0;
  const totalWins = stats?.totalWins ?? 0;
  const winRate = stats?.winRate ?? 0;

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [eventIndex, setEventIndex] = useState(0);

  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      stop = await startWhiteBars();
    })();
    return () => {
      if (stop) stop();
    };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLeadersError(null);
        setLeadersLoading(true);

        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        const rows: Leader[] = data?.leaderboard ?? [];
        setLeaders(rows);
      } catch (err) {
        console.error("Failed to load leaderboard", err);
        setLeadersError("Could not load leaderboard");
      } finally {
        setLeadersLoading(false);
      }
    }

    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const activeEvent = EVENTS[eventIndex];

  function eventCountdownLabel(dateStr: string) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const eventTime = new Date(dateStr).getTime();
    const diffDays = Math.ceil((eventTime - Date.now()) / DAY_MS);

    if (diffDays > 1) return `${diffDays} days left`;
    if (diffDays === 1) return "1 day left";
    if (diffDays === 0) return "Today";
    return "Ended";
  }

  function eventCountdownTone(dateStr: string) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const eventTime = new Date(dateStr).getTime();
    const diffDays = Math.ceil((eventTime - Date.now()) / DAY_MS);

    if (diffDays > 1) return "text-emerald-300";
    if (diffDays === 1 || diffDays === 0) return "text-yellow-300";
    return "text-muted-foreground";
  }

  function nextEvent() {
    setEventIndex((i) => (i + 1) % EVENTS.length);
  }

  function prevEvent() {
    setEventIndex((i) => (i - 1 + EVENTS.length) % EVENTS.length);
  }

  return (
    <div className="">
      <FirstVisitDisclaimer />

      <section>
        <div className="mt-4 mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Upcoming Races</h2>
          <DailyRewardChest />
        </div>
        <div id="white-bars-root" className="space-y-3" />
      </section>

      {activeEvent && (
        <section className="mt-4 mb-2">
          <Card className="relative overflow-hidden border border-primary/50 bg-gradient-to-r from-primary/40 via-pink-500/40 to-purple-600/40">
            <div className="absolute inset-y-0 right-0 w-40 opacity-40 blur-3xl bg-gradient-to-l from-white/70 to-transparent" />
            <div className="relative flex items-center gap-3 p-4">
              <button
                type="button"
                onClick={prevEvent}
                aria-label="Previous event"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/30 text-xs hover:bg-black/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Event Board</span>
                </div>
                <h3 className="mt-1 text-lg font-semibold text-white">{activeEvent.title}</h3>
                <p className="mt-1 text-xs text-white/80">{activeEvent.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-black/30 px-2 py-1 text-white">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(activeEvent.date).toLocaleDateString()}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] ${eventCountdownTone(
                      activeEvent.date
                    )}`}
                  >
                    {eventCountdownLabel(activeEvent.date)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/80">
                    {eventIndex + 1}/{EVENTS.length}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={nextEvent}
                aria-label="Next event"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/30 text-xs hover:bg-black/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mt-4 mb-4">Your Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{totalBets}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Bets</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{totalWins}</div>
            <div className="text-xs text-muted-foreground mt-1">Wins</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-primary">{winRate.toFixed(0)}%</span>
            </div>
          </Card>

        </div>
      </section>


      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Live top bettors
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
              {leadersLoading && (
                <>
                  <div className="h-9 rounded-md bg-muted/60 animate-pulse" />
                  <div className="h-9 rounded-md bg-muted/60 animate-pulse" />
                  <div className="h-9 rounded-md bg-muted/60 animate-pulse" />
                </>
              )}

              {!leadersLoading && leadersError && (
                <p className="text-sm text-red-400">{leadersError}</p>
              )}

              {!leadersLoading && !leadersError && leaders.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No bets yet. Place a bet to climb the leaderboard!
                </p>
              )}

              {!leadersLoading &&
                !leadersError &&
                leaders.map((leader, index) => {
                  const badge = rankBadge(index);
                  return (
                    <div
                      key={leader.bettor + index}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border-2 border-primary">
                          <AvatarImage src="/placeholder.svg?height=80&width=80" />
                          <AvatarFallback className="text-sm font-semibold">
                            {leader.bettor.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <h3 className="text-sm font-semibold mb-0.5">
                            {shortAddress(leader.bettor)}
                          </h3>
                          <span className={`text-xs ${badge.className} animate-pulse`}>
                            {badge.text} • {leader.total_bets} bets
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">Net wins</div>
                        <span className="text-green-400 font-bold text-sm">
                          {formatCoins(leader.total_won)} 🪙
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6 text-center border-t border-border pt-4 text-sm text-muted-foreground">
        <p className="max-w-lg mx-auto">
          This platform uses fake in-game currency purely for entertainment and testing purposes.
          No real money or items of value are involved.
        </p>
        <button
          onClick={() =>
            localStorage.removeItem("disclaimerAccepted") || window.location.reload()
          }
          className="mt-3 inline-flex items-center justify-center rounded-md border px-4 py-1 text-xs font-medium hover:bg-accent"
        >
          View Disclaimer
        </button>
      </section>
    </div>
  );
}
