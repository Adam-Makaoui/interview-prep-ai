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
 * Color: single rgb(139, 92, 246) — the brand violet — at raised
 * base opacities (0.46 on arcs, 0.52 on eye outline, 0.68 on iris
 * stroke, 0.80 on pupil fill). Multiplied by the container-level
 * opacity (breath peaks at 0.55), the brightest rendered pixel
 * anywhere inside the mascot is approximately 0.80 * 0.55 = 0.44 —
 * a confident "ethereal scanner" read rather than a nearly-invisible
 * ghost. Raised in response to user feedback that the previous
 * 0.18 ceiling disappeared against the dark aurora backdrop.
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
    // Stage: absolute-positions the mascot inside the hero wrapper and
    // applies the horizontal centering via translate-x-1/2. Kept
    // separate from `.hero-mascot` so the orbit `transform` on the
    // inner element doesn't fight the -50% centering transform on the
    // outer one (combining them into one `transform` string would make
    // the centering break whenever the orbit keyframe drives the
    // transform to something other than -50%).
    <div
      aria-hidden
      className="hero-mascot-stage pointer-events-none absolute left-1/2 -z-20 -translate-x-1/2"
    >
      <div
        // `.hero-mascot` now owns TWO animations:
        //   1. `heroMascotBreath` — opacity pulse (the "scanner is on"
        //      signal), unchanged intent but raised envelope.
        //   2. `heroMascotOrbit`  — 45s-ish drift loop that walks the
        //      mascot through a bounded elliptical path above the H1
        //      line so it reads as "an agent scanning different parts
        //      of the page" instead of breathing in place.
        // Composed via CSS's multi-animation shorthand in index.css.
        className="hero-mascot"
      >
        <svg
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
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
              strokeOpacity={0.46}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              className="hero-mascot-arc hero-mascot-arc-2"
              d="M 108 180 Q 200 108 292 180"
              fill="none"
              stroke={STROKE}
              strokeOpacity={0.46}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              className="hero-mascot-arc hero-mascot-arc-3"
              d="M 90 208 Q 200 122 310 208"
              fill="none"
              stroke={STROKE}
              strokeOpacity={0.46}
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
            strokeOpacity={0.52}
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
              fillOpacity={0.12}
              stroke={STROKE}
              strokeOpacity={0.68}
              strokeWidth={3}
            />
            <circle cx={200} cy={260} r={10} fill={STROKE} fillOpacity={0.8} />
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
    </div>
  );
}
