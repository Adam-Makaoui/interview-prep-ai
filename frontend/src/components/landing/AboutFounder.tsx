/**
 * @fileoverview Founder section for the landing page.
 *
 * Renders between the testimonials and pricing sections to give prospects
 * a human signal — who built this and why — before the pricing ask.
 *
 * The avatar is a gradient placeholder (initials "AM") until a real headshot
 * is dropped in at `/public/brand/founder-headshot.jpg`. When that file
 * exists, swap the placeholder `<span>` for an `<img>` pointing at that
 * path — single-line edit, flagged in a comment below.
 *
 * Copy is draft-quality — fine for a soft launch but rewrite before any
 * larger marketing push. Flagged with a TODO so it is easy to grep.
 *
 * @module components/landing/AboutFounder
 */

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const VIEWPORT_ONCE = { once: true as const, amount: 0.3 as const };

/**
 * Compact founder story — single column, center-aligned, same visual language
 * as the glass-panel sections so it reads as a first-party trust cue rather
 * than a separate "about page" cutout.
 */
export function AboutFounder() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative mx-auto max-w-2xl px-6 py-16 text-center sm:py-20"
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE}
        variants={fadeUp}
        className="flex flex-col items-center gap-5"
      >
        {/* TODO: swap this placeholder for an <img src="/brand/founder-headshot.jpg" /> once the headshot is added. */}
        <span
          aria-hidden
          className="font-display flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-base font-bold text-white shadow-lg shadow-violet-500/30 ring-2 ring-white/10"
        >
          AM
        </span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-400">
          Who built this
        </span>

        <h2
          id="about-heading"
          className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white"
        >
          Built for interviewers, by one
        </h2>

        {/* TODO: replace this placeholder bio with real copy. */}
        <p className="max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg dark:text-gray-400">
          I&apos;m Adam. I spent years walking into multi-round interview loops half-prepared and
          watching candidates who had a system beat me out. InterviewIntel is the system I wish
          I&apos;d had — it reads the posting, models the panel, and scores my answers until I&apos;m
          actually ready.
        </p>

        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
          <span>— Adam Makaoui, founder</span>
          <span aria-hidden>·</span>
          <a
            href="https://linkedin.com/in/adammakaoui"
            target="_blank"
            rel="noopener"
            className="font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            LinkedIn
          </a>
        </p>
      </motion.div>
    </section>
  );
}
