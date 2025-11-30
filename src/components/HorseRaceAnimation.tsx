"use client";

import { useEffect, useRef } from "react";

const CANVAS_W = 960;
const CANVAS_H = 360;



const HORSE_ANCHOR_Y = 0.96;
const HORSE_GROUND_OFFSET = 40;


const START_X = 60;
const FINISH_X = 820;
const FINISH_COLOR = "rgba(220,40,40,1)";
const FINISH_WIDTH_PX = 6;



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


      for (let i = 1; i <= horseCount; i++) {
        horseSheets.push(await loadImage(`/horse_run_rembg${i}.png`));
      }


      const bgScale = CANVAS_H / bg.height;
      const bgTileW = bg.width * bgScale;
      const bgTileH = CANVAS_H;
      let bgOffset = 0;


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


      let state: RaceState = "countdown";
      let countdownT = 0;
      let raceT = 0;
      let winnerTextT = 0;
      let winnerCrossed = false;

      let lastTime = performance.now();


      const drawBackground = () => {
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);


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

          );
          startX += bgTileW;
        }


        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        const trackLineOffsets = Array.from(
          { length: lanes.length + 1 },

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

          const r = Math.max(0, Math.min(1, ratio));
          lineX = startX + (endX - startX) * r;
        }

        ctx.fillStyle = FINISH_COLOR;
        ctx.fillRect(
          lineX - FINISH_WIDTH_PX / 2,
          nearTop,
          FINISH_WIDTH_PX,

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


        bgOffset += BG_SCROLL_SPEED * dt;
        if (bgOffset > bgTileW) bgOffset -= bgTileW;

        horses.forEach((h, i) => {

          const animFps = 12;
          h.animTimer += dt;
          const step = 1 / animFps;
          while (h.animTimer >= step) {
            h.frameIndex = (h.frameIndex + 1) % FRAME_COUNT;
            h.animTimer -= step;
          }

          if (remainingRace > FINAL_PHASE) {

            const acc = (Math.random() * 2 - 1) * RANDOM_ACCEL;
            h.v += acc * dt;
            if (h.v < MIN_SPEED) h.v = MIN_SPEED;
            if (h.v > MAX_SPEED) h.v = MAX_SPEED;

            h.x += h.v * dt;


            if (h.x > h.targetX - 10) {
              h.x = h.targetX - 10;
              h.v *= 0.5;
            }
          } else {

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


        const winner = horses[winnerIdx];
        if (!winnerCrossed && winner.x >= FINISH_X) {
          winnerCrossed = true;
          state = "winner";
          winnerTextT = 0;
        }
      };


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

      <canvas
        ref={canvasRef}
        style={{
          border: "2px solid white",
          borderRadius: "12px",
          background: "#000",

  );
}
