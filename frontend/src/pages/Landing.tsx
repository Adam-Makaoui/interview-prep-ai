/**
 * @fileoverview Public marketing landing page for InterviewIntel — the unauthenticated entry point and SEO face of the product.
 *
 * Composes: hero + feature value-prop bands (with scroll-driven zoom), demo video embed, testimonial carousel,
 * pricing tiers, and CTAs wired to `/login` or `/app` via {@link useAuth}. All motion uses Framer Motion.
 *
 * Heavy decorative visuals (glass panels, animated orbs, 3D carousel) live on THIS route only — keep the
 * authenticated product shell flatter per CLAUDE.md.
 *
 * @module pages/Landing
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useAuth } from "../lib/auth";
import { InterviewGrid } from "../components/landing/InterviewGrid";

/**
 * YouTube video ID powering the "See it in action" embed via `youtube-nocookie.com/embed/<id>`.
 * Swap the placeholder for the real ID before launch — marketing-only, not read by the backend.
 */
const DEMO_VIDEO_ID = "YOUR_VIDEO_ID";

/**
 * Decorative 1px gradient hairline rendered between vertical sections to create Railway-style rhythm.
 * Purely visual (aria-hidden); marketing-only per CLAUDE.md.
 *
 * @param className - Extra Tailwind classes (typically vertical spacing like `mt-12`).
 */
function SectionHairline({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center px-6 ${className}`} aria-hidden>
      <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-violet-300/45 to-transparent dark:via-violet-500/28" />
    </div>
  );
}

/* ── Animation variants (Framer Motion) ─────────────────────────────── */

/**
 * Variant pair for `initial` / `whileInView`: fade in while translating up 30px.
 * Pair with a parent using {@link stagger} to sequence children.
 */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

/**
 * Variant pair for elements that should "pop" in with a slight zoom (e.g. illustrative mockups, video panel).
 */
const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" as const } },
};

/**
 * Parent variant — only defines `visible` with a staggered transition so direct motion children
 * that declare their own `variants` animate in sequence (150ms apart).
 */
const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

/**
 * `whileInView` viewport config for sections that should REPLAY their entrance stagger each time they
 * scroll back into view (`once: false`). `margin: "-8% 0px"` shrinks the intersection box slightly to
 * reduce edge flicker when scrolling quickly.
 */
const VIEWPORT_REPEAT = { once: false as const, amount: 0.25 as const, margin: "-8% 0px" as const };

/**
 * `whileInView` viewport config for users with `prefers-reduced-motion` — animate at most once
 * to avoid repeated entrance churn.
 */
const VIEWPORT_ONCE = { once: true as const, amount: 0.25 as const };

/**
 * Shared Tailwind class string for frosted "glass" panels. Landing-only aesthetic; do not reuse in
 * the authenticated product shell (keep product panels flat per CLAUDE.md).
 */
const glassSurface =
  "rounded-xl border border-white/60 bg-white/75 p-5 shadow-xl shadow-violet-200/25 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/55 dark:shadow-2xl dark:shadow-black/25";

/* ── Landing atmosphere (gradients + orbs + noise) ───────────────────── */

/**
 * Full-page background layer for the landing route: gradient base + four soft color orbs + SVG noise overlay.
 * Paints behind every section (`-z-10` / `-z-20`).
 *
 * @param reducedMotion - When true, orbs render as static blobs (no pulsing opacity/scale loops).
 */
function LandingAtmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  const orb = "pointer-events-none absolute -z-10 rounded-full blur-3xl";
  const base = (
    <div
      className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-violet-100/95 via-white to-slate-100/90 dark:from-[#0b0614] dark:via-[#120a1c] dark:to-gray-950"
      aria-hidden
    />
  );
  const noise = (
    <div
      className="landing-noise pointer-events-none absolute inset-0 -z-[5] opacity-[0.32] mix-blend-overlay dark:opacity-[0.18] dark:mix-blend-soft-light"
      aria-hidden
    />
  );

  if (reducedMotion) {
    return (
      <>
        {base}
        <div className={`${orb} top-[8%] left-[8%] h-[min(480px,55vw)] w-[min(480px,55vw)] bg-violet-400/32 dark:bg-violet-600/22`} aria-hidden />
        <div className={`${orb} top-[22%] right-[4%] h-[min(400px,48vw)] w-[min(400px,48vw)] bg-fuchsia-400/22 dark:bg-fuchsia-600/16`} aria-hidden />
        <div className={`${orb} bottom-[12%] left-[18%] h-[min(520px,60vw)] w-[min(520px,60vw)] bg-indigo-400/26 dark:bg-indigo-600/18`} aria-hidden />
        <div className={`${orb} bottom-[6%] right-[12%] h-[min(360px,42vw)] w-[min(360px,42vw)] bg-cyan-400/18 dark:bg-cyan-600/12`} aria-hidden />
        {noise}
      </>
    );
  }

  return (
    <>
      {base}
      <motion.div
        className={`${orb} top-[8%] left-[8%] h-[min(480px,55vw)] w-[min(480px,55vw)] bg-violet-400/32 dark:bg-violet-600/22`}
        aria-hidden
        animate={{ opacity: [0.42, 0.62, 0.42], scale: [1, 1.05, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`${orb} top-[22%] right-[4%] h-[min(400px,48vw)] w-[min(400px,48vw)] bg-fuchsia-400/24 dark:bg-fuchsia-600/18`}
        aria-hidden
        animate={{ opacity: [0.32, 0.52, 0.32], scale: [1, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.div
        className={`${orb} bottom-[12%] left-[18%] h-[min(520px,60vw)] w-[min(520px,60vw)] bg-indigo-400/28 dark:bg-indigo-600/20`}
        aria-hidden
        animate={{ opacity: [0.38, 0.58, 0.38], scale: [1.04, 1, 1.04] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      <motion.div
        className={`${orb} bottom-[6%] right-[12%] h-[min(360px,42vw)] w-[min(360px,42vw)] bg-cyan-400/20 dark:bg-cyan-600/14`}
        aria-hidden
        animate={{ opacity: [0.28, 0.48, 0.28], scale: [1, 1.07, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {noise}
    </>
  );
}

/* ── Feature mockup components ──────────────────────────────────────── */

function MockJDAnalysis() {
  return (
    <div className={`${glassSurface} space-y-3 text-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Analysis Complete</span>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/40 p-3">
        <span className="text-xs text-gray-500 uppercase">Company</span>
        <p className="text-gray-900 dark:text-white font-medium">Stripe</p>
      </div>
      <div>
        <span className="text-xs text-gray-500 uppercase">Key Skills</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {["API Design", "Payments", "System Design", "Cross-functional", "SQL"].map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20">{s}</span>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-500/5 dark:border-emerald-500/15 p-3">
        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Role match</span>
        <div className="mt-1.5 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Strong alignment on 4/5 core requirements</p>
      </div>
    </div>
  );
}

function MockQA() {
  return (
    <div className={`${glassSurface} space-y-4 text-sm`}>
      <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/40 p-3">
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase">Q1 &middot; Hiring Manager</span>
        <p className="text-gray-900 dark:text-white mt-1 leading-relaxed">&quot;Walk me through a time you had to align engineering and sales on a technical decision.&quot;</p>
      </div>
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/5 dark:border-indigo-500/15 p-3 space-y-2">
        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">STAR Framework</span>
        <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
          <p><span className="text-indigo-600 dark:text-indigo-400 font-medium">S:</span> API migration project at Series B fintech...</p>
          <p><span className="text-indigo-600 dark:text-indigo-400 font-medium">T:</span> Needed buy-in from 3 eng leads + VP Sales...</p>
          <p><span className="text-indigo-600 dark:text-indigo-400 font-medium">A:</span> Built a shared decision matrix with...</p>
          <p><span className="text-indigo-600 dark:text-indigo-400 font-medium">R:</span> Shipped 2 weeks early, 40% fewer support tickets</p>
        </div>
      </div>
    </div>
  );
}

function MockRolePlay() {
  return (
    <div className={`${glassSurface} space-y-3 text-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="motion-reduce:animate-none w-2 h-2 rounded-full bg-purple-500 animate-pulse dark:bg-purple-400" />
        <span className="text-xs font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wider">Live Role-Play</span>
      </div>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:border-purple-500/30 dark:text-purple-300 flex items-center justify-center shrink-0 text-xs font-bold">I</div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700/40 p-3 flex-1">
          <p className="text-gray-700 dark:text-gray-300">&quot;How would you handle a POC that&apos;s going off the rails with a strategic account?&quot;</p>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 p-3 flex-1 max-w-[85%]">
          <p className="text-gray-700 dark:text-gray-300">&quot;I&apos;d first align with the AE on what success looks like for the customer, then...&quot;</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold">Y</div>
      </div>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-500/20 dark:border-cyan-500/30 dark:text-cyan-300 flex items-center justify-center shrink-0 text-xs font-bold">C</div>
        <div className="rounded-lg bg-cyan-50 border border-cyan-100 dark:bg-cyan-500/5 dark:border-cyan-500/15 p-3 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-cyan-700 dark:text-cyan-400 font-bold text-lg">8.5</span>
            <span className="text-xs text-cyan-600 dark:text-cyan-400/70">/10</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-xs">Strong stakeholder awareness. Add a specific metric from a past POC to strengthen credibility.</p>
        </div>
      </div>
    </div>
  );
}

function MockScorecard() {
  const skills = [
    { name: "Stakeholder Mgmt", score: 8.5 },
    { name: "Technical Depth", score: 7.2 },
    { name: "Communication", score: 9.0 },
    { name: "Problem Solving", score: 7.8 },
    { name: "Business Acumen", score: 8.1 },
  ];
  return (
    <div className={`${glassSurface} space-y-3 text-sm`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Skills Scorecard</span>
        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">Ready</span>
      </div>
      <div className="space-y-2.5">
        {skills.map((s) => (
          <div key={s.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-700 dark:text-gray-300">{s.name}</span>
              <span className="text-gray-500 dark:text-gray-400">{s.score}/10</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                style={{ width: `${s.score * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-gray-200 dark:border-gray-800/60 flex items-center justify-between">
        <span className="text-gray-500 text-xs">Overall</span>
        <span className="text-gray-900 dark:text-white font-bold text-lg">8.1<span className="text-gray-500 text-sm font-normal">/10</span></span>
      </div>
    </div>
  );
}

/* ── Feature section data ───────────────────────────────────────────── */

/**
 * Ordered list of value-prop "bands" rendered between the hero and the testimonials.
 * Each entry drives one alternating left/right {@link FeatureSection} (copy on one side, mockup on the other).
 *
 * Shape per band:
 * - `id`          — stable React key and anchor-friendly slug.
 * - `label`       — small uppercase eyebrow shown above the title.
 * - `title`       — H3 headline for the band.
 * - `description` — supporting paragraph copy.
 * - `bullets`     — 3 short proof-points rendered with a checkmark bullet.
 * - `mockup`      — JSX preview element (illustrative only — not real product state).
 *
 * Order matters: it defines the narrative (Context → Frameworks → Rehearsal → Progress).
 */
const LANDING_VALUE_PROP_BANDS = [
  {
    id: "context",
    label: "Context",
    title: "Job description intelligence",
    description:
      "Paste a posting URL or full job description and get a structured breakdown fast: company context, must-have skills, culture signals, and how your resume lines up with what they actually asked for.",
    bullets: [
      "Company footprint, market position, and competitor lens",
      "Resume vs job description fit with explicit gap analysis",
      "Missing keywords surfaced before you hit submit",
    ],
    mockup: <MockJDAnalysis />,
  },
  {
    id: "frameworks",
    label: "Frameworks",
    title: "Tailored Q&A Frameworks",
    description: "Stage-specific questions with personalized STAR-method answer frameworks built from your resume. Not generic top-10 lists from the internet.",
    bullets: [
      "Questions matched to interview stage & interviewers",
      "STAR answers pre-filled with your experience",
      "Red flags and timing guidance included",
    ],
    mockup: <MockQA />,
  },
  {
    id: "rehearsal",
    label: "Rehearsal",
    title: "AI Mock Interviews",
    description: "Practice with an AI interviewer persona that adapts to your stage, role, and interviewers. Get scored feedback with an improved answer after every response.",
    bullets: [
      "Realistic conversational interview flow",
      "Score (1-10) + specific feedback per answer",
      "Coach suggests an improved version you can learn from",
    ],
    mockup: <MockRolePlay />,
  },
  {
    id: "progress",
    label: "Progress",
    title: "Skills Scorecard & Progress",
    description: "Track your performance across competency dimensions. See what you're strong at and where to drill before the real thing. All tracked across sessions.",
    bullets: [
      "Per-competency scoring across all sessions",
      "Score trends over time with visual charts",
      "Weakest areas surfaced with practice suggestions",
    ],
    mockup: <MockScorecard />,
  },
];

/* ── Feature section with scroll-driven scale ──────────────────────── */

/**
 * Renders a single value-prop band (copy + illustrative mockup) with a scroll-driven zoom.
 *
 * Layout alternates each row: even indices place the mockup on the right, odd indices on the left
 * (`lg:flex-row-reverse`). The wrapper subscribes to its own scroll progress so the band scales up
 * as it enters the viewport and gently shrinks/fades as it leaves — a Railway-style "card zoom".
 *
 * @param band             - The value-prop entry from {@link LANDING_VALUE_PROP_BANDS}.
 * @param sectionIndex     - Position within the bands list; parity controls mockup side.
 * @param reducedMotion    - When true, disables scroll scale/opacity transforms for accessibility.
 */
function FeatureSection({
  band,
  sectionIndex,
  reducedMotion,
}: {
  band: (typeof LANDING_VALUE_PROP_BANDS)[number];
  sectionIndex: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Zoom up as the band crosses the viewport center, fade out on exit.
  const scale = useTransform(scrollYProgress, [0, 0.22, 0.78, 1], [0.76, 1.06, 1.06, 0.76]);
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.4, 1, 1, 0.4]);
  // Alternate mockup side by index parity (0 = left copy/right mockup, 1 = reversed, …).
  const mockupOnRight = sectionIndex % 2 === 1;

  return (
    <motion.section
      ref={ref}
      style={reducedMotion ? undefined : { scale, opacity }}
      className="mx-auto max-w-6xl px-6"
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={reducedMotion ? VIEWPORT_ONCE : VIEWPORT_REPEAT}
        variants={stagger}
        className={`flex flex-col ${mockupOnRight ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-16`}
      >
        <motion.div variants={fadeUp} className="flex-1 max-w-lg">
          <span className="font-display mb-3 inline-block rounded-md border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
            {band.label}
          </span>
          <h3 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white mb-4">
            {band.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-5">
            {band.description}
          </p>
          <ul className="space-y-2.5">
            {band.bullets.map((bulletLine) => (
              <li key={bulletLine} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {bulletLine}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div variants={fadeScale} className="flex-1 max-w-md w-full">
          {band.mockup}
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

/* ── Social proof data ──────────────────────────────────────────────── */

/**
 * Static list of customer quotes shown in the testimonials carousel.
 * Each entry carries a name/role pair, avatar initials + color swatch, and the quote itself.
 * Keep around 5 items — the 3D ring spaces cards evenly using `360 / length`.
 */
const LANDING_CUSTOMER_TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Senior SE at Salesforce",
    initials: "SK",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
    quote:
      "I used this for my Stripe final round. The job description analysis caught gaps I would have never addressed. Got the offer.",
  },
  {
    name: "Marcus T.",
    role: "Solutions Architect",
    initials: "MT",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    quote: "The role-play felt surprisingly real. The feedback after each answer was more useful than any mock interview I've done with friends.",
  },
  {
    name: "Priya R.",
    role: "Pre-Sales Engineer at AWS",
    initials: "PR",
    color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    quote: "Went from generic prep to role-specific, interviewer-aware prep. The STAR frameworks saved me hours of writing.",
  },
  {
    name: "Jordan L.",
    role: "Staff Engineer at Datadog",
    initials: "JL",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
    quote: "I ran three back-to-back loop preps in one weekend. The scorecard showed exactly where I was slipping — nailed every behavioral the following Monday.",
  },
  {
    name: "Elena V.",
    role: "Engineering Manager at Figma",
    initials: "EV",
    color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
    quote: "I was skeptical until I saw the gap analysis on my first job posting. It flagged two skills I'd completely overlooked. Prep time cut in half.",
  },
];

/** Element type of {@link LANDING_CUSTOMER_TESTIMONIALS}. */
type LandingTestimonial = (typeof LANDING_CUSTOMER_TESTIMONIALS)[number];

/**
 * Presentational card for a single testimonial (quote + avatar + name/role).
 * Shared between the 3D carousel and the reduced-motion grid fallback.
 *
 * @param testimonial - The quote + author metadata to render.
 * @param className   - Extra classes merged onto the card wrapper (e.g. for carousel positioning).
 */
function TestimonialCard({
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
      <p className="mb-4 text-sm italic leading-relaxed text-gray-700 dark:text-gray-300">&quot;{testimonial.quote}&quot;</p>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${testimonial.color}`}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{testimonial.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">{testimonial.role}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Continuous 3D ring of testimonials powered by Framer Motion.
 *
 * Cards are positioned around a horizontal ring by compounding `rotateY(i * step) translateZ(radius)`.
 * A {@link useMotionValue} holds the ring's current rotation, and {@link useAnimationFrame} advances it
 * at ~6°/s (full turn ≈ 60s). Hover pauses rotation using a depth counter so nested
 * `pointerenter`/`leave` events from child elements don't desync the paused state.
 *
 * Accessibility: when `reducedMotion` is true we render a static 3-column grid instead of the ring.
 *
 * @param reducedMotion - When true, replaces the ring with a static grid and skips animation frames.
 */
function TestimonialsCarousel3D({ reducedMotion }: { reducedMotion: boolean }) {
  /** Number of cards on the ring — drives even 360° spacing. */
  const cardCount = LANDING_CUSTOMER_TESTIMONIALS.length;
  /** Angular spacing (degrees) between neighbouring cards around the ring. */
  const anglePerCardDeg = 360 / cardCount;
  /** Responsive ring radius in px — tighter on small screens so cards don't overflow horizontally. */
  const [radiusPx, setRadiusPx] = useState(520);
  /**
   * True on viewports < 640px. We swap the 3D ring for a horizontal scroll-snap track below this breakpoint
   * because the ring becomes illegible — cards overlap, touch can't spin it, and rotation consumes battery.
   */
  const [isMobile, setIsMobile] = useState(false);
  /** Drives the ring's Y rotation; advanced every frame when not paused. */
  const rotateY = useMotionValue(0);
  /** True while the pointer is over any card — frame loop skips updates until it goes false. */
  const pausedRef = useRef(false);
  /** Counts nested pointerenter vs pointerleave so child elements don't prematurely un-pause. */
  const cardHoverDepthRef = useRef(0);
  /** Mirrors the `reducedMotion` prop inside the animation frame closure without re-binding it. */
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    if (reducedMotion) return;
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
  }, [reducedMotion]);

  const onCardPointerEnter = useCallback(() => {
    cardHoverDepthRef.current += 1;
    pausedRef.current = true;
  }, []);

  const onCardPointerLeave = useCallback(() => {
    cardHoverDepthRef.current = Math.max(0, cardHoverDepthRef.current - 1);
    pausedRef.current = cardHoverDepthRef.current > 0;
  }, []);

  /**
   * Animation frame callback — rotates the ring counter-clockwise (negative rotateY delta) at
   * ~9°/second while not paused, completing a full revolution in ~40 s (33% faster than the
   * original 60 s cadence).
   *
   * NOTE: Framer's `useAnimationFrame` delivers `delta` in **milliseconds**, not seconds, so we
   * compute `degPerMs = 360 / (40 * 1000)`.
   */
  const onFrame = useCallback(
    (_t: number, delta: number) => {
      if (reducedRef.current || pausedRef.current) return;
      const degPerMs = 360 / (40 * 1000);
      rotateY.set((rotateY.get() - degPerMs * delta) % 360);
    },
    [rotateY],
  );

  useAnimationFrame(onFrame);

  // Fallback for users who prefer reduced motion: static 3-column grid.
  if (reducedMotion) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LANDING_CUSTOMER_TESTIMONIALS.map((testimonial) => (
          <motion.div key={testimonial.name} variants={fadeUp}>
            <TestimonialCard testimonial={testimonial} />
          </motion.div>
        ))}
      </div>
    );
  }

  // Mobile fallback: horizontal scroll-snap track. 3D rings don't translate to small touch surfaces
  // (cards overlap, no hover, touch can't spin), so we swap to a swipeable carousel instead.
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
          {/* Shallow tilt keeps the ring readable; strong perspective flattens side angles. */}
          <div className="[transform-style:preserve-3d]" style={{ transform: "rotateX(-4deg)" }}>
            <motion.div className="h-0 w-0 [transform-style:preserve-3d]" style={{ rotateY }}>
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

/**
 * Full-bleed Railway-inspired "loved by our users" band — heading + CTA link + the 3D carousel.
 * Uses a distinct background hue to visually separate social proof from the surrounding sections.
 *
 * @param reduceMotion - Forwarded from {@link useReducedMotion}; disables entrance replay and ring rotation.
 * @param ctaHref      - Destination for the inline "Start your first free session" link (auth-aware).
 */
function TestimonialsSection({ reduceMotion, ctaHref }: { reduceMotion: boolean; ctaHref: string }) {
  return (
    <section className="relative isolate mb-16 overflow-visible bg-gray-100/80 py-24 dark:bg-[#0d0818]">
      {/* Subtle radial glow — adds depth behind the carousel. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 mx-auto max-w-3xl opacity-25 blur-3xl dark:opacity-15"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, #6366f1 40%, transparent 70%)" }}
        aria-hidden
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={reduceMotion ? VIEWPORT_ONCE : VIEWPORT_REPEAT}
        variants={stagger}
        className="mx-auto max-w-5xl px-6"
      >
        <motion.h2
          variants={fadeUp}
          className="font-display mb-3 text-center text-xl font-bold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl dark:text-white"
        >
          Loved by our users
        </motion.h2>
        <motion.div variants={fadeUp} className="mb-14 text-center">
          <Link
            to={ctaHref}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
          >
            Start your first free session
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </motion.div>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={reduceMotion ? VIEWPORT_ONCE : VIEWPORT_REPEAT}
        variants={fadeUp}
        className="w-full"
      >
        <TestimonialsCarousel3D reducedMotion={reduceMotion} />
      </motion.div>
    </section>
  );
}

/**
 * "See it in action" band — product demo embed in a frosted glass panel.
 * Uses the privacy-enhanced `youtube-nocookie.com` origin; swap {@link DEMO_VIDEO_ID} for the real
 * video ID before launch. Shares the same scroll-driven zoom curve as pricing/testimonials so the
 * three terminal bands feel visually consistent.
 *
 * @param reduceMotion - When true, disables scroll zoom and viewport entrance replays.
 */
function VideoSection({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.22, 0.78, 1], [0.86, 1.04, 1.04, 0.86]);
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.48, 1, 1, 0.48]);

  return (
    <motion.section
      ref={ref}
      style={reduceMotion ? undefined : { scale, opacity }}
      initial="hidden"
      whileInView="visible"
      viewport={reduceMotion ? VIEWPORT_ONCE : VIEWPORT_REPEAT}
      variants={fadeScale}
      className="mx-auto max-w-4xl px-6 pb-24"
    >
      <motion.h2
        variants={fadeUp}
        className="font-display mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white"
      >
        See it in action
      </motion.h2>
      {/* Glass panel wrapping the 16:9 iframe — overflow-hidden clips iframe corners to match border-radius. */}
      <div className={glassSurface}>
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}`}
            title="InterviewIntel demo video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Three-tier pricing band: Free → Pro (highlighted) → Plus.
 *
 * Layout detail: cards use `items-stretch` + `flex h-full flex-col`, the bullet `<ul>` is `flex-1`,
 * and each CTA uses `mt-auto min-h-[42px]` so the three CTAs stay vertically aligned regardless of
 * bullet count. Free and Plus cards add `pt-8` so their titles align with the Pro card's "Most popular"
 * badge that pushes its content down.
 *
 * Tier progression (kept consistent — Free limited, Pro mid-tier, Plus unlimited):
 * - Free : 2 sessions/day, 1 active posting.
 * - Pro  : Unlimited sessions, up to 3 active postings + tracking + priority support.
 * - Plus : Unlimited sessions AND postings + long history + export.
 *
 * @param ctaHref      - Target route for all three CTAs (auth-aware: `/login` or `/app`).
 * @param reduceMotion - When true, disables scroll zoom and entrance replay.
 */
function PricingSection({ ctaHref, reduceMotion }: { ctaHref: string; reduceMotion: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.22, 0.78, 1], [0.86, 1.04, 1.04, 0.86]);
  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.82, 1], [0.48, 1, 1, 0.48]);

  return (
    <motion.section
      ref={ref}
      style={reduceMotion ? undefined : { scale, opacity }}
      initial="hidden"
      whileInView="visible"
      viewport={reduceMotion ? VIEWPORT_ONCE : VIEWPORT_REPEAT}
      variants={stagger}
      className="mx-auto max-w-6xl px-6 pb-24"
    >
      <motion.h2
        variants={fadeUp}
        className="font-display mb-10 text-center text-2xl font-bold text-gray-900 dark:text-white"
      >
        Simple pricing
      </motion.h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-5 sm:grid-cols-3">
        <motion.div
          variants={fadeUp}
          className="flex h-full flex-col rounded-xl border border-white/55 bg-white/70 p-6 pt-8 shadow-lg shadow-violet-200/15 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/50 dark:shadow-black/20"
        >
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Free</h3>
          <p className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
            $0<span className="text-sm font-normal text-gray-500">/forever</span>
          </p>
          <ul className="mb-6 flex flex-1 flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              2 sessions per day
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              1 active job posting
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Full job description analysis
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Prep + role-play modes
            </li>
          </ul>
          <Link
            to={ctaHref}
            className="mt-auto block min-h-[42px] rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-medium leading-normal text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
          >
            Get started
          </Link>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="relative order-first flex h-full flex-col rounded-xl border border-indigo-300/50 bg-gradient-to-b from-white/85 via-white/70 to-violet-50/45 p-6 pt-8 shadow-lg shadow-indigo-200/25 backdrop-blur-xl sm:order-none dark:border-indigo-400/25 dark:from-indigo-500/14 dark:via-gray-950/55 dark:to-gray-950/45 dark:shadow-indigo-950/30"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-indigo-200/90 bg-indigo-100/95 px-3 py-0.5 text-xs font-semibold text-indigo-800 backdrop-blur-sm dark:border-indigo-500/35 dark:bg-indigo-500/22 dark:text-indigo-200">
            Most popular
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Pro</h3>
          <p className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
            $19<span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <ul className="mb-6 flex flex-1 flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Unlimited sessions
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Up to 3 active job postings
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Everything in Free
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Cross-session progress tracking
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Priority support
            </li>
          </ul>
          <Link
            to={ctaHref}
            className="mt-auto block min-h-[42px] rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold leading-normal text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
          >
            Upgrade to Pro
          </Link>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="flex h-full flex-col rounded-xl border border-white/55 bg-white/70 p-6 pt-8 shadow-lg shadow-violet-200/15 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/50 dark:shadow-black/20"
        >
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Plus</h3>
          <p className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            $39<span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-500">For heavy interview seasons with multiple parallel tracks.</p>
          <ul className="mb-6 flex flex-1 flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Unlimited sessions
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Unlimited active job postings
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Everything in Pro
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              12-month session &amp; score history
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Export prep summaries &amp; debrief notes
            </li>
          </ul>
          <Link
            to={ctaHref}
            className="mt-auto block min-h-[42px] rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold leading-normal text-indigo-800 transition-colors hover:border-indigo-300 hover:bg-indigo-100/90 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-400/50 dark:hover:bg-indigo-500/20"
          >
            Get Plus
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ── Main Landing component ─────────────────────────────────────────── */

/**
 * Public marketing landing page.
 *
 * Responsibilities:
 * 1. Decide the primary CTA destination/label based on auth state (`/app` vs `/login`).
 * 2. Compose the landing narrative: atmosphere → header → hero → value-prop bands → video → testimonials → pricing → final CTA.
 * 3. Forward the user's `prefers-reduced-motion` preference to every animated child so accessibility is honored throughout.
 *
 * Keep this component presentational — it should not talk to the backend or Supabase directly; navigation
 * and auth state are the only dynamic inputs.
 */
export default function Landing() {
  const { user } = useAuth();
  /** Where every "start" CTA on the page routes — sign-in wall for guests, dashboard for logged-in users. */
  const ctaHref = user ? "/app" : "/login";
  /** Button label that mirrors {@link ctaHref} (kept in sync so the hero CTA reads naturally in both states). */
  const ctaLabel = user ? "Go to Dashboard" : "Start Free Session";
  /** `true` when the OS/browser reports `prefers-reduced-motion: reduce` — propagated to every animated child. */
  const reduceMotion = useReducedMotion();

  return (
    <div className="landing-page relative isolate min-h-screen overflow-x-visible font-sans text-gray-900 dark:text-white">
      {/* Marketing-only luxury gradient stack — avoid copying into product UI (see CLAUDE.md). */}
      <LandingAtmosphere reducedMotion={!!reduceMotion} />

      <header className="relative z-10 border-b border-white/50 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/45">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-bold tracking-tight">
            Interview<span className="text-indigo-600 dark:text-indigo-400">Intel</span>
          </span>
          {user ? (
            <Link
              to={ctaHref}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
            >
              Dashboard
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Sign in
              </Link>
              <Link
                to={ctaHref}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-indigo-500 sm:px-4"
              >
                Start Free Session
              </Link>
            </div>
          )}
        </div>
      </header>

      <section className="relative z-0 mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-20">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="relative">
          <motion.div variants={fadeScale} className="mb-10 flex justify-center sm:mb-12">
            <InterviewGrid />
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-100/90 px-4 py-1.5 text-xs font-medium text-indigo-800 backdrop-blur-sm dark:border-indigo-500/25 dark:bg-indigo-500/12 dark:text-indigo-300"
          >
            <span className="motion-reduce:animate-none h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600 dark:bg-indigo-400" />
            One structured system for serious technical interviews
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display mx-auto mb-10 max-w-4xl text-5xl font-bold leading-[1.06] tracking-tight text-gray-900 sm:text-6xl lg:text-7xl dark:text-white"
          >
            <span className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700/90 sm:mb-5 sm:text-xs dark:text-violet-400/90">
              Structured prep · from posting to offer
            </span>
            <span className="block">Your interview prep</span>
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400">
              mastermind
            </span>
            <span className="mt-3 block text-[0.55em] font-semibold tracking-tight text-gray-600 sm:mt-4 dark:text-gray-400">
              Reads the posting. Models the panel. Surfaces your gaps.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400"
          >
            Built for multi-round technical and behavioral loops at high-stakes companies. Analysis, tailored questions,
            answer frameworks, and scored role-play — so you walk in with a plan instead of a prayer.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to={ctaHref}
              className="rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-500"
            >
              {ctaLabel}
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-gray-300/90 px-7 py-3.5 text-sm font-medium text-gray-800 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
            >
              See how it works
            </a>
          </motion.div>
          <SectionHairline className="mt-14" />
        </motion.div>
      </section>

      {/* Section heading before features */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE}
        variants={fadeUp}
        className="pb-16 text-center"
      >
        <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Here&apos;s how it works
        </h2>
      </motion.div>

      {/* Feature sections — alternating copy/mockup bands with scroll zoom. */}
      <div id="features" className="space-y-20 sm:space-y-32 pb-24">
        {LANDING_VALUE_PROP_BANDS.map((band, bandIndex) => (
          <Fragment key={band.id}>
            {bandIndex > 0 ? <SectionHairline className="-mt-4 sm:-mt-6" /> : null}
            <FeatureSection band={band} sectionIndex={bandIndex} reducedMotion={!!reduceMotion} />
          </Fragment>
        ))}
      </div>

      {/* Demo video — swap DEMO_VIDEO_ID at top of file with your real YouTube video ID */}
      <SectionHairline className="mb-12" />
      <VideoSection reduceMotion={!!reduceMotion} />

      {/* Social proof */}
      <TestimonialsSection reduceMotion={!!reduceMotion} ctaHref={ctaHref} />

      {/* Pricing */}
      <PricingSection ctaHref={ctaHref} reduceMotion={!!reduceMotion} />

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-white/50 bg-white/55 p-10 shadow-xl shadow-violet-200/20 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/50 dark:shadow-black/30">
          <h2 className="font-display mb-3 text-2xl font-bold text-gray-900 dark:text-white">
            Walk in with a prep system, not a guess
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Your first two sessions are free each day. No credit card. Point it at a posting and get structured prep in
            minutes.
          </p>
          <Link
            to={ctaHref}
            className="inline-flex rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-sm text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/45 bg-white/35 py-6 text-center text-xs text-gray-600 backdrop-blur-md dark:border-white/10 dark:bg-gray-950/35 dark:text-gray-500">
        InterviewIntel &middot; Built by{" "}
        <a href="https://linkedin.com/in/adammakaoui" target="_blank" rel="noopener" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
          Adam Makaoui
        </a>
      </footer>
    </div>
  );
}
