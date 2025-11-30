"use client";

import { useEffect, useRef } from "react";

const CANVAS_W = 960;
const CANVAS_H = 360;

// 固定最多 7 匹马（因为 LANE_OFFSETS 只有 7 条跑道，图片也是 1~7）
const MAX_HORSES = 7;
const COUNTDOWN_SECONDS = 3;
const RACE_DURATION = 7; // 和 pygame 一样，总共 7 秒

const HORSE_ANCHOR_Y = 0.96;
const HORSE_GROUND_OFFSET = 40;

// 起点 / 终点 / 赛道参数
const START_X = 60;
const FINISH_X = 820;
const FINISH_COLOR = "rgba(220,40,40,1)";
const FINISH_WIDTH_PX = 6;

// 地面 / 赛道
const NEAR_TARGET_H = 140;
const GROUND_OVERLAP = 4;

// 跑道偏移（最多 7 匹马）
const LANE_OFFSETS = [0, 18, 36, 54, 72, 90, 108];

// 终点线出现时间
const FINISH_APPEAR_T = 3.3;
const FINISH_END_T = RACE_DURATION;

// 失败马匹的目标范围
const LOSER_MIN_X = 600;
const LOSER_MAX_X = 780;

// 背景滚动速度
const BG_SCROLL_SPEED = 110; // px/s

// 速度相关
const MIN_SPEED = 60; // px/s
const MAX_SPEED = 150;
const RANDOM_ACCEL = 50;
const FINAL_PHASE = 0.7; // 最后 0.7 秒

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
  /** 第几号马赢（从 1 开始：1=1号马，2=2号马） */
  winnerIndex: number;
  /** 参赛马匹数量（1~7） */
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

    // 安全处理：限制马匹数量在 1~MAX_HORSES
    const horseCount = Math.max(1, Math.min(MAX_HORSES, numHorses));

    // 外部传入 winnerIndex 是“第几号马”（从 1 开始），这里转成 0-based 下标
	let winnerIdx = Math.floor(winnerIndex);
	if (Number.isNaN(winnerIdx)) winnerIdx = 0;
	if (winnerIdx < 0) winnerIdx = 0;
	if (winnerIdx >= horseCount) winnerIdx = horseCount - 1;

    (async () => {
      // ===== 1. 加载图片资源 =====
      const bg = await loadImage("/background.png");
      const horseSheets: HTMLImageElement[] = [];

      // 只加载实际需要数量的马（1 ~ horseCount）
      for (let i = 1; i <= horseCount; i++) {
        horseSheets.push(await loadImage(`/horse_run_rembg${i}.png`));
      }

      const FRAME_COUNT = 12; // 每匹马 12 帧

      // ===== 2. 背景滚动参数 =====
      const bgScale = CANVAS_H / bg.height;
      const bgTileW = bg.width * bgScale;
      const bgTileH = CANVAS_H;
      let bgOffset = 0;

      // ===== 3. 跑道 Y 坐标 =====
      const nearTop = CANVAS_H - NEAR_TARGET_H;
      const lanes = LANE_OFFSETS.slice(0, horseCount).map(
        (d) => nearTop + (GROUND_OVERLAP + d)
      );

      // ===== 4. 初始化马匹 =====
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

      // ===== 5. 状态机变量 =====
      let state: RaceState = "countdown";
      let countdownT = 0;
      let raceT = 0;
      let winnerTextT = 0;
      let winnerCrossed = false;

      let lastTime = performance.now();

      // ===== 6. 绘制函数 =====
      const drawBackground = () => {
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 平铺背景
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

        // 赛道分割线
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
          // 未出现
          return;
        } else if (raceT < FINISH_END_T) {
          // 从右侧滑入
          const startX = CANVAS_W + 50;
          const endX = FINISH_X;
          const ratio = (raceT - FINISH_APPEAR_T) / (FINISH_END_T - FINISH_APPEAR_T);
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

        const racerNum = winnerIdx + 1; // 再转回 1-based 显示
        ctx.fillText(`RACER ${racerNum} WIN!`, CANVAS_W / 2, CANVAS_H / 2);
      };

      // ===== 7. 更新逻辑 =====
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

        // 背景滚动
        bgOffset += BG_SCROLL_SPEED * dt;
        if (bgOffset > bgTileW) bgOffset -= bgTileW;

        horses.forEach((h, i) => {
          // 跑步帧动画
          const animFps = 12;
          h.animTimer += dt;
          const step = 1 / animFps;
          while (h.animTimer >= step) {
            h.frameIndex = (h.frameIndex + 1) % FRAME_COUNT;
            h.animTimer -= step;
          }

          if (remainingRace > FINAL_PHASE) {
            // 随机加减速阶段
            const acc = (Math.random() * 2 - 1) * RANDOM_ACCEL;
            h.v += acc * dt;
            if (h.v < MIN_SPEED) h.v = MIN_SPEED;
            if (h.v > MAX_SPEED) h.v = MAX_SPEED;

            h.x += h.v * dt;

            // 防止太早到终点
            if (h.x > h.targetX - 10) {
              h.x = h.targetX - 10;
              h.v *= 0.5;
            }
          } else {
            // 最终阶段：按时间插值到 targetX
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

        // 检查赢家是否冲线
        const winner = horses[winnerIdx];
        if (!winnerCrossed && winner.x >= FINISH_X) {
          winnerCrossed = true;
          state = "winner";
          winnerTextT = 0;
        }
      };

      // ===== 8. 主循环 =====
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

        // 绘制顺序
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
  }, [winnerIndex, numHorses]); // 依赖 props，变动时重新开始动画

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
