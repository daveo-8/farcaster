"use client";

import { useEffect, useRef } from "react";

const CANVAS_W = 960;
const CANVAS_H = 360;

// Fixed maximum of 7 horses (because LANE_OFFSETS has only 7 tracks, and images are 1~7)
const MAX_HORSES = 7;
const COUNTDOWN_SECONDS = 3;
const RACE_DURATION = 7; // Same as pygame, total 7 seconds

const HORSE_ANCHOR_Y = 0.96;
const HORSE_GROUND_OFFSET = 40;

// Start / Finish / Track parameters
const START_X = 60;
const FINISH_X = 820;
const FINISH_COLOR = "rgba(220,40,40,1)";
const FINISH_WIDTH_PX = 6;

// Ground / Track
const NEAR_TARGET_H = 140;
const GROUND_OVERLAP = 4;

// Track offsets (max 7 horses)
const LANE_OFFSETS = [0, 18, 36, 54, 72, 90, 108];

// Finish line appearance time
const FINISH_APPEAR_T = 3.3;
const FINISH_END_T = RACE_DURATION;

// Loser horse target range
const LOSER_MIN_X = 600;
const LOSER_MAX_X = 780;

// Background scroll speed
const BG_SCROLL_SPEED = 110; // px/s

// Speed-related
const MIN_SPEED = 60; // px/s
const MAX_SPEED = 150;
const RANDOM_ACCEL = 50;
const FINAL_PHASE = 0.7; // final 0.7 seconds

type RaceState = "loading" | "countdown" | "running" | "winner" | "finished";

interface HorseState {
  x: number;
  y: number;
  v: number;
  targetX: number;
  sheet: HTMLImageElement;
  frameIndex: number;
  animTimer: number;
  frameW: number;
  frameH: number;
}

interface HorseRaceAnimationProps {
  /** Which horse wins (starting from 1: 1 = Horse#1, 2 = Horse#2) */
  winnerIndex: number;
  /** Number of participating horses (1~7) */
  numHorses: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

export default function HorseRaceAnimation({
  winnerIndex,
  numHorses,
}: HorseRaceAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    let animationFrameId: number;
    let running = true;

    // Safety handling: limit horse count within 1~MAX_HORSES
    const horseCount = Math.max(1, Math.min(MAX_HORSES, numHorses));

    // External winnerIndex is "which horse" (starting at 1), convert to 0-based
    let winnerIdx = Math.floor(winnerIndex);
    if (Number.isNaN(winnerIdx)) winnerIdx = 0;
    if (winnerIdx < 0) winnerIdx = 0;
    if (winnerIdx >= horseCount) winnerIdx = horseCount - 1;

    (async () => {
      // ===== 1. Load image assets =====
      const bg = await loadImage("/background.png");
      const horseSheets: HTMLImageElement[] = [];

      // Load only the needed number of horses (1 ~ horseCount)
      for (let i = 1; i <= horseCount; i++) {
        horseSheets.push(await loadImage(`/horse_run_rembg${i}.png`));
      }

      const FRAME_COUNT = 12; // Each horse has 12 frames

      // ===== 2. Background scrolling parameters =====
      const bgScale = CANVAS_H / bg.height;
      const bgTileW = bg.width * bgScale;
      const bgTileH = CANVAS_H;
      let bgOffset = 0;

      // ===== 3. Track Y positions =====
      const nearTop = CANVAS_H - NEAR_TARGET_H;
      const lanes = LANE_OFFSETS.slice(0, horseCount).map(
        (d) => nearTop + (GROUND_OVERLAP + d)
      );

      // ===== 4. Initialize horses =====
      const horses: HorseState[] = horseSheets.map((sheet, i) => {
        const frameW = sheet.width / FRAME_COUNT;
        const frameH = sheet.height;

        let targetX: number;
        if (i === winnerIdx) {
          targetX = FINISH_X + 40;
        } else {
          targetX =
            LOSER_MIN_X + Math.random() * (LOSER_MAX_X - LOSER_MIN_X);
        }

        return {
          x: START_X,
          y: lanes[i],
          v: 120 + Math.random() * 60,
          targetX,
          sheet,
          frameIndex: 0,
          animTimer: 0,
          frameW,
          frameH,
        };
      });

      // ===== 5. State machine variables =====
      let state: RaceState = "countdown";
      let countdownT = 0;
      let raceT = 0;
      let winnerTextT = 0;
      let winnerCrossed = false;

      let lastTime = performance.now();

      // ===== 6. Rendering functions =====
      const drawBackground = () => {
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Tile background
        let startX = -((bgOffset % bgTileW) + bgTileW);
        while (startX < CANVAS_W + bgTileW) {
          ctx.drawImage(
            bg,
            0,
            0,
            bg.width,
            bg.height,
            startX,
            0,
            bgTileW,
            bgTileH
          );
          startX += bgTileW;
        }

        // Track separator lines
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        const trackLineOffsets = Array.from(
          { length: lanes.length + 1 },
          (_, i) => 20 + i * 20
        );
        trackLineOffsets.forEach((off) => {
          const y = nearTop + off;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_W, y);
          ctx.stroke();
        });
      };

      const drawFinishLine = () => {
        if (state === "countdown") return;

        let lineX = FINISH_X;

        if (raceT < FINISH_APPEAR_T) {
          // Not yet visible
          return;
        } else if (raceT < FINISH_END_T) {
          // Slide in from the right
          const startX = CANVAS_W + 50;
          const endX = FINISH_X;
          const ratio =
            (raceT - FINISH_APPEAR_T) /
            (FINISH_END_T - FINISH_APPEAR_T);
          const r = Math.max(0, Math.min(1, ratio));
          lineX = startX + (endX - startX) * r;
        }

        ctx.fillStyle = FINISH_COLOR;
        ctx.fillRect(
          lineX - FINISH_WIDTH_PX / 2,
          nearTop,
          FINISH_WIDTH_PX,
          NEAR_TARGET_H
        );
      };

      const drawHorses = () => {
        horses.forEach((h, i) => {
          const scale = 0.9;
          const drawW = h.frameW * scale;
          const drawH = h.frameH * scale;

          const bobAmp = 6;
          const bob = Math.sin(raceT * 6 + i) * bobAmp;

          const drawX = h.x - drawW * 0.5; // anchor.x = 0.5
          const drawY =
            h.y - drawH * HORSE_ANCHOR_Y + bob + HORSE_GROUND_OFFSET; // anchor.y

          const sx = h.frameIndex * h.frameW;
          const sy = 0;

          ctx.drawImage(
            h.sheet,
            sx,
            sy,
            h.frameW,
            h.frameH,
            drawX,
            drawY,
            drawW,
            drawH
          );
        });
      };

      const drawCountdownText = () => {
        const remaining = COUNTDOWN_SECONDS - countdownT;
        let text = "";
        if (remaining > 0.5) {
          text = Math.ceil(remaining).toString();
        } else if (remaining > -0.2) {
          text = "GO!";
        } else {
          return;
        }

        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = "white";
        ctx.font = "bold 72px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
      };

      const drawWinnerText = () => {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = "#ffeb3b";
        ctx.font = "bold 54px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const racerNum = winnerIdx + 1; // Convert back to 1-based for display
        ctx.fillText(`RACER ${racerNum} WIN!`, CANVAS_W / 2, CANVAS_H / 2);
      };

      // ===== 7. Update logic =====
      const updateHorsesAndBg = (dt: number) => {
        if (state === "countdown") {
          horses.forEach((h) => {
            h.x = START_X;
            h.frameIndex = 0;
            h.animTimer = 0;
          });
          return;
        }

        if (state !== "running") return;

        raceT += dt;
        const remainingRace = Math.max(RACE_DURATION - raceT, 0);

        // Background scrolling
        bgOffset += BG_SCROLL_SPEED * dt;
        if (bgOffset > bgTileW) bgOffset -= bgTileW;

        horses.forEach((h, i) => {
          // Running animation frames
          const animFps = 12;
          h.animTimer += dt;
          const step = 1 / animFps;
          while (h.animTimer >= step) {
            h.frameIndex = (h.frameIndex + 1) % FRAME_COUNT;
            h.animTimer -= step;
          }

          if (remainingRace > FINAL_PHASE) {
            // Random acceleration/deceleration phase
            const acc = (Math.random() * 2 - 1) * RANDOM_ACCEL;
            h.v += acc * dt;
            if (h.v < MIN_SPEED) h.v = MIN_SPEED;
            if (h.v > MAX_SPEED) h.v = MAX_SPEED;

            h.x += h.v * dt;

            // Prevent reaching too early
            if (h.x > h.targetX - 10) {
              h.x = h.targetX - 10;
              h.v *= 0.5;
            }
          } else {
            // Final phase: interpolate to targetX
            if (remainingRace > 0) {
              const dist = h.targetX - h.x;
              const vNeeded = dist / remainingRace;
              h.v = vNeeded;
              h.x += h.v * dt;
            } else {
              h.x = h.targetX;
              h.v = 0;
            }
          }
        });

        // Check if winner crosses the finish line
        const winner = horses[winnerIdx];
        if (!winnerCrossed && winner.x >= FINISH_X) {
          winnerCrossed = true;
          state = "winner";
          winnerTextT = 0;
        }
      };

      // ===== 8. Main loop =====
      const loop = (now: number) => {
        if (!running) return;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (state === "countdown") {
          countdownT += dt;
          if (countdownT >= COUNTDOWN_SECONDS) {
            state = "running";
            raceT = 0;
          }
        } else if (state === "winner") {
          winnerTextT += dt;
          if (winnerTextT >= 2.0) {
            state = "finished";
          }
        }

        updateHorsesAndBg(dt);

        // Render order
        drawBackground();
        drawFinishLine();
        drawHorses();

        if (state === "countdown") {
          drawCountdownText();
        } else if (state === "winner" || state === "finished") {
          drawWinnerText();
        }

        animationFrameId = requestAnimationFrame(loop);
      };

      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(loop);
    })();

    return () => {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [winnerIndex, numHorses]); // Depend on props so animation resets when they change

  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        style={{
          border: "2px solid white",
          borderRadius: "12px",
          background: "#000",
        }}
      />
    </main>
  );
}
