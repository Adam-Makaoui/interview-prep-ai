/**
 * @fileoverview Subtle ambient mesh — a sparse knowledge-graph overlay
 * that reads as "intelligence" texture in the hero periphery.
 *
 * Design decisions vs. the previous constellation (which the user
 * rightly called "distracting"):
 *   - SPARSE: 12 nodes, ~18 edges. Old version had ~24 nodes, 40+
 *     edges — it read as dense foreground. Fewer edges = more
 *     breathing room for the hero text.
 *   - LAYOUT: nodes positioned around the PERIMETER of the hero (top
 *     strip, corners, sides), deliberately leaving the CENTRAL ~45%
 *     empty so the H1, subcopy, and CTAs sit on an unbroken dark
 *     canvas. The mesh wraps the text, never crosses it.
 *   - CONTRAST PROFILE: per user direction, NODES are brighter and
 *     LINES are dimmer than before.
 *       * Node fill:   rgba(180, 155, 255, 0.85)  — bright violet
 *       * Edge stroke: rgba(90, 70, 150, 0.22)    — dim dark-violet
 *     Old version was closer to 0.95/1.0 on both — nodes AND lines
 *     were shouting. Now lines are almost whisper-level; nodes still
 *     twinkle clearly.
 *   - CONTAINER OPACITY: 0.5 (old was 0.55). Multiplies everything
 *     down so the final rendered node peak is ~0.43 alpha and the
 *     edge peak is ~0.11. Nodes visible but not distracting.
 *
 * Why a manual node layout instead of procedural/random:
 *   A hand-placed, perimeter-hugging layout is predictable — it
 *   never accidentally drops a node on top of the H1. With a random
 *   layout we'd need rejection sampling + a "safe zone" rectangle,
 *   which is extra code for no aesthetic gain at this count.
 *
 * @module components/landing/HeroConstellation
 */

/**
 * Node positions in percentage-of-container-box coordinates.
 * Arranged around the perimeter: top strip (6 nodes), sides (4 nodes),
 * bottom strip (2 nodes). Central ~45% of the box is intentionally
 * empty — that's where the hero text lives.
 *
 * `delay` is applied as `animation-delay` on the node's pulse so the
 * constellation twinkles out of phase, not in unison.
 */
const NODES: Array<{ x: number; y: number; delay: number }> = [
  // Top strip (left → right)
  { x: 8, y: 12, delay: 0 },
  { x: 24, y: 7, delay: 1.2 },
  { x: 42, y: 14, delay: 0.4 },
  { x: 58, y: 9, delay: 1.8 },
  { x: 76, y: 15, delay: 0.9 },
  { x: 92, y: 10, delay: 2.1 },
  // Upper sides
  { x: 5, y: 34, delay: 1.5 },
  { x: 95, y: 32, delay: 0.6 },
  // Lower sides
  { x: 7, y: 66, delay: 2.4 },
  { x: 93, y: 68, delay: 1.1 },
  // Bottom strip
  { x: 22, y: 86, delay: 0.3 },
  { x: 78, y: 88, delay: 1.9 },
];

/**
 * Edges as (from-index, to-index) pairs into NODES[]. Hand-curated so
 * each edge connects a NEAR neighbor — no long cross-hero diagonals
 * that would cut through the H1. ~18 short edges total.
 */
const EDGES: Array<[number, number]> = [
  // Top strip zigzag
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  // Top nodes dropping to upper sides
  [0, 6], [5, 7],
  [1, 6], [4, 7],
  // Upper sides to lower sides (the vertical "frame")
  [6, 8], [7, 9],
  // Lower sides to bottom strip
  [8, 10], [9, 11],
  // Bottom strip
  [10, 11],
  // A few diagonals that stay in perimeter (don't cross center)
  [2, 6], [3, 7], [8, 11], [9, 10],
];

/**
 * Subtle mesh. Placed inside the hero's `relative overflow-hidden`
 * wrapper at `-z-10` so it sits ABOVE the aurora and mascot but
 * BELOW the hero content.
 *
 * Uses preserveAspectRatio="none" so the viewBox stretches with the
 * container width — nodes keep their percentage positions on any
 * screen size without media queries.
 */
export function HeroConstellation() {
  return (
    <svg
      aria-hidden
      className="hero-constellation pointer-events-none absolute inset-0 -z-10 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Edges first so nodes render on top. Strokes are DIM per user
          spec — they exist to suggest connectivity without competing
          with the node pulse or the hero text. */}
      <g stroke="rgba(90, 70, 150, 0.22)" strokeWidth={0.08}>
        {EDGES.map(([from, to], i) => (
          <line
            key={`e-${i}`}
            x1={NODES[from].x}
            y1={NODES[from].y}
            x2={NODES[to].x}
            y2={NODES[to].y}
            // preserveAspectRatio="none" stretches strokes non-uniformly;
            // vectorEffect keeps the line width visually constant.
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Nodes — brighter per user spec. Each gets an inline
          `animation-delay` so the twinkle keyframe desynchronizes
          across the set (prevents the mesh from flashing in unison). */}
      <g fill="rgba(180, 155, 255, 0.85)">
        {NODES.map((node, i) => (
          <circle
            key={`n-${i}`}
            className="hero-constellation-node"
            cx={node.x}
            cy={node.y}
            r={0.55}
            style={{ animationDelay: `${node.delay}s` }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
