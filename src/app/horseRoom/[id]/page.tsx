"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ChevronLeft, Circle, ChevronDown, ChevronUp } from "lucide-react";

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
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{race.name}</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col p-3 gap-2">
        {/* Animation (replaces old placeholder) */}
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

          {/* Winner label (commented out, keep if needed later) */}
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
                  <span className="text-gray-400 mr-1">
                    {msg.timestamp}
                  </span>
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

/* ---------------- Horse Race Animation ---------------- */

type HorseRaceProps = {
  winnerIndex: number;
  numHorses?: number;
  onFinished?: () => void;
};

type HorseState = {
  lane: number;
  x: number;
  y: number;
  baseSpeed: number;
  extraBoost: number;
  finished: boolean;
  progress: number;
};

function HorseRaceAnimation({
  winnerIndex,
  numHorses = 7,
  onFinished,
}: HorseRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --------- Basic canvas setup ----------
    const DPR = window.devicePixelRatio || 1;
    const VIEW_WIDTH = 900;
    const VIEW_HEIGHT = 500;

    canvas.style.width = VIEW_WIDTH + "px";
    canvas.style.height = VIEW_HEIGHT + "px";
    canvas.width = VIEW_WIDTH * DPR;
    canvas.height = VIEW_HEIGHT * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // --------- Race parameters ----------
    const TRACK_PADDING = 80;
    const TRACK_TOP = 70;
    const TRACK_BOTTOM = VIEW_HEIGHT - TRACK_PADDING;
    const TRACK_HEIGHT = TRACK_BOTTOM - TRACK_TOP;
    const LANE_HEIGHT = TRACK_HEIGHT / numHorses;
    const START_X = 80;
    const FINISH_X = VIEW_WIDTH - 80;

    const HORSE_WIDTH = 50;
    const HORSE_HEIGHT = 30;

    // Winner guarantee: leave small buffer before finish line
    const FINISH_LINE_X = FINISH_X - HORSE_WIDTH - 10;

    const COUNTDOWN_TIME = 1500; // Countdown 1.5s
    const RACE_DURATION = 8000; // Race about 8 seconds
    const AFTER_FINISH_PAUSE = 2000; // Pause 2 sec after finish

    let horses: HorseState[] = [];
    let raceStartTime: number | null = null;
    let countdownStartTime: number | null = null;
    let finished = false;
    let allStopped = false;
    let lastWinnerFinishTime = 0;
    let animationFrameId: number | null = null;
    let running = true;

    // --------- Initialize horses ----------
    function initHorses() {
      horses = [];
      for (let i = 0; i < numHorses; i++) {
        const laneY =
          TRACK_TOP + LANE_HEIGHT * (i + 0.5) - HORSE_HEIGHT / 2;

        // Each horse has slightly different base speed
        const baseSpeed = 0.08 + Math.random() * 0.03; // unit: progress/sec

        // Winner has extra buff
        const extraBoost = i === winnerIndex ? 0.06 : 0.0;

        horses.push({
          lane: i,
          x: START_X,
          y: laneY,
          baseSpeed,
          extraBoost,
          finished: false,
          progress: 0,
        });
      }
    }

    initHorses();

    // --------- Draw functions ----------
    function drawBackground() {
      // Background
      ctx.fillStyle = "#06111b";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      // Grass
      ctx.fillStyle = "#0b3b1a";
      ctx.fillRect(
        0,
        TRACK_TOP - 40,
        VIEW_WIDTH,
        TRACK_HEIGHT + 80,
      );

      // Track
      ctx.fillStyle = "#5f4b32";
      ctx.fillRect(
        START_X - 40,
        TRACK_TOP,
        VIEW_WIDTH - 120,
        TRACK_HEIGHT,
      );

      // Lane dividers
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i <= numHorses; i++) {
        const y = TRACK_TOP + LANE_HEIGHT * i;
        ctx.beginPath();
        ctx.moveTo(START_X - 40, y);
        ctx.lineTo(VIEW_WIDTH - 40, y);
        ctx.stroke();
      }

      // Start line
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(START_X, TRACK_TOP);
      ctx.lineTo(START_X, TRACK_BOTTOM);
      ctx.stroke();

      // Finish line
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(FINISH_X, TRACK_TOP, 10, TRACK_HEIGHT);

      // Finish flag
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(FINISH_X + 10, TRACK_TOP - 20, 6, 20);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(FINISH_X + 16, TRACK_TOP - 25, 20, 15);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText("Horse Race", 24, 34);
    }

    function drawHorse(h: HorseState, isWinner: boolean) {
      const { x, y, lane } = h;

      const bodyWidth = HORSE_WIDTH;
      const bodyHeight = HORSE_HEIGHT;
      const radius = 10;

      // Winner is NOT gold anymore; everyone uses lane-based color
      const hue = 200 + ((lane * 35) % 120);
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;

      roundRect(ctx, x, y, bodyWidth, bodyHeight, radius);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(
        x + bodyWidth + 8,
        y + bodyHeight / 2 - 4,
        8,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Eye
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(
        x + bodyWidth + 10,
        y + bodyHeight / 2 - 6,
        2,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Legs
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      const legY = y + bodyHeight;
      for (let i = 0; i < 4; i++) {
        const legX = x + 8 + (i * (bodyWidth - 16)) / 3;
        ctx.beginPath();
        ctx.moveTo(legX, legY);
        ctx.lineTo(legX - 2, legY + 10);
        ctx.stroke();
      }

      // Number
      ctx.fillStyle = "#000";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(String(lane + 1), x + 18, y + 20);
    }

    function drawCountdown(progress: number) {
      // 0~1 → 3,2,1
      const total = 3;
      const t = Math.min(Math.max(progress, 0), 1) * total;
      const step = total - Math.floor(t); // 3 → 2 → 1

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = "#ffffff";
      ctx.font = "80px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(step), VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
      ctx.restore();
    }

    function drawFinishBanner() {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = "#ffd700";
      ctx.font = "52px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `Horse #${winnerIndex + 1} Wins!`,
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2 - 10,
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillText(
        "Race finished",
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2 + 32,
      );
      ctx.restore();
    }

    // --------- Main animation loop ----------
    function frame(now: number) {
      if (!running) return;

      if (!countdownStartTime) {
        countdownStartTime = now;
      }

      const countdownElapsed = now - countdownStartTime;

      // Countdown stage
      if (countdownElapsed < COUNTDOWN_TIME) {
        drawBackground();
        drawAllHorsesStatic();
        const progress = countdownElapsed / COUNTDOWN_TIME;
        drawCountdown(progress);
        animationFrameId = requestAnimationFrame(frame);
        return;
      }

      // Official race start
      if (!raceStartTime) {
        raceStartTime = now;
      }
      const t = (now - raceStartTime) / 1000; // seconds

      updateHorses(t);
      drawBackground();
      drawAllHorses();

      if (!finished) {
        const winner = horses[winnerIndex];
        if (winner.x >= FINISH_LINE_X) {
          finished = true;
          lastWinnerFinishTime = now;
        }
      } else {
        drawFinishBanner();
        // Callback after full animation ends
        if (!allStopped && now - lastWinnerFinishTime > AFTER_FINISH_PAUSE) {
          allStopped = true;
          if (onFinished) onFinished();
        }
      }

      animationFrameId = requestAnimationFrame(frame);
    }

    function updateHorses(t: number) {
      const normalized = Math.min(t / (RACE_DURATION / 1000), 1);

      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        if (h.finished) continue;

        const randomFactor = 0.6 + Math.random() * 0.4;
        let speed = h.baseSpeed * randomFactor;
        if (i === winnerIndex) {
          const boostScale = 0.4 + normalized * 0.8;
          speed += h.extraBoost * boostScale;
        }

        h.progress += speed * (1 / 60); // approx 60fps frame time
        if (h.progress > 1) h.progress = 1;

        const targetX =
          START_X + h.progress * (FINISH_LINE_X - START_X);
        h.x = targetX;

        if (h.x >= FINISH_LINE_X) {
          h.x = FINISH_LINE_X;
          h.finished = true;
        }
      }

      if (!finished && horses.every((h) => h.finished)) {
        finished = true;
      }
    }

    function drawAllHorses() {
      for (let i = 0; i < horses.length; i++) {
        drawHorse(horses[i], i === winnerIndex);
      }
    }

    function drawAllHorsesStatic() {
      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        h.x = START_X;
        drawHorse(h, i === winnerIndex);
      }
    }

    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
    ) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(
        x + w,
        y + h,
        x + w - radius,
        y + h,
      );
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    const startTime = performance.now();
    animationFrameId = requestAnimationFrame((ts) =>
      frame(ts ?? startTime),
    );

    return () => {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [winnerIndex, numHorses, onFinished]);

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "16px",
          border: "2px solid #ffffff",
          background: "#000000",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      />
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
