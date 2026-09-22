import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/snake")({
  head: () => ({
    meta: [
      { title: "Snake — Nokia 3310" },
      { name: "description", content: "Play the classic Nokia 3310 Snake game in your browser." },
    ],
  }),
  component: SnakePage,
});

const COLS = 16;
const ROWS = 9;
const CELL = 15;
const TICK_MS = 130;

// Screen padding (lcd px-2 + bezel p-3 + phone body p-5), doubled for both sides.
const SCREEN_PADDING = (8 + 12 + 20) * 2;
const PHONE_WIDTH = COLS * CELL + SCREEN_PADDING;

type Point = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

const OPPOSITE: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };

function randomFood(snake: Point[]): Point {
  while (true) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function SnakePage() {
  const [snake, setSnake] = useState<Point[]>([
    { x: 8, y: 6 },
    { x: 7, y: 6 },
    { x: 6, y: 6 },
  ]);
  const [dir, setDir] = useState<Dir>("RIGHT");
  // Deterministic placeholder so server and client render the same markup on
  // first paint; replaced with a real random position once mounted.
  const [food, setFood] = useState<Point>({ x: COLS - 2, y: ROWS - 2 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");

  const dirRef = useRef(dir);
  const nextDirRef = useRef(dir);
  const statusRef = useRef(status);
  dirRef.current = dir;
  statusRef.current = status;

  useEffect(() => {
    const saved = Number(localStorage.getItem("nokia-snake-best") || 0);
    if (!Number.isNaN(saved)) setBest(saved);
    setFood(randomFood(snake));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    const start = [
      { x: 8, y: 6 },
      { x: 7, y: 6 },
      { x: 6, y: 6 },
    ];
    setSnake(start);
    setDir("RIGHT");
    nextDirRef.current = "RIGHT";
    setFood(randomFood(start));
    setScore(0);
    setStatus("playing");
  }, []);

  const turn = useCallback((d: Dir) => {
    if (statusRef.current !== "playing") return;
    if (OPPOSITE[d] === dirRef.current) return;
    nextDirRef.current = d;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        w: "UP",
        s: "DOWN",
        a: "LEFT",
        d: "RIGHT",
      };
      if (e.key === " " || e.key === "Enter") {
        if (statusRef.current !== "playing") reset();
        return;
      }
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        turn(d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, reset]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      setDir(nextDirRef.current);
      setSnake((prev) => {
        const d = nextDirRef.current;
        const head = prev[0];
        const delta = {
          UP: { x: 0, y: -1 },
          DOWN: { x: 0, y: 1 },
          LEFT: { x: -1, y: 0 },
          RIGHT: { x: 1, y: 0 },
        }[d];
        const newHead = { x: head.x + delta.x, y: head.y + delta.y };

        const hitsWall = newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS;
        const hitsSelf = prev.some((s) => s.x === newHead.x && s.y === newHead.y);

        if (hitsWall || hitsSelf) {
          setStatus("over");
          setBest((b) => {
            const nb = Math.max(b, score);
            localStorage.setItem("nokia-snake-best", String(nb));
            return nb;
          });
          return prev;
        }

        const ateFood = newHead.x === food.x && newHead.y === food.y;
        const nextSnake = [newHead, ...prev];
        if (ateFood) {
          setScore((s) => s + 10);
          setFood(randomFood(nextSnake));
        } else {
          nextSnake.pop();
        }
        return nextSnake;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, food, score]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-900 p-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-neutral-400 text-sm tracking-[0.3em] uppercase font-mono">
          Nokia 3310 · Snake
        </h1>

        {/* Phone body */}
        <div
          className="rounded-[36px] bg-gradient-to-b from-[#2b2f28] to-[#1c1f19] p-5 shadow-2xl border-4 border-[#111310]"
          style={{ width: PHONE_WIDTH }}
        >
          {/* Screen bezel */}
          <div className="rounded-md bg-[#9aa66b] p-3 shadow-inner">
            <div className="rounded-sm bg-[#c3d17a] px-2 py-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]">
              {/* Status row */}
              <div
                className="flex items-center justify-between font-mono text-[10px] mb-1 px-1"
                style={{ color: "#2b3a1a" }}
              >
                <span>SCORE {score}</span>
                <span>BEST {best}</span>
              </div>

              {/* Game grid */}
              <div
                className="relative mx-auto"
                style={{
                  width: COLS * CELL,
                  height: ROWS * CELL,
                  backgroundColor: "#c3d17a",
                }}
              >
                <svg width={COLS * CELL} height={ROWS * CELL} className="absolute inset-0">
                  {snake.map((s, i) => (
                    <rect
                      key={i}
                      x={s.x * CELL + 1}
                      y={s.y * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      fill="#2b3a1a"
                    />
                  ))}
                  <rect
                    x={food.x * CELL + 4}
                    y={food.y * CELL + 4}
                    width={CELL - 8}
                    height={CELL - 8}
                    fill="#2b3a1a"
                  />
                </svg>

                {status !== "playing" && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-center"
                    style={{ color: "#2b3a1a", backgroundColor: "rgba(195,209,122,0.92)" }}
                  >
                    <span className="text-xs font-bold tracking-widest">
                      {status === "ready" ? "SNAKE II" : "GAME OVER"}
                    </span>
                    {status === "over" && <span className="text-[10px]">SCORE {score}</span>}
                    <span className="text-[10px] animate-pulse">PRESS START</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nokia branding */}
          <div className="text-center text-[#8b9a7a] font-mono text-[10px] tracking-[0.4em] mt-3 mb-1">
            NOKIA
          </div>

          {/* Keypad */}
          <div className="mt-3 flex flex-col items-center gap-3">
            <button
              onClick={() => (statusRef.current === "playing" ? turn("UP") : reset())}
              className="w-14 h-9 rounded-lg bg-[#3a3f34] active:bg-[#4a4f42] text-neutral-300 text-xs font-mono shadow"
            >
              ▲
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => turn("LEFT")}
                className="w-14 h-9 rounded-lg bg-[#3a3f34] active:bg-[#4a4f42] text-neutral-300 text-xs font-mono shadow"
              >
                ◀
              </button>
              <button
                onClick={reset}
                className="w-16 h-9 rounded-lg bg-[#4a4f42] active:bg-[#5a5f52] text-neutral-300 text-[10px] font-mono shadow"
              >
                START
              </button>
              <button
                onClick={() => turn("RIGHT")}
                className="w-14 h-9 rounded-lg bg-[#3a3f34] active:bg-[#4a4f42] text-neutral-300 text-xs font-mono shadow"
              >
                ▶
              </button>
            </div>
            <button
              onClick={() => turn("DOWN")}
              className="w-14 h-9 rounded-lg bg-[#3a3f34] active:bg-[#4a4f42] text-neutral-300 text-xs font-mono shadow"
            >
              ▼
            </button>
          </div>
        </div>

        <p className="text-neutral-500 text-xs font-mono">
          Arrow keys / WASD to move · Space to start
        </p>
      </div>
    </div>
  );
}
