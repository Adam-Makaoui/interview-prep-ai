/**
 * @fileoverview Ghost-scanner mascot — a giant, very faint, rebuilt-in-SVG
 * version of the brand eye that lives behind the hero content and
 * "scans" via pulsing signal arcs, a tracking iris, and a radiating
 * ping ring.
 *
 * Why rebuild the brand eye in SVG instead of reusing <BrandMark/>:
 *   BrandMark is a cropped PNG bitmap. You cannot animate pixels
 *   inside a raster — individual arcs can't pulse, the iris can't
 *   scan. We need primitive-level control, so we reconstruct the eye
 *   shape with SVG primitives that share the logo's visual DNA
 *   (3 signal arcs + almond-shaped eye + circular iris + pupil).
 *
 * Design intent — why this is "sticky" and not gimmicky:
 *   The sharp BrandMark orb (80px, rendered on top of the H1) sits
 *   vertically near where this mascot's IRIS is drawn. At the mascot's
 *   default size and opacity, a viewer's peripheral vision picks up a
 *   huge ghost of the same shape the orb is — registering as "the
 *   system is actively scanning / looking" without pulling attention
 *   off the copy. The orb effectively reads as the pupil of the giant
 *   ambient scanner. That's the sticky moment.
 *
 * Animation breakdown (each on its own CSS keyframe, composited on GPU):
 *   1. Three signal arcs above the eye pulse opacity + translate up,
 *      staggered by 0.6s so they read as "signals emanating outward"
 *      rather than all breathing together.
 *   2. Iris rotates a fixed tiny translate range (±6px) over ~5s so it
 *      reads as "scanning left-to-right-to-left" like a security eye.
 *   3. Ping ring expands (scale + opacity-fade) from the pupil every
 *      4s, radiating a detection pulse.
 *   4. Whole container pulses opacity 0.10 ↔ 0.18 over a long cycle so
 *      the mascot "breathes" rather than sitting at a static brightness.
 *
 * Color: single rgb(139, 92, 246) — the brand violet — at very low
 * base opacities (0.28 on arcs, 0.30 on eye outline, 0.42 on iris
 * stroke). These are then multiplied by the container-level opacity
 * (~0.14 default), so the brightest rendered pixel anywhere inside
 * the mascot is approximately 0.42 * 0.14 = 0.059 — roughly 6% alpha.
 * That guarantees the mascot is a GHOST, not a character.
 *
 * Performance: one SVG element with 7 primitives and 5 keyframed
 * properties. Cost post-mount is effectively a static <svg> plus the
 * compositor's work on transform/opacity, which runs off-main-thread.
 *
 * @module components/landing/HeroMascot
 */

const STROKE = "rgb(139, 92, 246)"; // brand violet (same as <BrandMark/> hue family)

/**
 * Giant ambient scanner rendered inside the hero. Must be placed inside
 * the hero's `relative overflow-hidden` wrapper. Sized via CSS (560px on
 * desktop, 380px on mobile — see index.css `.hero-mascot`) and centered
 * behind the hero content at a low z-index.
 */
export function HeroMascot() {
  return (
    <div
      aria-hidden
      // Positioning is centralised in `.hero-mascot` (see index.css). The
      // hero wrapper is very tall (contains the product-demo band), so
      // percentage-based `top` values would push the mascot far below
      // the fold. We instead anchor to a fixed negative `top` tuned to
      // align the mascot's iris (at 65% of its rendered height) roughly
      // with the H1 centre — which is what produces the "brand orb as
      // scanner pupil" peripheral read.
      className="hero-mascot pointer-events-none absolute left-1/2 -z-20 -translate-x-1/2"
    >
      <svg
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        // Tell the compositor to promote this element to its own layer;
        // pairs well with the transform animations inside.
        style={{ willChange: "opacity" }}
      >
        {/* Signal arcs — three concentric "wave" curves above the eye,
            matching the logo's stacked radio-signal motif. Stagger is
            applied via className-scoped animation-delay in index.css. */}
        <g className="hero-mascot-arcs">
          <path
            className="hero-mascot-arc hero-mascot-arc-1"
            d="M 128 150 Q 200 96 272 150"
            fill="none"
            stroke={STROKE}
            strokeOpacity={0.28}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            className="hero-mascot-arc hero-mascot-arc-2"
            d="M 108 180 Q 200 108 292 180"
            fill="none"
            stroke={STROKE}
            strokeOpacity={0.28}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            className="hero-mascot-arc hero-mascot-arc-3"
            d="M 90 208 Q 200 122 310 208"
            fill="none"
            stroke={STROKE}
            strokeOpacity={0.28}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </g>

        {/* Eye: almond/lens outline. Two mirrored quadratic curves form
            the classic eye shape. Stroke-only so the aurora base shows
            through (the eye reads as outline, not a filled shape). */}
        <path
          d="M 118 262 Q 200 190 282 262 Q 200 312 118 262 Z"
          fill="none"
          stroke={STROKE}
          strokeOpacity={0.3}
          strokeWidth={5}
          strokeLinejoin="round"
        />

        {/* Iris — wrapped in its own <g> so the transform animation
            (side-to-side scan) applies only to the iris, not the eye
            outline. Transforms around the iris's local center via
            transform-origin set in CSS. */}
        <g className="hero-mascot-iris">
          <circle
            cx={200}
            cy={260}
            r={28}
            fill={STROKE}
            fillOpacity={0.06}
            stroke={STROKE}
            strokeOpacity={0.42}
            strokeWidth={3}
          />
          <circle cx={200} cy={260} r={10} fill={STROKE} fillOpacity={0.55} />
        </g>

        {/* Ping ring — starts at the pupil, expands + fades over 4s.
            Renders as "the scanner just detected something". */}
        <circle
          className="hero-mascot-ping"
          cx={200}
          cy={260}
          r={38}
          fill="none"
          stroke={STROKE}
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
