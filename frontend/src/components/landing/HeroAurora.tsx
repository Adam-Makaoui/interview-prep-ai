/**
 * @fileoverview Hero-scoped "aurora" — two stacked gradient layers panning
 * in opposing directions at different cycle lengths. The two-layer setup is
 * what gives the hero its cloud-morph feel: a single translating gradient
 * only pans, but TWO layers moving counter to each other with different
 * periods constantly overlap and diverge, so what you see is the
 * silhouette of the clouds actually changing shape, not just sliding.
 *
 * Palette (2026-04-19): strict dark violet → medium purple only. Earlier
 * revisions used violet + fuchsia + cyan stops, which under `mix-blend-mode:
 * soft-light` produced occasional pink/teal flashes that read too bright
 * during drift. User asked for "nothing lighter than medium purple" — so
 * we now mix:
 *   - A near-black indigo sink (deepest).
 *   - A dark violet mid-tone (rgb 94, 60, 180 — ~hsl(257, 50%, 47%)).
 *   - A medium purple highlight (rgb 139, 92, 246 — the brand violet, the
 *     cap on how light the aurora ever gets).
 *
 * Architecture:
 *   - Pure CSS. Two `<div>`s, each with its own `background-image` +
 *     `background-position` keyframe, composite on GPU.
 *   - No `mix-blend-mode`. An earlier pass used `soft-light` to prevent
 *     washout, but on the near-black dark-mode hero `soft-light` has
 *     almost zero effect (it darkens below 50% brightness, and the hero
 *     is well below 50%) — the aurora became invisible. We now paint the
 *     gradients directly with `normal` blend; the mid-alpha stops give the
 *     "dark purple clouds on darker background" reading without the washout
 *     `screen` would have caused.
 *   - `-z-10`, `pointer-events-none`, `aria-hidden`: decorative, invisible
 *     to the accessibility tree, never intercepts clicks.
 *   - `prefers-reduced-motion: reduce` freezes both layers (keyframes gated
 *     in index.css) — gradients still paint, they just don't pan.
 *
 * Performance:
 *   - Two composited layers. `background-position` is one of the cheapest
 *     things a browser can animate — no repaint on intermediate frames.
 *   - Zero JS per frame. Zero Canvas/WebGL. Effectively free after mount.
 *
 * @module components/landing/HeroAurora
 */

/**
 * Primary aurora layer — violet-dominant, 200% sized so the keyframe has
 * room to pan across the hero. Kept as one `background-image` so the
 * browser paints all stops as a single texture.
 *
 * Order of stops matters: deepest sink first, brand-violet highlight
 * last, so later stops blend on top of earlier ones.
 */
const AURORA_BACKGROUND_PRIMARY = [
  // Deepest indigo sink — pulls hero ambient a step below page.
  "radial-gradient(85% 75% at 50% 50%, rgba(17, 12, 40, 0.55) 0%, rgba(17, 12, 40, 0) 70%)",
  // Dark violet bloom, upper-left. Mid-saturation, mid-darkness.
  "radial-gradient(65% 60% at 25% 30%, rgba(94, 60, 180, 0.55) 0%, rgba(94, 60, 180, 0) 62%)",
  // Medium-purple highlight, upper-right. This is the LIGHTEST color in
  // the stack — no stop is any lighter than this per user direction.
  "radial-gradient(55% 50% at 75% 25%, rgba(139, 92, 246, 0.42) 0%, rgba(139, 92, 246, 0) 62%)",
  // Dark violet bloom, lower-center. Mirrors the upper-left tone so the
  // hero has two "cloud centers" drifting in and out.
  "radial-gradient(70% 60% at 50% 85%, rgba(76, 50, 160, 0.40) 0%, rgba(76, 50, 160, 0) 65%)",
].join(", ");

/**
 * Secondary aurora layer — a mirror-ish composition of the primary with
 * the stops shifted to different anchor points. Panned on its own keyframe
 * in the OPPOSITE direction and at a different cycle length than the
 * primary, so their overlap area constantly changes shape. This is what
 * creates the "clouds morphing" effect vs. just sliding.
 *
 * Intentionally lower-alpha than the primary so it colors the interaction
 * without doubling the brightness.
 */
const AURORA_BACKGROUND_SECONDARY = [
  // Darker violet bloom, upper-right (mirror of primary's upper-left).
  "radial-gradient(60% 55% at 78% 35%, rgba(80, 50, 160, 0.40) 0%, rgba(80, 50, 160, 0) 65%)",
  // Medium-purple highlight, lower-left (mirror of primary's upper-right).
  "radial-gradient(50% 45% at 20% 75%, rgba(139, 92, 246, 0.34) 0%, rgba(139, 92, 246, 0) 62%)",
  // Dark indigo bloom, center-low.
  "radial-gradient(70% 55% at 55% 60%, rgba(55, 35, 130, 0.34) 0%, rgba(55, 35, 130, 0) 68%)",
].join(", ");

/**
 * Hero-scoped aurora. Must be rendered inside a `position: relative`
 * container (the hero wrapper already is).
 *
 * Two sibling <div>s: `hero-aurora-primary` animates its position
 * clockwise-ish, `hero-aurora-secondary` animates counter-clockwise at a
 * different period. They composite together via soft-light.
 */
export function HeroAurora() {
  return (
    <>
      <div
        aria-hidden
        className="hero-aurora-primary pointer-events-none absolute inset-0 -z-10 opacity-80 dark:opacity-95"
        style={{
          backgroundImage: AURORA_BACKGROUND_PRIMARY,
          backgroundSize: "220% 220%",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden
        className="hero-aurora-secondary pointer-events-none absolute inset-0 -z-10 opacity-65 dark:opacity-80"
        style={{
          backgroundImage: AURORA_BACKGROUND_SECONDARY,
          backgroundSize: "200% 200%",
          backgroundRepeat: "no-repeat",
        }}
      />
    </>
  );
}
