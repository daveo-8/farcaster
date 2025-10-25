import { useEffect, useMemo, useState } from "react";

const LS_KEY = "dailyRewardLastClaim";
const MS_24H = 24 * 60 * 60 * 1000;

export default function DailyRewardChest({
  rewardAmount = 100,
  accent = "#1778ff",
  onClaim,
}: {
  rewardAmount?: number;
  accent?: string;
  onClaim?: (amount: number) => void;
}) {
  const [lastClaim, setLastClaim] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // load saved timestamp
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) setLastClaim(Number(raw));
  }, []);

  // tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const available = useMemo(() => !lastClaim || now - lastClaim >= MS_24H, [lastClaim, now]);
  const remainingMs = useMemo(
    () => (available ? 0 : Math.max(0, MS_24H - (now - (lastClaim ?? 0)))),
    [available, lastClaim, now]
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
    onClaim?.(rewardAmount);
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {/* timer text */}
      <div className="text-right leading-tight">
        <div className="text-xs text-muted-foreground">Daily Reward</div>
        {available ? (
          <div className="text-sm font-semibold text-green-500">Ready to claim</div>
        ) : (
          <div className="text-sm font-semibold" style={{ color: accent }}>
            Next in {format(remainingMs)}
          </div>
        )}
      </div>

      {/* chest button */}
      <button
        onClick={claim}
        disabled={!available}
        className={`relative rounded-xl p-2 border shadow-sm transition 
          ${available ? "hover:scale-105" : "opacity-70 cursor-not-allowed"}`}
        style={{
          borderColor: accent,
          background: "linear-gradient(180deg, rgba(23,120,255,0.10), rgba(23,120,255,0.04))",
        }}
        aria-label={available ? "Claim daily reward" : "Daily reward on cooldown"}
      >
        {/* simple chest icon (box + lid) */}
        <div className="relative w-12 h-10">
          <div
            className="absolute bottom-0 left-0 right-0 h-7 rounded-b-md"
            style={{ background: accent }}
          />
          <div className="absolute left-0 right-0 -top-1 h-5 rounded-t-md" style={{ background: accent }} />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-4 rounded-sm bg-yellow-400" />
        </div>
      </button>
    </div>
  );
}
