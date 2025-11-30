"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Index of the winning horse (0-based, 0..numHorses-1) */
  winnerIndex: number;
  /** Number of participating horses, default 7 */
  numHorses?: number;
  /** Callback after the animation finishes (optional) */
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

export default function HorseRaceAnimation({
  winnerIndex,
  numHorses = 7,
  onFinished,
}: Props) {
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

    // Animation time control
    const COUNTDOWN_TIME = 1500; // Countdown 1.5s
    const RACE_DURATION = 8000; // Race about 8 seconds
    const AFTER_FINISH_PAUSE = 2000; // Pause 2 sec after finish

    let horses: HorseState[] = [];
    let raceStartTime: number | null = null;
    let countdownStartTime: number | null = null;
    let finished = false;
    let allStopped = false;
    let lastWinnerFinishTime = 0;

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
      ctx.fillRect(0, TRACK_TOP - 40, VIEW_WIDTH, TRACK_HEIGHT + 80);

      // Track
      ctx.fillStyle = "#5f4b32";
      ctx.fillRect(START_X - 40, TRACK_TOP, VIEW_WIDTH - 120, TRACK_HEIGHT);

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

      // Color: highlight winner
      if (isWinner) {
        ctx.fillStyle = "#ffd700";
      } else {
        // Simple unique hue per horse
        const hue = 200 + (lane * 35) % 120;
        ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      }

      roundRect(ctx, x, y, bodyWidth, bodyHeight, radius);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(
        x + bodyWidth + 8,
        y + bodyHeight / 2 - 4,
        8,
        0,
        Math.PI * 2
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
        Math.PI * 2
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
        VIEW_HEIGHT / 2 - 10
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillText(
        "Race finished",
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2 + 32
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
        // Check if winner reaches finish
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
      // t = race progress in seconds (excluding countdown)
      const normalized = Math.min(t / (RACE_DURATION / 1000), 1);

      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        if (h.finished) continue;

        // Base speed + random variance
        const randomFactor = 0.6 + Math.random() * 0.4;
        let speed = h.baseSpeed * randomFactor;

        // Winner bonus acceleration
        if (i === winnerIndex) {
          // Guarantee winning gradually
          const boostScale = 0.4 + normalized * 0.8;
          speed += h.extraBoost * boostScale;
        }

        // Update progress (0~1)
        h.progress += speed * (1 / 60); // approx 60fps frame time
        if (h.progress > 1) h.progress = 1;

        // Map progress → x position
        const targetX =
          START_X + h.progress * (FINISH_LINE_X - START_X);
        h.x = targetX;

        if (h.x >= FINISH_LINE_X) {
          h.x = FINISH_LINE_X;
          h.finished = true;
        }
      }

      // If all horses are done, mark finished
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

    // Helper: rounded rectangle
    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    // Start animation
    const startTime = performance.now();
    animationFrameId = requestAnimationFrame((ts) =>
      frame(ts ?? startTime)
    );

    // Cleanup
    return () => {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [winnerIndex, numHorses, onFinished]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-black"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: "16px",
          border: "2px solid #ffffff",
          background: "#000000",
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
