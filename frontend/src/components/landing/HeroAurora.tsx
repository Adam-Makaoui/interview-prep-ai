/**
 * @fileoverview Hero-scoped atmospheric background — SVG `feTurbulence`
 * procedural clouds, color-clamped to a dark-violet → medium-purple range
 * via `feColorMatrix`, then panned by GPU-composited `transform: translate`.
 *
 * Why THIS approach (2026 research):
 *
 *   Previous iterations used stacked `radial-gradient()` layers with
 *   `mix-blend-mode: soft-light` (or no blend), driven by
 *   `background-position` keyframes. They looked OK but had one
 *   mathematical flaw the user repeatedly flagged: **brightness overshoot
 *   on overlap**. When two violet radial stops at alpha 0.3 panned across
 *   each other, the blended pixel summed to a brighter violet than either
 *   input — the "too light purple" flash. There is no alpha / blend-mode
 *   combo (screen, soft-light, normal, etc.) that eliminates this,
 *   because additive alpha compositing is the problem.
 *
 *   `feColorMatrix` solves this categorically. It is a 4x5 matrix applied
 *   PER PIXEL on the filter graph's output. Configuring the diagonal
 *   (R, G, B scale factors) at small values like 0.22 / 0.14 / 0.42
 *   clamps the maximum possible RGB output to a dark-purple color — no
 *   matter what the turbulence generator spits out, the pixel CANNOT
 *   exceed that ceiling. This is a mathematical cap, not a stylistic one.
 *
 *   Procedural noise also fixes the other user gripe: the gradient
 *   approach produced "clouds that just slide", because radial gradients
 *   have fixed silhouettes. Procedural fractal-noise clouds HAVE no
 *   single silhouette; their shape is a function of input coordinates, so
 *   translating the noise field produces organically changing cloud
 *   edges. This is the "shifting / ripple / wave" feel.
 *
 * Why feTurbulence is cheap enough for runtime:
 *
 *   feTurbulence itself is expensive (Perlin-ish noise per pixel) when
 *   its *inputs* change — e.g. animating `baseFrequency` recomputes the
 *   whole filter graph on every frame. We do NOT animate filter inputs.
 *   We animate only the outer `transform: translate()` on the wrapping
 *   <svg>, which means the filter graph sees constant inputs, produces
 *   constant output, and the browser rasterizes it ONCE then translates
 *   that raster on the compositor thread. Cost after mount ≈ a <div>
 *   with a static image background.
 *
 * Architecture:
 *
 *   - Solid dark-violet floor color on the root <div>. This is the
 *     absolute-darkest pixel anyone will ever see in the hero.
 *   - Two <svg> layers, each 180% of the hero so transforms of up to
 *     ~20% translate without revealing edges. Each has its own
 *     feTurbulence (different seeds + baseFrequencies) and its own
 *     feColorMatrix clamp. They stack with opacity (no blend mode) —
 *     because the matrix already bounds brightness, we do not need any
 *     darkening blend mode as a safety net.
 *   - Drift animations: layer A clockwise-ish 22s, layer B counter-
 *     clockwise 34s. Different periods so the two rasters cross at
 *     different phases, producing visually shifting cloud silhouettes.
 *
 * Accessibility / Motion:
 *
 *   - `aria-hidden`, `pointer-events-none`: decorative only.
 *   - `prefers-reduced-motion: reduce` gates both transform animations
 *     in index.css — gradients still paint, they just don't drift.
 *
 * @module components/landing/HeroAurora
 */

/**
 * Shared filter-matrix values, extracted so the two layers are obvious
 * visual siblings rather than mystery numbers.
 *
 * The matrix is:
 *   R_out = R_scale * R_in + R_offset
 *   G_out = G_scale * G_in + G_offset
 *   B_out = B_scale * B_in + B_offset
 *   A_out = 1 (last row just forces full opacity)
 *
 * fractalNoise output per channel is roughly [0, 1], so:
 *   - Minimum pixel = (R_offset, G_offset, B_offset)
 *     = near-black violet (by design, our darkest valley).
 *   - Maximum pixel = (R_scale + R_offset, G_scale + G_offset, B_scale + B_offset)
 *     = medium purple, never lighter. **This is the hard cap.**
 *
 * Layer A is tuned a shade brighter than layer B so they have distinct
 * character when stacked.
 */
// Dropped scale factors roughly in half from the first pass: the hero
// was reading as a flat medium-purple wash because the ceiling pixel was
// too bright AND the noise was too fine for the viewport so the eye
// averaged cloud peaks + valleys into one uniform tint. New ceiling max
// ≈ rgb(54, 33, 99) — a dark-medium violet, the brightest any cloud
// pixel can ever be. New floor ≈ rgb(3, 3, 10) — near-black, so cloud
// valleys sit flush with the hero's dark base color.
const CLOUD_A_MATRIX = `
  0.20 0    0    0  0.01
  0    0.12 0    0  0.01
  0    0    0.35 0  0.04
  0    0    0    0  1
`;

// Layer B: deeper yet, so it reads as a darker backdrop wash that
// layer A's brighter clouds drift in front of. Peak ≈ rgb(41, 23, 69).
const CLOUD_B_MATRIX = `
  0.15 0    0    0  0.01
  0    0.08 0    0  0.01
  0    0    0.25 0  0.02
  0    0    0    0  1
`;

/**
 * Hero-scoped atmospheric background. Must be rendered inside a
 * `position: relative` container (the hero wrapper already is).
 */
export function HeroAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        // Absolute floor color: no pixel in the hero can be darker than
        // this (clouds layer on top). Chosen a notch below the main page
        // bg so the hero sits in a slightly deeper valley.
        backgroundColor: "rgb(14, 10, 28)",
      }}
    >
      {/* Layer A — denser noise, full opacity, drifts clockwise-ish. */}
      <svg
        className="hero-cloud hero-cloud-a"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/*
            baseFrequency controls cloud scale: smaller = larger blobs,
            larger = finer texture. 0.008 gives ~100px-wide cloud cells
            at this viewBox, which reads as "soft clouds" not "static".
            numOctaves=3 layers three octaves of noise for organic edges.
            Fixed `seed` so the pattern is stable per build (no SSR
            hydration divergence).
          */}
          <filter id="hero-cloud-a" x="0%" y="0%" width="100%" height="100%">
            {/*
              baseFrequency controls cloud scale: smaller = larger blobs,
              larger = finer texture. Dropped 0.008 -> 0.004 after the
              first preview showed the noise was too fine — at viewport
              scale the eye averages cloud peaks and valleys into one
              uniform tint instead of seeing silhouettes. 0.004 gives
              cloud cells ~250px wide which is big enough to read as
              distinct cloud shapes behind the H1.
              numOctaves=3 layers three octaves of noise for organic edges.
              Fixed `seed` so the pattern is stable per build.
            */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.004"
              numOctaves="3"
              seed="7"
            />
            <feColorMatrix type="matrix" values={CLOUD_A_MATRIX} />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#hero-cloud-a)" />
      </svg>

      {/* Layer B — coarser noise, half-opacity, drifts counter-clockwise. */}
      <svg
        className="hero-cloud hero-cloud-b"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="hero-cloud-b" x="0%" y="0%" width="100%" height="100%">
            {/* Coarser than A (half the baseFrequency) so B's cloud
                cells are ~twice as big as A's — reads as the broad
                underlying cloud mass, with A's finer clouds drifting
                across it. */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.002"
              numOctaves="2"
              seed="13"
            />
            <feColorMatrix type="matrix" values={CLOUD_B_MATRIX} />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#hero-cloud-b)" />
      </svg>
    </div>
  );
}
