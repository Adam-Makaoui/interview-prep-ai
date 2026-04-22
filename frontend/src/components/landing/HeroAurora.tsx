/**
 * @fileoverview Hero-scoped "aurora" gradient layer.
 *
 * Paints three overlapping radial gradients sized at 200% of the container
 * and pans their combined `background-position` via a pure-CSS keyframe
 * (`heroAurora` in index.css). A second keyframe (`heroHueBreathe`) shifts
 * the hue a few degrees over ~48s so the colors slowly evolve without ever
 * looking like an abrupt swap.
 *
 * Architecture choices:
 *   - Pure CSS (no JS per frame, no WebGL, no canvas) — the entire animation
 *     runs on the compositor, so the cost after initial paint is effectively
 *     zero. This was the key lesson from the InterviewGrid lag incident.
 *   - `mix-blend-mode: screen` layers the aurora ON TOP of the site-wide
 *     orbs (in LandingAtmosphere) without covering them — the orbs still
 *     read through as luminous "cloud masses", and the aurora adds a
 *     moving tint across the whole hero viewport.
 *   - Mounted INSIDE the hero <section>, absolutely positioned with
 *     `-z-10`, so it paints only within the hero's bounding box and costs
 *     zero for every section below.
 *
 * Accessibility:
 *   - `aria-hidden` — the element carries no content; it is purely
 *     decorative.
 *   - `pointer-events-none` — never intercepts clicks.
 *   - `prefers-reduced-motion: reduce` is honored by the CSS keyframe
 *     gating (see the `@media` block in index.css); the gradient still
 *     paints statically so we do not lose the color atmosphere, we just
 *     stop the drift.
 *
 * @module components/landing/HeroAurora
 */

/**
 * Shared gradient stack. Kept as a single `background-image` so the browser
 * treats the whole stack as one paintable layer — animating the one
 * `background-position` then pans all three gradients in lockstep, which is
 * what creates the "soft flowing mist" feel rather than three gradients
 * crossing each other at different speeds.
 *
 * Colors intentionally echo the site-wide orb palette (violet, fuchsia,
 * indigo, cyan) so the aurora feels native to the page, not a separate
 * effect.
 */
const AURORA_BACKGROUND = [
  // Violet bloom, upper-left
  "radial-gradient(60% 55% at 25% 30%, rgba(139, 92, 246, 0.55) 0%, rgba(139, 92, 246, 0) 60%)",
  // Fuchsia bloom, upper-right
  "radial-gradient(55% 50% at 75% 25%, rgba(217, 70, 239, 0.45) 0%, rgba(217, 70, 239, 0) 62%)",
  // Cyan bloom, lower-center
  "radial-gradient(70% 60% at 50% 85%, rgba(34, 211, 238, 0.35) 0%, rgba(34, 211, 238, 0) 65%)",
].join(", ");

/**
 * Hero-scoped aurora. Must be rendered inside a `position: relative`
 * container (the hero `<section>` already is).
 */
export function HeroAurora() {
  return (
    <div
      aria-hidden
      className="hero-aurora-drift pointer-events-none absolute inset-0 -z-10 mix-blend-screen opacity-60 dark:opacity-70"
      style={{
        backgroundImage: AURORA_BACKGROUND,
        backgroundSize: "200% 200%",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
