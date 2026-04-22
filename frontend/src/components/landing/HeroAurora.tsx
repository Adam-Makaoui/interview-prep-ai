/**
 * @fileoverview Hero-scoped cloud drift — strictly-dark palette, with
 * `mix-blend-mode: lighten` used as a MATHEMATICAL BRIGHTNESS CEILING.
 *
 * Why THIS approach after multiple failed iterations:
 *
 *   Every previous attempt (stacked radial gradients with `normal` or
 *   `soft-light` blend; feTurbulence + feColorMatrix) had the same
 *   failure mode: the hero read as a medium-purple wash. Root cause in
 *   each case was additive or averaging compositing — two partially-
 *   transparent violet layers blended to a pixel BRIGHTER than either
 *   individual stop, or noise averaged toward the matrix ceiling.
 *
 *   `mix-blend-mode: lighten` is categorically different: it is per-
 *   channel `max()`. The blended pixel's R is max(backdropR, sourceR),
 *   and similarly for G and B. This means the result CAN NEVER EXCEED
 *   the brighter single input on any channel. No combination of
 *   overlapping layers can produce a brighter pixel than the brightest
 *   stop color anywhere in the stack.
 *
 *   With this property, I can define the absolute brightness ceiling
 *   by the brightest stop color I use anywhere in the three gradients.
 *   If the brightest stop is rgb(52, 38, 92) — a DARK medium purple —
 *   that is the ABSOLUTE ceiling anywhere in the hero, guaranteed.
 *   Most of the hero will be the near-black base showing through the
 *   clouds' transparent outer rings.
 *
 * Palette (strict dark, per user):
 *   - Base: rgb(10, 8, 22) — nearly pitch black with a violet whisper.
 *   - Cloud A center: rgb(20, 14, 38) — dark purple. Barely brighter
 *     than the base, reads as "slightly-lighter shade of the same
 *     dark", which is what the user described.
 *   - Cloud B center: rgb(32, 22, 56) — a shade lighter. Still very
 *     dark — nowhere near "medium purple".
 *   - Accent center: rgb(52, 38, 92) — dark-medium purple. This is
 *     the ONE place in the hero that ever gets "slightly brighter"
 *     and it is intentionally small + partially transparent + brief.
 *     Crucially still WAY darker than the old rgb(139, 92, 246) that
 *     kept flashing "too bright".
 *
 * Motion:
 *   Three layers, each translated on its own keyframe (different
 *   period, different path). Drifts are slow (24s / 32s / 40s) so the
 *   motion reads as "clouds lazily shifting" — visible but not busy
 *   enough to compete with the text.
 *
 * Performance:
 *   Pure CSS, no SVG filters, no JS per frame. `transform: translate`
 *   animations composite on GPU. Cost after mount ~= a static <div>
 *   with a gradient background.
 *
 * @module components/landing/HeroAurora
 */

/**
 * Hero-scoped cloud drift. Must be rendered inside a `position: relative`
 * container (the hero wrapper already is).
 *
 * Architecture:
 *   - Root <div>: solid near-black base. This is the color the hero
 *     reads as when NO cloud overlaps (which is the majority of the
 *     surface at any moment).
 *   - Three sibling <div>s, each a single radial gradient, each with
 *     `mix-blend-mode: lighten` so overlap produces per-channel max
 *     (never addition). Animated via `transform: translate` + scale.
 */
export function HeroAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        // Absolute floor color of the hero. Anywhere no cloud is
        // overlapping, this is what paints. Keep very dark so the
        // hero feels like a deep-night sky, not a purple tint.
        backgroundColor: "rgb(10, 8, 22)",
      }}
    >
      {/* Cloud A — large dark-purple blob. Drifts slowly. */}
      <div
        className="hero-dark-cloud hero-dark-cloud-a"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 50%, rgb(20, 14, 38) 0%, rgba(20, 14, 38, 0) 70%)",
        }}
      />

      {/* Cloud B — mid dark-violet blob, drifts opposite to A. Slightly
          bigger center color to create visible "two shades of dark" feel. */}
      <div
        className="hero-dark-cloud hero-dark-cloud-b"
        style={{
          background:
            "radial-gradient(45% 40% at 50% 50%, rgb(32, 22, 56) 0%, rgba(32, 22, 56, 0) 68%)",
        }}
      />

      {/* Accent — a small, briefly-brighter-purple patch that drifts
          through a tight path at reduced opacity. This is the "tiny
          light-purple in a small amount, just appearing somewhere" the
          user asked for. rgb(52, 38, 92) is DARK-MEDIUM purple — any
          brighter and it trips the "too bright" trigger again. */}
      <div
        className="hero-dark-cloud hero-dark-cloud-accent"
        style={{
          background:
            "radial-gradient(25% 20% at 50% 50%, rgb(52, 38, 92) 0%, rgba(52, 38, 92, 0) 72%)",
        }}
      />
    </div>
  );
}
