"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ChevronLeft, Circle, ChevronDown, ChevronUp } from "lucide-react";
import HorseRaceAnimation from "~/components/HorseRaceAnimation";

// ---- CONFIG: Ponder API ----
const PONDER_API_URL =
  process.env.NEXT_PUBLIC_PONDER_API_URL ?? "http://127.0.0.1:42069";

// ---- Types ----
type Horse = {
  id: number;
  name: string;
  color: string;
  odds: number;
  totalBets: number;
};

type Race = {
  id: number;
  name: string;
  horses: Horse[];
};

type UserBet = {
  raceId: number;
  horseId: number;
  amount: number;
  potentialWin: number;
};

type ChatMessage = {
  id: number;
  text?: string;
  image?: string;
  timestamp: string;
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

function formatTimeDiff(target: Date | null): string {
  if (!target) return "";
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "0s";
  const totalSeconds = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m && s) return `${m}m ${s}s`;
  if (m) return `${m}m`;
  return `${s}s`;
}

export default function HorseRoomPage() {
  const router = useRouter();
  const { id: raceId } = useParams();

  const [race, setRace] = useState<Race | null>(null);
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [modalImage, setModalImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- New: timing / winner state (for animation) ---
  const [bettingCloseTime, setBettingCloseTime] = useState<Date | null>(null);
  const [hasBettingClosed, setHasBettingClosed] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [animationReady, setAnimationReady] = useState(false);
  const [nowTick, setNowTick] = useState(0); // just to re-render countdown

  // ---- Load user bets from localStorage ----
  useEffect(() => {
    const stored = localStorage.getItem("userBets");
    if (stored) {
      try {
        setUserBets(JSON.parse(stored));
      } catch {
        console.error("Invalid stored bets");
      }
    }
  }, []);

  // ---- Load race + betting close time from /api/info ----
  useEffect(() => {
    const loadRace = async () => {
      try {
        // Fetch race info
        let res = await fetch(`/api/info?full=1`, { cache: "no-store" });
        if (!res.ok) {
          res = await fetch(`/api/info`, { cache: "no-store" });
          if (!res.ok) throw new Error("Failed to load race info");
        }

        const data = await res.json();

        // Find the race by ID
        const found =
          data.find((r: any) => String(r.raceId) === String(raceId)) ??
          data.find((r: any) => String(r.id) === String(raceId));
        if (!found) throw new Error(`Race ${raceId} not found`);

        const raceIdNum = Number(raceId);

        const racers = Array.isArray(found.racers)
          ? found.racers
          : found.horses?.map((h: any) => h.name) ?? [];

        // betting close time: prefer lockTime (seconds), else "time" field
        let lockTimeMs: number | null = null;
        if (typeof found.lockTime !== "undefined") {
          const lockSeconds = Number(found.lockTime);
          if (Number.isFinite(lockSeconds) && lockSeconds > 0) {
            lockTimeMs = lockSeconds * 1000;
          }
        } else if (found.time) {
          const parsed = Date.parse(String(found.time));
          if (!Number.isNaN(parsed)) lockTimeMs = parsed;
        }

        if (lockTimeMs) {
          setBettingCloseTime(new Date(lockTimeMs));
        } else {
          setBettingCloseTime(null);
        }

        // Map horses (keep old logic)
        const horses: Horse[] = racers.map((name: string, index: number) => {
          // Sum only the user bets for this horse
          const totalBets = userBets
            .filter((b) => b.raceId === raceIdNum && b.horseId === index)
            .reduce((sum, b) => sum + b.amount, 0);

          // Odds from API (optional)
          let odds = 1;
          if (found.poolByRacerWei) {
            const totalPool = BigInt(found.totalPoolWei ?? found.totalPool ?? 0);
            const pool = BigInt(found.poolByRacerWei[index] ?? 0);
            odds =
              pool > 0n && totalPool > 0n
                ? Number((totalPool * 1_000_000n) / pool) / 1_000_000
                : 1;
          }

          return {
            id: index,
            name,
            color: COLOR_CLASSES[index % COLOR_CLASSES.length],
            odds,
            totalBets,
          };
        });

        setRace({
          id: raceIdNum,
          name: found.name ?? `Race ${raceId}`,
          horses,
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadRace();
  }, [raceId, userBets]);

  const sortedHorses = race
    ? [...race.horses].sort((a, b) => a.odds - b.odds)
    : [];

  // ---- Tick every second for countdown text ----
  useEffect(() => {
    if (!bettingCloseTime) return;
    const id = setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [bettingCloseTime]);

  // ---- Watch bettingCloseTime and flip hasBettingClosed when time passes ----
  useEffect(() => {
    if (!bettingCloseTime) {
      // If no close time known, treat as already closed
      setHasBettingClosed(true);
      return;
    }

    const check = () => {
      if (Date.now() >= bettingCloseTime.getTime()) {
        setHasBettingClosed(true);
      }
    };

    check();
    if (hasBettingClosed) return;

    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [bettingCloseTime, hasBettingClosed]);

  // ---- After betting closed, poll Ponder /races to find winner ----
  useEffect(() => {
    if (!hasBettingClosed || !race) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const pollWinner = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${PONDER_API_URL}/races`);
        if (!res.ok) throw new Error("Failed to fetch Ponder races");

        const json = await res.json();
        const races = json.races ?? json.data ?? [];
        const match = races.find(
          (r: any) =>
            String(r.raceIndex ?? r.race_id ?? r.id) === String(race.id),
        );

        if (match && match.winner != null) {
          // winner is an enum 1..7 in Horsey → convert to 0-based index
          const winnerEnum = Number(match.winner);
          if (Number.isFinite(winnerEnum) && winnerEnum > 0) {
            setWinnerIndex(winnerEnum - 1);
            setAnimationReady(true);
            return;
          }
        }
      } catch (err) {
        console.error("Error polling winner from Ponder", err);
      }

      // No winner yet → poll again in 3 seconds
      if (!cancelled) {
        timeoutId = window.setTimeout(pollWinner, 3000);
      }
    };

    pollWinner();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasBettingClosed, race]);

  // ---- Chat Handlers (unchanged) ----
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMessage: ChatMessage = {
      id: messages.length + 1,
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        image: reader.result as string,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, newMessage]);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    for (const item of e.clipboardData.items) {
      if (item.type.includes("image")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const newMessage: ChatMessage = {
            id: messages.length + 1,
            image: reader.result as string,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setMessages((prev) => [...prev, newMessage]);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
      }
    }
  };

  // ---- Auto-scroll chat (unchanged) ----
  useEffect(() => {
    const chatContainer = chatEndRef.current?.parentElement;
    if (!chatContainer) return;

    const isNearBottom =
      chatContainer.scrollHeight -
        chatContainer.scrollTop -
        chatContainer.clientHeight <
      50;

    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ---- CLO & Chat toggles (unchanged) ----
  const toggleCLO = () => {
    setExpanded(!expanded);
    if (!expanded) setChatOpen(false);
    else setChatOpen(true);
  };

  const openChat = () => {
    setChatOpen(true);
    setExpanded(false);
  };

  if (!race) return <div className="p-6 text-center">Loading race...</div>;

  const winnerHorseId =
    winnerIndex != null && race.horses[winnerIndex]
      ? race.horses[winnerIndex].id
      : null;

  const animationStatusLabel = (() => {
    if (!hasBettingClosed) {
      return bettingCloseTime
        ? `Betting closes in ${formatTimeDiff(bettingCloseTime)}`
        : "Waiting for betting window to close…";
    }
    if (hasBettingClosed && winnerIndex == null) {
      return "Betting Window Open, Waiting For Closure";
    }
    return "Race in progress…";
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{race.name}</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col p-3 gap-2">
        {/* Animation */}
        <div className="relative w-full bg-gradient-to-br from-primary/10 to-secondary/20 rounded-lg shadow-md aspect-[4/3] flex items-center justify-center overflow-hidden">
          {animationReady && winnerIndex != null ? (
            <HorseRaceAnimation
              key={winnerIndex} // force reset if winner changes
              winnerIndex={winnerIndex}
              numHorses={race.horses.length}
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-black/70 text-white text-center px-4">
              <span className="text-sm font-semibold mb-1">
                {animationStatusLabel}
              </span>
              {bettingCloseTime && !hasBettingClosed && (
                <span className="text-xs text-gray-300">
                  Scheduled close at{" "}
                  {bettingCloseTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          {/* Winner label (optional) */}
          {/* {winnerHorseId != null && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              Winner: Horse #{winnerHorseId + 1}
            </div>
          )} */}
        </div>

        {/* Current Live Odds (unchanged) */}
        <Card className="w-full p-2 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-md font-bold flex-1">Current Live Odds</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCLO}
              className="flex items-center gap-1 text-sm"
            >
              {expanded ? (
                <span className="flex items-center gap-1">
                  Show Less <ChevronUp className="h-3 w-3" />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Show All <ChevronDown className="h-3 w-3" />
                </span>
              )}
            </Button>
          </div>

          {/* Collapsed */}
          {!expanded && (
            <div className="flex justify-evenly py-1">
              {sortedHorses.slice(0, 3).map((horse, index) => {
                const userBet = userBets.find(
                  (b) => b.horseId === horse.id && b.raceId === Number(race.id),
                );
                return (
                  <HorseRowCollapsed
                    key={horse.id}
                    horse={horse}
                    index={index}
                    userBet={userBet}
                  />
                );
              })}
            </div>
          )}

          {/* Expanded */}
          {expanded && (
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white scrollbar-track-gray-800">
              {sortedHorses.map((horse, index) => {
                const userBet = userBets.find(
                  (b) => b.horseId === horse.id && b.raceId === Number(race.id),
                );
                return (
                  <HorseRowExpanded
                    key={horse.id}
                    horse={horse}
                    index={index}
                    userBet={userBet}
                  />
                );
              })}
            </div>
          )}
        </Card>

        {/* Show Chat button when CLO expanded */}
        {expanded && !chatOpen && (
          <Button
            className="w-full py-2 rounded-lg shadow-md text-sm"
            onClick={openChat}
          >
            Open Chat
          </Button>
        )}

        {/* Chat Section */}
        {chatOpen && (
          <Card className="w-full h-64 p-2 flex flex-col bg-black text-white shadow-md">
            <div className="text-sm font-bold mb-1 border-b border-gray-700 pb-1">
              Chat
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white scrollbar-track-gray-800">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="border-b border-gray-700 pb-1 text-xs"
                >
                  <span className="text-gray-400 mr-1">{msg.timestamp}</span>
                  {msg.text && <span>{msg.text}</span>}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="uploaded"
                      className="mt-1 max-h-24 rounded-md cursor-pointer"
                      onClick={() => setModalImage(msg.image!)}
                    />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-1 mt-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="flex-1 p-1 rounded-md border border-gray-600 bg-gray-900 text-white text-sm"
              />

              <Button size="sm" onClick={handleSendMessage}>
                Send
              </Button>
            </div>
          </Card>
        )}

        {/* Image Modal */}
        {modalImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setModalImage(null)}
          >
            <div
              className="relative flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="mb-2 text-white bg-gray-800 rounded-full px-2 py-1 text-lg font-bold"
                onClick={() => setModalImage(null)}
              >
                ✕
              </button>
              <img
                src={modalImage}
                alt="modal"
                className="max-h-[80vh] max-w-[90vw] rounded-md"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- Horse rows (unchanged) ---------------- */

function HorseRowCollapsed({
  horse,
  index,
  userBet,
}: {
  horse: Horse;
  index: number;
  userBet?: UserBet;
}) {
  return (
    <div className="flex flex-col items-center text-center p-1 rounded-lg min-w-[80px]">
      <div className="flex items-center gap-1 mb-1">
        {userBet && (
          <Circle className="h-3 w-3 text-green-500 fill-green-500" />
        )}
        <div
          className={`w-6 h-6 rounded-md ${horse.color} flex items-center justify-center text-white text-sm font-bold`}
        >
          {index + 1}
        </div>
        <div className="flex flex-col text-left ml-1">
          <span className="text-xs font-semibold">{horse.name}</span>
          <span className="text-[10px] text-muted-foreground">
            Total: {(horse.totalBets ?? 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function HorseRowExpanded({
  horse,
  index,
  userBet,
}: {
  horse: Horse;
  index: number;
  userBet?: UserBet;
}) {
  return (
    <div className="p-1 rounded-lg flex flex-col transition-all">
      <div className="flex items-center gap-2 mb-1">
        {userBet && (
          <Circle className="h-3 w-3 text-green-500 fill-green-500" />
        )}
        <div
          className={`w-6 h-6 rounded-md ${horse.color} flex items-center justify-center text-white text-sm font-bold`}
        >
          {index + 1}
        </div>
        <div className="font-semibold text-sm">{horse.name}</div>
      </div>
      <div className="text-[10px] text-muted-foreground ml-6">
        <div>Total: {(horse.totalBets ?? 0).toLocaleString()} coins</div>
        {userBet && (
          <>
            <div>Your Bet: {userBet.amount} coins</div>
            <div className="text-green-500">
              Potential Win: {userBet.potentialWin} coins
            </div>
          </>
        )}
      </div>
    </div>
  );
}
