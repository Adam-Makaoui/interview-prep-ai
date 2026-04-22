/**
 * @fileoverview Animated floating card stack that demonstrates InterviewIntel's
 * core product flow on the landing hero.
 *
 * Cycles through four cards over ~12 seconds: URL paste → intelligence extraction
 * → mock interview → scorecard. Each card sits in a stylized frame; the active
 * card is front-and-center, previously-shown cards drift up and back into a soft
 * stack, and not-yet-shown cards wait below the viewport.
 *
 * Performance model:
 *   - Phase state changes once every 3s via an async loop. No per-frame math.
 *   - Each card animates between four discrete positional presets via Framer
 *     Motion's spring transition — transforms are GPU-composited, no layout thrash.
 *   - The URL typewriter on card 0 runs a lightweight interval only while card 0
 *     is active.
 *
 * Accessibility:
 *   - Wrapper is `aria-hidden`. The landing h1 remains the first semantic element;
 *     this component adds visual proof, not content a screen reader should read.
 *   - `useReducedMotion` users see the final-phase composition (all four cards
 *     stacked, scorecard on top) with no animation.
 *
 * @module components/landing/HeroProductDemo
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const PHASE_DURATION_MS = 3000;
const CYCLE_FADE_MS = 400;
const TOTAL_CARDS = 4;

const SPRING = { type: "spring" as const, stiffness: 140, damping: 22 };

/**
 * Discrete presets for the four possible stack positions, keyed by `offset` (how
 * many phases behind the active one this card is). Shared by both the animated
 * component and the reduced-motion fallback so the "resting" look is consistent.
 */
const STACK_PRESETS = [
  { y: 0, scale: 1, opacity: 1 },
  { y: -18, scale: 0.96, opacity: 0.42 },
  { y: -32, scale: 0.92, opacity: 0.24 },
  { y: -44, scale: 0.88, opacity: 0.14 },
] as const;

/**
 * Compute the visual state of a card based on its fixed index and the current
 * active phase. Cards with negative offset haven't entered yet (hidden below).
 */
function stateForCard(cardIndex: number, phase: number) {
  const offset = phase - cardIndex;
  if (offset < 0) {
    return { y: 80, scale: 0.94, opacity: 0, zIndex: 0 };
  }
  const clamped = Math.min(offset, STACK_PRESETS.length - 1);
  const preset = STACK_PRESETS[clamped];
  return { ...preset, zIndex: 40 - clamped * 10 };
}

/* ── Shared card chrome ─────────────────────────────────────────────── */

function CardFrame({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-violet-500/30 bg-gray-950/85 p-5 shadow-2xl shadow-violet-500/25 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
        <span aria-hidden className="text-sm leading-none">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/* ── Card 0: URL paste ───────────────────────────────────────────────── */

const STRIPE_URL = "stripe.com/careers/senior-sales-engineer";

function UrlCardContent({ active }: { active: boolean }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!active) return;
    // Intentional: we do NOT synchronously reset `typed` when re-activating, to
    // avoid the `set-state-in-effect` lint. The first interval tick (within
    // ~45ms) overwrites any stale value from a previous cycle while the
    // container is still fading in at near-zero opacity, so the flash is
    // invisible to the user.
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(STRIPE_URL.slice(0, i));
      if (i >= STRIPE_URL.length) window.clearInterval(id);
    }, 45);
    return () => window.clearInterval(id);
  }, [active]);

  return (
    <CardFrame title="Paste a job posting" icon="◉">
      <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-gray-900/80 px-3 py-2.5 font-mono text-xs">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500/80" />
        <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500/80" />
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500/80" />
        <span className="ml-2 shrink-0 text-gray-500">https://</span>
        <span className="truncate text-violet-200">{typed}</span>
        <span className="ml-0.5 inline-block h-3 w-[2px] shrink-0 animate-pulse bg-violet-300" />
      </div>
      <p className="mt-3 text-xs text-gray-500">Any careers URL · pasted text also works</p>
    </CardFrame>
  );
}

/* ── Card 1: Intelligence extraction ─────────────────────────────────── */

const INTEL_ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Company", value: "Stripe — Payments infrastructure" },
  { label: "Role", value: "Senior Sales Engineer · 5-7 yrs · Go, Python" },
  { label: "Panel", value: "Hiring Manager + 2 SE peers + behavioral round" },
];

function IntelCardContent({ active }: { active: boolean }) {
  return (
    <CardFrame title="Intelligence extracted" icon="◎">
      <div className="flex flex-col gap-2">
        {INTEL_ROWS.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -8 }}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.35, delay: active ? i * 0.12 : 0 }}
            className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs"
          >
            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
              {row.label}
            </span>
            <span className="text-gray-200">{row.value}</span>
          </motion.div>
        ))}
      </div>
    </CardFrame>
  );
}

/* ── Card 2: Mock interview ──────────────────────────────────────────── */

function InterviewCardContent({ active }: { active: boolean }) {
  return (
    <CardFrame title="Mock interview" icon="◐">
      <div className="flex flex-col gap-2.5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.3 }}
          className="flex gap-2"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[9px] font-bold text-white">
            M
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[11px] leading-relaxed text-gray-100">
            Walk me through how you&apos;d drive technical buy-in with a skeptical platform team.
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.2, delay: active ? 0.9 : 0 }}
          className="ml-auto flex gap-1 pr-1"
        >
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
              transition={
                active
                  ? { duration: 1.1, repeat: Infinity, delay: dot * 0.15 }
                  : undefined
              }
              className="h-1.5 w-1.5 rounded-full bg-violet-300"
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.35, delay: active ? 1.4 : 0 }}
          className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-500/20 to-violet-500/20 px-3 py-2 text-[11px] leading-relaxed text-indigo-100"
        >
          <span className="font-semibold text-violet-300">S</span>ituation: Stripe&apos;s Connect team was
          migrating…
        </motion.div>
      </div>
    </CardFrame>
  );
}

/* ── Card 3: Scorecard ───────────────────────────────────────────────── */

const SCORE_BARS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "Communication", value: 90 },
  { label: "Technical depth", value: 82 },
  { label: "Ownership", value: 88 },
];

function ScoreCardContent({ active }: { active: boolean }) {
  return (
    <CardFrame title="Scorecard" icon="★">
      <div className="flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.5 }}
          className="font-display flex items-baseline gap-1"
        >
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-4xl font-bold leading-none text-transparent">
            8.5
          </span>
          <span className="text-lg font-semibold text-gray-500">/ 10</span>
        </motion.div>

        <div className="flex flex-col gap-1.5">
          {SCORE_BARS.map((bar, i) => (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="w-24 text-[10px] text-gray-400">{bar.label}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={active ? { width: `${bar.value}%` } : { width: 0 }}
                  transition={{ duration: 0.7, delay: active ? 0.2 + i * 0.1 : 0, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
                />
              </div>
            </div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: active ? 0.9 : 0 }}
          className="text-[11px] leading-relaxed text-gray-400"
        >
          <span className="text-violet-300">Strong structure</span> — add one customer-impact metric to
          sharpen.
        </motion.p>
      </div>
    </CardFrame>
  );
}

/* ── Assembly ────────────────────────────────────────────────────────── */

const CARD_RENDERERS: ReadonlyArray<(active: boolean) => ReactNode> = [
  (active) => <UrlCardContent active={active} />,
  (active) => <IntelCardContent active={active} />,
  (active) => <InterviewCardContent active={active} />,
  (active) => <ScoreCardContent active={active} />,
];

/**
 * Reduced-motion fallback: shows the final-phase composition (scorecard on top,
 * previous cards stacked behind), no animation. Preserves the product narrative.
 */
function StaticStack() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl" aria-hidden>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.22),transparent_70%)] blur-2xl"
      />
      {CARD_RENDERERS.map((render, cardIndex) => {
        const offset = TOTAL_CARDS - 1 - cardIndex;
        const clamped = Math.min(offset, STACK_PRESETS.length - 1);
        const preset = STACK_PRESETS[clamped];
        return (
          <div
            key={cardIndex}
            className="absolute inset-x-6 top-6 bottom-6"
            style={{
              transform: `translateY(${preset.y}px) scale(${preset.scale})`,
              opacity: preset.opacity,
              zIndex: 40 - clamped * 10,
            }}
          >
            {render(offset === 0)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Animated floating card stack for the landing hero.
 *
 * The component is self-contained: it owns its phase timer and all copy. Mount
 * it anywhere; it renders a fixed 4:3 box up to `max-w-xl` and is purely
 * decorative (`aria-hidden`).
 */
export function HeroProductDemo() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    let alive = true;
    let activeTimeoutId: number | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        activeTimeoutId = window.setTimeout(() => {
          activeTimeoutId = null;
          resolve();
        }, ms);
      });

    (async () => {
      while (alive) {
        for (let p = 0; p < TOTAL_CARDS; p++) {
          if (!alive) return;
          setPhase(p);
          await sleep(PHASE_DURATION_MS);
        }
        if (!alive) return;
        setFading(true);
        await sleep(CYCLE_FADE_MS);
        if (!alive) return;
        setPhase(0);
        setFading(false);
      }
    })();

    return () => {
      alive = false;
      if (activeTimeoutId !== null) {
        window.clearTimeout(activeTimeoutId);
      }
    };
  }, [reducedMotion]);

  if (reducedMotion) return <StaticStack />;

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl" aria-hidden>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.22),transparent_70%)] blur-2xl"
      />

      <motion.div
        animate={{ opacity: fading ? 0 : 1 }}
        transition={{ duration: 0.35 }}
        className="relative h-full w-full"
        style={{ perspective: "1400px" }}
      >
        {CARD_RENDERERS.map((render, cardIndex) => {
          const state = stateForCard(cardIndex, phase);
          return (
            <motion.div
              key={cardIndex}
              animate={state}
              transition={SPRING}
              className="absolute inset-x-6 top-6 bottom-6"
              style={{ zIndex: state.zIndex, willChange: "transform, opacity" }}
            >
              {render(phase === cardIndex)}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
