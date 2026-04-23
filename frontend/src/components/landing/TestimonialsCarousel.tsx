/**
 * @fileoverview Testimonials carousel with three swappable presentation
 * variants, all sharing the same `TestimonialCard` and data list:
 *
 *   1. `marquee` (default) — continuous 2D horizontal strip. The list is
 *      rendered twice inline; a CSS keyframe translates the track from
 *      0 → -50% on a linear loop, so when the first half scrolls out of
 *      frame the second half is already flush where it was, creating a
 *      seamless loop with zero JS frame work.
 *
 *   2. `ring3d` — the earlier 3D ring powered by Framer Motion's
 *      `useAnimationFrame` + `useMotionValue`. Kept so we can A/B test
 *      the previous design against the new marquee.
 *
 *   3. `buttons` — explicit prev/next carousel. One card on `<lg`, a
 *      three-card window on `lg+`. Each card animates independently
 *      via `AnimatePresence` + `layout`, so pressing prev/next
 *      visually "pops" the leaving card while the remaining cards
 *      slide one slot along and the incoming card enters from the
 *      opposite edge.
 *
 * A parent `TestimonialsCarousel` chooses the active variant (default
 * `marquee`) and, in development builds only, renders a small pill-tab
 * switcher above the carousel for quick visual comparison. The dev
 * switcher is gated by `import.meta.env.DEV`, which Vite inlines as
 * `false` in production builds so the tree-shaker drops both the tab
 * UI and the unused variant components.
 *
 * Reduced motion: all three variants degrade to the same static grid so
 * motion-sensitive users see every quote at once, without animation.
 *
 * @module components/landing/TestimonialsCarousel
 */

import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Data ────────────────────────────────────────────────────────────── */

/**
 * Static list of customer quotes shown in every variant of the
 * testimonials carousel. Quote-only copy (no images) keeps the card
 * cheap to render and avoids layout shift while the marquee loops.
 */
export const LANDING_CUSTOMER_TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Senior SE at Salesforce",
    initials: "SK",
    color:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
    quote:
      "I used this for my Stripe final round. The job description analysis caught gaps I would have never addressed. Got the offer.",
  },
  {
    name: "Marcus T.",
    role: "Solutions Architect",
    initials: "MT",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    quote:
      "The role-play felt surprisingly real. The feedback after each answer was more useful than any mock interview I've done with friends.",
  },
  {
    name: "Priya R.",
    role: "Pre-Sales Engineer at AWS",
    initials: "PR",
    color:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    quote:
      "Went from generic prep to role-specific, interviewer-aware prep. The STAR frameworks saved me hours of writing.",
  },
  {
    name: "Jordan L.",
    role: "Staff Engineer at Datadog",
    initials: "JL",
    color:
      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
    quote:
      "I ran three back-to-back loop preps in one weekend. The scorecard showed exactly where I was slipping — nailed every behavioral the following Monday.",
  },
  {
    name: "Elena V.",
    role: "Engineering Manager at Figma",
    initials: "EV",
    color:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
    quote:
      "I was skeptical until I saw the gap analysis on my first job posting. It flagged two skills I'd completely overlooked. Prep time cut in half.",
  },
] as const;

/** Element type of {@link LANDING_CUSTOMER_TESTIMONIALS}. */
export type LandingTestimonial = (typeof LANDING_CUSTOMER_TESTIMONIALS)[number];

/* ── Shared card ─────────────────────────────────────────────────────── */

/**
 * Presentational-only card used by every variant. Holding this in one
 * place keeps the three variants visually identical — swapping the
 * motion model should not change how a single quote looks.
 */
export function TestimonialCard({
  testimonial,
  className = "",
}: {
  testimonial: LandingTestimonial;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/55 bg-white/70 p-5 shadow-lg shadow-violet-200/20 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/50 dark:shadow-black/25 ${className}`}
    >
      <p className="mb-4 text-sm italic leading-relaxed text-gray-700 dark:text-gray-300">
        &quot;{testimonial.quote}&quot;
      </p>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${testimonial.color}`}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {testimonial.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {testimonial.role}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Shared reduced-motion fallback ──────────────────────────────────── */

/**
 * Static, motion-free grid of every quote. Used as the reduced-motion
 * fallback for all three variants so users who disable animation always
 * see the full social-proof list at once (no hidden carousel steps).
 */
function ReducedMotionGrid() {
  return (
    <div
      className="mx-auto max-w-6xl px-4"
      role="region"
      aria-label="Customer testimonials"
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LANDING_CUSTOMER_TESTIMONIALS.map((t) => (
          <TestimonialCard key={t.name} testimonial={t} />
        ))}
      </div>
    </div>
  );
}

/* ── Variant 1: 2D continuous marquee ────────────────────────────────── */

/**
 * 2D continuous marquee. The list is rendered inline twice and the
 * track is animated via a CSS keyframe from `translateX(0)` to
 * `translateX(-50%)`. Because the second half is identical to the
 * first, by the time the animation hits 100% the visible frame is
 * showing the same cards it showed at 0% — no visible jump.
 *
 * Animation lives in `index.css` (`.testimonials-marquee-track`) so
 * the compositor runs it entirely off the main thread. Hovering any
 * card pauses the animation (also via CSS); focus-within does the
 * same for keyboard users navigating into a card link in the future.
 */
function TestimonialsMarqueeVariant() {
  // Minimum card width (in rem). Matches `.min-w-[22rem]` so we don't
  // double-declare the magic number: if we ever bump this, update the
  // className on the card wrapper too.
  const items = LANDING_CUSTOMER_TESTIMONIALS;
  return (
    <div
      className="testimonials-marquee relative w-full overflow-hidden"
      role="region"
      aria-roledescription="marquee"
      aria-label="Customer testimonials"
      // Mask fades the left/right edges into the section background so
      // cards enter/exit the viewport gracefully instead of popping
      // against the hard container edge.
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)",
      }}
    >
      <div className="testimonials-marquee-track flex w-max gap-5 px-4 py-1">
        {/* First copy — the one screen readers announce. */}
        {items.map((t) => (
          <div
            key={`a-${t.name}`}
            className="w-[22rem] min-w-[22rem] shrink-0"
          >
            <TestimonialCard testimonial={t} />
          </div>
        ))}
        {/* Second copy — visually identical, hidden from assistive tech
            so a screen reader does not read every quote twice. */}
        {items.map((t) => (
          <div
            key={`b-${t.name}`}
            className="w-[22rem] min-w-[22rem] shrink-0"
            aria-hidden="true"
          >
            <TestimonialCard testimonial={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Variant 2: 3D ring ──────────────────────────────────────────────── */

/**
 * Restored Framer-Motion 3D ring. Cards are laid out around a
 * horizontal circle by chaining `rotateY(i * step) translateZ(radius)`.
 * A `useMotionValue` holds the ring's rotation and `useAnimationFrame`
 * advances it ~9°/s while no card is hovered. On viewports < 640px we
 * swap to a horizontal scroll-snap track because the ring becomes
 * illegible at that radius.
 */
function TestimonialsRing3DVariant() {
  const cardCount = LANDING_CUSTOMER_TESTIMONIALS.length;
  const anglePerCardDeg = 360 / cardCount;
  const [radiusPx, setRadiusPx] = useState(520);
  const [isMobile, setIsMobile] = useState(false);
  const rotateY = useMotionValue(0);
  const pausedRef = useRef(false);
  const cardHoverDepthRef = useRef(0);

  useEffect(() => {
    const syncRadius = () => {
      const w = window.innerWidth;
      setIsMobile(w < 640);
      if (w < 480) setRadiusPx(200);
      else if (w < 640) setRadiusPx(260);
      else if (w < 900) setRadiusPx(360);
      else if (w < 1100) setRadiusPx(440);
      else setRadiusPx(520);
    };
    syncRadius();
    window.addEventListener("resize", syncRadius);
    return () => window.removeEventListener("resize", syncRadius);
  }, []);

  const onCardPointerEnter = useCallback(() => {
    cardHoverDepthRef.current += 1;
    pausedRef.current = true;
  }, []);

  const onCardPointerLeave = useCallback(() => {
    cardHoverDepthRef.current = Math.max(0, cardHoverDepthRef.current - 1);
    pausedRef.current = cardHoverDepthRef.current > 0;
  }, []);

  // Framer's `useAnimationFrame` hands us `delta` in **ms**, so we
  // compute degrees-per-ms. 40_000ms = 40s per full revolution.
  useAnimationFrame((_t, delta) => {
    if (pausedRef.current) return;
    const degPerMs = 360 / (40 * 1000);
    rotateY.set((rotateY.get() - degPerMs * delta) % 360);
  });

  if (isMobile) {
    return (
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label="Customer testimonials"
      >
        {LANDING_CUSTOMER_TESTIMONIALS.map((testimonial) => (
          <div
            key={testimonial.name}
            className="w-[85vw] max-w-[22rem] shrink-0 snap-center"
          >
            <TestimonialCard testimonial={testimonial} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none mx-auto w-full max-w-none px-2 sm:px-4"
      role="region"
      aria-label="Customer testimonials"
    >
      <div
        className="relative mx-auto h-[min(520px,64vh)] overflow-visible"
        style={{ perspective: "3200px" }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Slight rotateX tilt keeps the ring readable; strong
              perspective flattens the side-facing cards. */}
          <div
            className="[transform-style:preserve-3d]"
            style={{ transform: "rotateX(-4deg)" }}
          >
            <motion.div
              className="h-0 w-0 [transform-style:preserve-3d]"
              style={{ rotateY }}
            >
              {LANDING_CUSTOMER_TESTIMONIALS.map((testimonial, cardIndex) => (
                <div
                  key={testimonial.name}
                  className="pointer-events-auto absolute left-0 top-0 w-[min(18rem,calc(100vw-2.5rem))] [backface-visibility:hidden] [transform-style:preserve-3d]"
                  style={{
                    transform: `rotateY(${cardIndex * anglePerCardDeg}deg) translateZ(${radiusPx}px) translate(-50%, -50%)`,
                  }}
                  onPointerEnter={onCardPointerEnter}
                  onPointerLeave={onCardPointerLeave}
                >
                  <TestimonialCard testimonial={testimonial} />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Variant 3: explicit prev/next queue ─────────────────────────────── */

/**
 * Shared button styling for both nav arrows. Breakpoints keep it
 * 44px-tall on mobile (iOS touch target) and align with the card
 * block on desktop.
 */
const NAV_BTN_CLASS =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300/90 bg-white/90 text-gray-800 shadow-sm transition hover:border-violet-400/70 hover:bg-white hover:text-violet-700 active:scale-[0.97] dark:border-white/15 dark:bg-gray-950/80 dark:text-gray-100 dark:hover:border-violet-500/45 dark:hover:bg-gray-950 dark:hover:text-violet-200";

/**
 * Number of visible cards on large screens. Mobile (< `lg`) always
 * shows a single card at a time so touch users aren't scanning three
 * quotes in a narrow viewport.
 */
const DESKTOP_WINDOW = 3;

/**
 * Motion `variants` objects for the buttons variant. We use the
 * variants-with-`custom` pattern (instead of inline `initial={fn}`)
 * because Framer's TypeScript types only accept function-form targets
 * via the `variants` prop — inline functions are rejected by the
 * stricter 12.x typings. The `custom` prop is threaded through
 * `AnimatePresence` + each `motion.div` so every enter/exit flips
 * sign based on the most recent nav direction.
 */
const MOBILE_CARD_VARIANTS = {
  enter: (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ? -28 : 28 }),
};

const DESKTOP_CARD_VARIANTS = {
  enter: (dir: 1 | -1) => ({
    opacity: 0,
    x: dir === 1 ? 36 : -36,
    scale: 0.96,
  }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: 1 | -1) => ({
    opacity: 0,
    x: dir === 1 ? -36 : 36,
    scale: 0.96,
  }),
};

/**
 * Explicit prev/next carousel. The key move is animating cards
 * INDIVIDUALLY (each wrapped in its own `<motion.div>` keyed by the
 * testimonial name). When `index` advances:
 *   - the card whose name is no longer in the visible window gets
 *     removed from the React tree → `exit` animation fires (pop out).
 *   - surviving cards stay mounted and use `layout` animation to
 *     slide into their new slot.
 *   - the newly-included card mounts in its new slot → `initial`
 *     animation fires (slide in from the far side).
 *
 * This mirrors the "A pops, B C D slide forward" model the user asked
 * for, rather than the old "entire row fades in/out" behaviour.
 */
function TestimonialsButtonsVariant() {
  const items = LANDING_CUSTOMER_TESTIMONIALS;
  const n = items.length;
  const [index, setIndex] = useState(0);
  // Tracks which direction the last nav moved so we can mirror the
  // enter/exit animations (pressing back should make cards SLIDE RIGHT,
  // and vice-versa). +1 = forward, -1 = backward.
  const [direction, setDirection] = useState<1 | -1>(1);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);
  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((i) => (i + 1) % n);
  }, [n]);

  // Desktop visible window: N consecutive items starting at `index`,
  // wrapping around the end of the list.
  const desktopVisible = Array.from({ length: DESKTOP_WINDOW }, (_, slot) =>
    items[(index + slot) % n],
  );

  return (
    <div
      className="mx-auto max-w-6xl px-4"
      role="region"
      aria-label="Customer testimonials"
    >
      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-5">
        <button
          type="button"
          className={`${NAV_BTN_CLASS} order-2 mx-auto lg:order-none lg:mt-28`}
          onClick={goPrev}
          aria-label="Previous testimonials"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div
          className="order-1 min-w-0 flex-1 lg:order-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Mobile: one card at a time. Still uses per-card key +
              AnimatePresence so the transition mirrors the desktop
              feel (old card slides off, new slides in). */}
          <div className="lg:hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={items[index].name}
                custom={direction}
                variants={MOBILE_CARD_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: "easeOut" }}
              >
                <TestimonialCard testimonial={items[index]} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop: three-card window with per-card layout animation.
              Because each card is keyed by name, React keeps surviving
              cards mounted and only tears down the one leaving the
              window — that's what produces the "pop + shift forward"
              feel. */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-3 gap-5">
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                {desktopVisible.map((t) => (
                  <motion.div
                    key={t.name}
                    layout
                    custom={direction}
                    variants={DESKTOP_CARD_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 0.61, 0.36, 1],
                    }}
                  >
                    <TestimonialCard testimonial={t} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`${NAV_BTN_CLASS} order-3 mx-auto lg:order-none lg:mt-28`}
          onClick={goNext}
          aria-label="Next testimonials"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Public parent + dev-only variant switcher ───────────────────────── */

/** Variant identifiers exposed via the `variant` prop. */
export type TestimonialsVariant = "marquee" | "ring3d" | "buttons";

const VARIANT_LABELS: Record<TestimonialsVariant, string> = {
  marquee: "Marquee",
  ring3d: "3D ring",
  buttons: "Buttons",
};

/**
 * Top-level carousel. Picks one of three variants and, on dev builds
 * only, renders a small tab strip that lets you toggle between them
 * for quick visual comparison. Reduced-motion users always get the
 * static grid.
 */
export function TestimonialsCarousel({
  reducedMotion,
  variant = "marquee",
}: {
  reducedMotion: boolean;
  variant?: TestimonialsVariant;
}) {
  const [active, setActive] = useState<TestimonialsVariant>(variant);

  // Keep `active` in sync if the caller ever flips the prop at runtime
  // (e.g. future feature-flag). Dev tabs still override locally.
  useEffect(() => {
    setActive(variant);
  }, [variant]);

  if (reducedMotion) {
    return <ReducedMotionGrid />;
  }

  // `import.meta.env.DEV` is a Vite-defined constant that is replaced
  // with `true` in `vite dev` and `false` in `vite build`. Any branch
  // guarded by it is dead code in production and dropped by esbuild's
  // minifier — so the dev switcher adds zero bytes to prod bundles.
  const showDevTabs = import.meta.env.DEV;

  return (
    <div className="flex flex-col gap-6">
      {showDevTabs ? (
        <div className="mx-auto flex gap-1 rounded-full border border-violet-500/20 bg-white/70 p-1 text-xs font-medium text-gray-700 backdrop-blur dark:bg-gray-950/60 dark:text-gray-300">
          {(Object.keys(VARIANT_LABELS) as TestimonialsVariant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActive(v)}
              className={`rounded-full px-3 py-1.5 transition ${
                active === v
                  ? "bg-violet-600 text-white shadow-sm"
                  : "hover:text-violet-600 dark:hover:text-violet-300"
              }`}
              aria-pressed={active === v}
            >
              {VARIANT_LABELS[v]}
            </button>
          ))}
        </div>
      ) : null}

      {active === "marquee" ? <TestimonialsMarqueeVariant /> : null}
      {active === "ring3d" ? <TestimonialsRing3DVariant /> : null}
      {active === "buttons" ? <TestimonialsButtonsVariant /> : null}
    </div>
  );
}

export default TestimonialsCarousel;
