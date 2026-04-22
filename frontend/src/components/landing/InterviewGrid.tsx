/**
 * @fileoverview Interactive "intelligence grid" hero visual for the landing page.
 *
 * Renders a 5x4 grid of interview-topic cells that lift, scale, brighten, and glow as the cursor
 * approaches. Inspired by the Spline hexagon showcase the user shared; adapted to InterviewIntel's
 * violet/fuchsia palette and interview theme with zero new dependencies (reuses framer-motion).
 *
 * Performance model:
 *  - Mouse position lives in two `useMotionValue`s so per-frame updates never trigger React renders.
 *  - Each cell subscribes via `useTransform` and writes directly to style (GPU-composited transforms).
 *  - Idle state: a `useAnimationFrame` loop moves a virtual hotspot in a slow Lissajous-ish path so
 *    the grid reads as "alive" before the user hovers.
 *
 * Accessibility / fallbacks:
 *  - `aria-hidden` because the grid is purely decorative; the h1 is the first semantic element.
 *  - `prefers-reduced-motion`, touch devices, and low-core machines render a static radial-lit grid.
 *
 * @module components/landing/InterviewGrid
 */

import { useMemo, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";

/** Grid geometry. Keep in sync with `LABELS.length` (COLS * ROWS). */
const COLS = 5;
const ROWS = 4;

/**
 * Normalized radius of influence in grid-space (0..1). Cells within this distance from the cursor
 * lift; cells beyond it stay flat. Tuned so roughly a 3x3 cluster is "active" at any time.
 */
const INFLUENCE_RADIUS = 0.36;

/**
 * Short interview/intelligence labels for each cell. Length MUST equal COLS*ROWS. Kept terse so
 * the label fits on a single line inside the cell at all breakpoints.
 */
const LABELS = [
  "Behavioral",
  "STAR",
  "Systems",
  "Trade-offs",
  "Leadership",
  "Conflict",
  "Ownership",
  "Data",
  "Algorithms",
  "Scale",
  "Latency",
  "Testing",
  "Fit",
  "Gaps",
  "Scope",
  "Risk",
  "Retro",
  "Metrics",
  "Vision",
  "Delivery",
] as const;

/** Fisher-Yates shuffle (stable on generics). Used to vary cell order per mount. */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Detects devices that lack hover (touch-only) or have too few CPU cores to comfortably animate
 * 20 cells per frame. Evaluated once via `useState` lazy init — no effect/state churn.
 */
function useCapabilityFallback(): boolean {
  const [fallback] = useState(() => {
    if (typeof window === "undefined") return false;
    const isTouch = window.matchMedia?.("(hover: none)").matches ?? false;
    const lowCore =
      typeof navigator !== "undefined" &&
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency < 4;
    return isTouch || lowCore;
  });
  return fallback;
}

/**
 * Individual cell. Owns its normalized center and derives lift/transform/glow from the shared
 * cursor motion values via `useTransform` — no React state, no re-renders after mount.
 */
function Cell({
  label,
  col,
  row,
  mx,
  my,
}: {
  label: string;
  col: number;
  row: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const cx = (col + 0.5) / COLS;
  const cy = (row + 0.5) / ROWS;

  const lift = useTransform<number, number>([mx, my], (values) => {
    const [x, y] = values as [number, number];
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - dist / INFLUENCE_RADIUS);
  });

  const y = useTransform(lift, (v) => -v * 16);
  const scale = useTransform(lift, (v) => 1 + v * 0.09);
  const opacity = useTransform(lift, (v) => 0.32 + v * 0.68);
  const boxShadow = useTransform(
    lift,
    (v) =>
      `0 ${8 + v * 22}px ${18 + v * 36}px -${6 - v * 2}px rgba(139, 92, 246, ${v * 0.55})`,
  );
  const borderColor = useTransform(
    lift,
    (v) => `rgba(167, 139, 250, ${0.18 + v * 0.55})`,
  );
  const textOpacity = useTransform(lift, (v) => 0.55 + v * 0.45);

  return (
    <motion.div
      style={{
        y,
        scale,
        opacity,
        boxShadow,
        borderColor,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      className="relative flex aspect-square items-center justify-center rounded-xl border bg-gradient-to-br from-violet-500/10 via-violet-600/5 to-fuchsia-500/10 p-1 backdrop-blur-sm"
    >
      <motion.span
        style={{ opacity: textOpacity }}
        className="text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.16em] text-violet-100/90 sm:text-[10px]"
      >
        {label}
      </motion.span>
    </motion.div>
  );
}

/**
 * Static radial-lit grid shown to reduced-motion users, touch devices, and low-core machines.
 * Pre-computes per-cell lift from the grid center so it still reads as a decorative composition.
 */
function StaticGrid({ labels }: { labels: string[] }) {
  return (
    <div
      aria-hidden
      className="grid w-full max-w-md grid-cols-5 gap-2"
      style={{ perspective: "1200px" }}
    >
      {labels.map((label, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cx = (col + 0.5) / COLS;
        const cy = (row + 0.5) / ROWS;
        const dx = 0.5 - cx;
        const dy = 0.5 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const lift = Math.max(0, 1 - dist / INFLUENCE_RADIUS);
        return (
          <div
            key={`${label}-${i}`}
            style={{
              opacity: 0.32 + lift * 0.68,
              boxShadow: `0 ${6 + lift * 14}px ${14 + lift * 24}px -6px rgba(139, 92, 246, ${lift * 0.45})`,
              borderColor: `rgba(167, 139, 250, ${0.18 + lift * 0.45})`,
            }}
            className="relative flex aspect-square items-center justify-center rounded-xl border bg-gradient-to-br from-violet-500/10 via-violet-600/5 to-fuchsia-500/10 p-1"
          >
            <span
              style={{ opacity: 0.55 + lift * 0.45 }}
              className="text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.16em] text-violet-100/90 sm:text-[10px]"
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Interactive hero grid. Cursor-reactive when capable (desktop + mouse + prefers motion + ≥4 cores);
 * otherwise renders {@link StaticGrid}.
 */
export function InterviewGrid() {
  const reducedMotion = useReducedMotion();
  const capabilityFallback = useCapabilityFallback();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const labels = useMemo(() => shuffle(LABELS), []);

  /**
   * Idle Lissajous wave — slow hotspot orbit that keeps the grid feeling "alive" before the user
   * hovers. Deactivates the instant the cursor enters the grid so direct interaction wins.
   */
  useAnimationFrame((t) => {
    if (active) return;
    const a = t / 2200;
    const b = t / 1700;
    mx.set(0.5 + 0.42 * Math.cos(a));
    my.set(0.5 + 0.32 * Math.sin(b));
  });

  if (reducedMotion || capabilityFallback) {
    return <StaticGrid labels={labels} />;
  }

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onPointerMove={(e) => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set((e.clientX - rect.left) / rect.width);
        my.set((e.clientY - rect.top) / rect.height);
      }}
      className="group relative w-full max-w-md"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        className="grid grid-cols-5 gap-2"
        style={{
          transform: "rotateX(14deg)",
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
      >
        {labels.map((label, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          return (
            <Cell
              key={`${label}-${i}`}
              label={label}
              col={col}
              row={row}
              mx={mx}
              my={my}
            />
          );
        })}
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_70%)] blur-2xl"
      />
    </div>
  );
}
