/**
 * @fileoverview Hero-scoped "intelligence" motif — a static SVG
 * knowledge-graph constellation (nodes + connections) that sits behind
 * the aurora and pulses softly. Reads as "something is thinking back
 * there" without competing with the hero copy or card stack.
 *
 * Why this shape rather than stars, particles, or a flow field:
 *   - Nodes + edges map directly to how people visualize LLMs / knowledge
 *     graphs, which is on-brand for an "interview intelligence" product.
 *   - Static SVG is ~2 KB and paints once — per-frame cost after mount is
 *     only the compositor advancing the keyframe opacity on each <circle>.
 *   - The whole layer renders at ~10% opacity so it cannot dominate; any
 *     viewer who notices it notices it at the edge of attention.
 *
 * Architecture:
 *   - Pure inline SVG, no assets, no dependencies.
 *   - `viewBox="0 0 1000 600"` + `preserveAspectRatio="xMidYMid slice"` so
 *     the graph covers the hero at any viewport size, center-cropping
 *     rather than squashing.
 *   - Nodes pulse via `@keyframes constellationPulse` in index.css;
 *     staggered per-node `animationDelay` spreads the twinkle so the
 *     network never flashes in sync.
 *   - Edges do not animate — only node opacity changes, which keeps the
 *     compositor cost near-zero.
 *   - `prefers-reduced-motion: reduce` gates the keyframe (see index.css),
 *     leaving the constellation visible but static.
 *
 * Accessibility:
 *   - `aria-hidden` on the wrapper; decorative only.
 *   - `pointer-events-none` — never intercepts clicks.
 *
 * @module components/landing/HeroConstellation
 */

/**
 * Pre-laid-out node positions in the 1000x600 viewBox. Positions were
 * picked to feel organic (slight irregularity in both axes) rather than
 * grid-perfect. Changing these is the only thing to tune if a section of
 * the constellation feels too dense or too sparse.
 */
const NODES: ReadonlyArray<readonly [number, number]> = [
  [120, 60], [280, 90], [460, 50], [640, 85], [820, 60], [940, 110],
  [70, 200], [220, 180], [380, 220], [540, 170], [700, 210], [860, 200],
  [150, 340], [310, 300], [480, 360], [640, 320], [810, 350], [950, 310],
  [80, 500], [260, 470], [430, 520], [600, 480], [760, 510], [900, 490],
];

/**
 * Edges as `[fromIndex, toIndex]` pairs into NODES. Kept hand-picked so
 * the graph reads like a curated network instead of an exhaustive mesh.
 */
const EDGES: ReadonlyArray<readonly [number, number]> = [
  // Row-internal connectors
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [12, 13], [13, 14], [14, 15], [15, 16], [16, 17],
  [18, 19], [19, 20], [20, 21], [21, 22], [22, 23],
  // Down-neighbor connectors (row 1 -> row 2)
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
  // Row 2 -> row 3
  [6, 13], [7, 14], [9, 15], [10, 16], [11, 17],
  // Row 3 -> row 4
  [12, 18], [13, 19], [14, 20], [15, 21], [16, 22], [17, 23],
  // Diagonal skip-edges so the graph doesn't read as 4 parallel bands
  [2, 9], [7, 13], [14, 21],
];

/** Palette — violet echoing the site-wide accent color, at low alpha. */
const NODE_FILL = "rgba(139, 92, 246, 0.55)";
const EDGE_STROKE = "rgba(139, 92, 246, 0.18)";

/**
 * Hero-scoped constellation. Must be rendered inside a `position: relative`
 * container. Intended to sit BEHIND the HeroAurora layer so the aurora's
 * soft-light blend reads over it.
 */
export function HeroConstellation() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-20 opacity-[0.08] dark:opacity-[0.14]"
    >
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <g>
          {EDGES.map(([from, to], i) => {
            const [x1, y1] = NODES[from];
            const [x2, y2] = NODES[to];
            return (
              <line
                key={`edge-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={EDGE_STROKE}
                strokeWidth={0.6}
              />
            );
          })}
        </g>
        <g>
          {NODES.map(([cx, cy], i) => (
            <circle
              key={`node-${i}`}
              cx={cx}
              cy={cy}
              r={2}
              fill={NODE_FILL}
              className="constellation-pulse"
              // Spread 24 nodes across the 5s cycle so the twinkle is
              // desynchronized. (i * 0.21) wraps through [0, 5) — within
              // 0.04s of a uniform distribution, close enough for irregular.
              style={{ animationDelay: `${((i * 0.21) % 5).toFixed(2)}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
