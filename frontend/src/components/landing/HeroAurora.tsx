/**
 * @fileoverview Hero-scoped "aurora" gradient layer.
 *
 * Paints a stack of radial gradients sized at 200% of the container and pans
 * their combined `background-position` via a pure-CSS keyframe
 * (`heroAurora` in index.css). No hue filter — earlier revisions had a
 * `heroHueBreathe` keyframe that rotated the hue +/-18deg every 48s, but
 * that rotation is what produced the "dark -> light washout" swing the
 * user flagged; deleted in favor of relying on position drift alone.
 *
 * Architecture choices:
 *   - Pure CSS (no JS per frame, no WebGL, no canvas) — the entire
 *     animation runs on the compositor, so the cost after initial paint is
 *     effectively zero. This was the key lesson from the InterviewGrid lag
 *     incident.
 *   - `mix-blend-mode: soft-light` (previously `screen`) — `screen` ADDS
 *     light, so layering the aurora's violet on top of the orbs' violet
 *     compounded to near-white. `soft-light` tints-and-darkens instead,
 *     which both prevents the washout AND gives the hero the slightly
 *     darker feel the user asked for.
 *   - Dark base tone in the gradient stack — a soft radial of near-black
 *     violet (rgba(15,10,35,0.35)) as the first stop sinks the hero
 *     ambient a step below the rest of the page.
 *   - Mounted INSIDE the hero wrapper, absolutely positioned with
 *     `-z-10`, so it paints only within the hero and costs zero below.
 *
 * Accessibility:
 *   - `aria-hidden` — the element carries no content; it is purely
 *     decorative.
 *   - `pointer-events-none` — never intercepts clicks.
 *   - `prefers-reduced-motion: reduce` is honored by the CSS keyframe
 *     gating (see the `@media` block in index.css); the gradient still
 *     paints statically so we do not lose the color atmosphere.
 *
 * @module components/landing/HeroAurora
 */

/**
 * Shared gradient stack. Kept as a single `background-image` so the browser
 * treats the whole stack as one paintable layer — animating the one
 * `background-position` then pans all gradients in lockstep, which creates
 * the "flowing mist" feel rather than layers crossing at different speeds.
 *
 * Colors intentionally echo the site-wide orb palette (violet, fuchsia,
 * cyan) at reduced alpha so the aurora reads as tint, not flood.
 * The first entry is a dark-violet sink that pulls the hero a notch below
 * the rest of the page ambient.
 */
const AURORA_BACKGROUND = [
  // Dark violet sink — paints first so later stops blend on top of it.
  // Pulls the hero background a step darker without touching the page.
  "radial-gradient(80% 70% at 50% 50%, rgba(15, 10, 35, 0.35) 0%, rgba(15, 10, 35, 0) 70%)",
  // Violet bloom, upper-left. Alpha dropped 0.55 -> 0.32 — combined with
  // the soft-light blend this reads as "subtle violet mist" rather than
  // "glowing purple fog".
  "radial-gradient(60% 55% at 25% 30%, rgba(139, 92, 246, 0.32) 0%, rgba(139, 92, 246, 0) 60%)",
  // Fuchsia bloom, upper-right. 0.45 -> 0.24.
  "radial-gradient(55% 50% at 75% 25%, rgba(217, 70, 239, 0.24) 0%, rgba(217, 70, 239, 0) 62%)",
  // Cyan bloom, lower-center. 0.35 -> 0.20.
  "radial-gradient(70% 60% at 50% 85%, rgba(34, 211, 238, 0.20) 0%, rgba(34, 211, 238, 0) 65%)",
].join(", ");

/**
 * Hero-scoped aurora. Must be rendered inside a `position: relative`
 * container (the hero wrapper already is).
 */
export function HeroAurora() {
  return (
    <div
      aria-hidden
      className="hero-aurora-drift pointer-events-none absolute inset-0 -z-10 opacity-45 mix-blend-soft-light dark:opacity-55"
      style={{
        backgroundImage: AURORA_BACKGROUND,
        backgroundSize: "200% 200%",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
