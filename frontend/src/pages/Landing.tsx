import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";

/* ── Animation variants ─────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

const VIEWPORT = { once: true, amount: 0.25 as const };

/* ── Feature mockup components ──────────────────────────────────────── */

function MockJDAnalysis() {
  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800/60 p-5 space-y-3 text-sm shadow-2xl shadow-indigo-500/5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Analysis Complete</span>
      </div>
      <div className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3">
        <span className="text-xs text-gray-500 uppercase">Company</span>
        <p className="text-white font-medium">Stripe</p>
      </div>
      <div>
        <span className="text-xs text-gray-500 uppercase">Key Skills</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {["API Design", "Payments", "System Design", "Cross-functional", "SQL"].map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/20">{s}</span>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
        <span className="text-[11px] font-semibold text-emerald-400 uppercase">JD Match</span>
        <div className="mt-1.5 h-2 rounded-full bg-gray-700 overflow-hidden">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Strong alignment on 4/5 core requirements</p>
      </div>
    </div>
  );
}

function MockQA() {
  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800/60 p-5 space-y-4 text-sm shadow-2xl shadow-indigo-500/5">
      <div className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3">
        <span className="text-xs text-indigo-400 font-semibold uppercase">Q1 &middot; Hiring Manager</span>
        <p className="text-white mt-1 leading-relaxed">"Walk me through a time you had to align engineering and sales on a technical decision."</p>
      </div>
      <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 p-3 space-y-2">
        <span className="text-[11px] font-semibold text-indigo-400 uppercase">STAR Framework</span>
        <div className="space-y-1.5 text-gray-300">
          <p><span className="text-indigo-400 font-medium">S:</span> API migration project at Series B fintech...</p>
          <p><span className="text-indigo-400 font-medium">T:</span> Needed buy-in from 3 eng leads + VP Sales...</p>
          <p><span className="text-indigo-400 font-medium">A:</span> Built a shared decision matrix with...</p>
          <p><span className="text-indigo-400 font-medium">R:</span> Shipped 2 weeks early, 40% fewer support tickets</p>
        </div>
      </div>
    </div>
  );
}

function MockRolePlay() {
  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800/60 p-5 space-y-3 text-sm shadow-2xl shadow-indigo-500/5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Live Role-Play</span>
      </div>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-xs font-bold text-purple-300">I</div>
        <div className="rounded-lg bg-gray-800/50 border border-gray-700/40 p-3 flex-1">
          <p className="text-gray-300">"How would you handle a POC that's going off the rails with a strategic account?"</p>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 flex-1 max-w-[85%]">
          <p className="text-gray-300">"I'd first align with the AE on what success looks like for the customer, then..."</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-300">Y</div>
      </div>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-xs font-bold text-cyan-300">C</div>
        <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/15 p-3 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-cyan-400 font-bold text-lg">8.5</span>
            <span className="text-xs text-cyan-400/70">/10</span>
          </div>
          <p className="text-gray-400 text-xs">Strong stakeholder awareness. Add a specific metric from a past POC to strengthen credibility.</p>
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
    <div className="rounded-xl bg-gray-900/80 border border-gray-800/60 p-5 space-y-3 text-sm shadow-2xl shadow-indigo-500/5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Skills Scorecard</span>
        <span className="text-xs text-emerald-400 font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">Ready</span>
      </div>
      <div className="space-y-2.5">
        {skills.map((s) => (
          <div key={s.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-300">{s.name}</span>
              <span className="text-gray-400">{s.score}/10</span>
            </div>
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                style={{ width: `${s.score * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between">
        <span className="text-gray-500 text-xs">Overall</span>
        <span className="text-white font-bold text-lg">8.1<span className="text-gray-500 text-sm font-normal">/10</span></span>
      </div>
    </div>
  );
}

/* ── Feature section data ───────────────────────────────────────────── */

const FEATURES = [
  {
    label: "Step 1",
    title: "Instant JD Analysis",
    description: "Paste a job URL or description and get a full breakdown in 30 seconds. Company intel, key skills, culture signals, and how your resume stacks up against the JD.",
    bullets: [
      "Company size, market position & competitors",
      "Resume-vs-JD match with gap analysis",
      "Missing keywords flagged before you apply",
    ],
    mockup: <MockJDAnalysis />,
  },
  {
    label: "Step 2",
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
    label: "Step 3",
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
    label: "Step 4",
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

/* ── Social proof data ──────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Senior SE at Salesforce",
    initials: "SK",
    color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    quote: "I used this for my Stripe final round. The JD analysis caught gaps I would have never addressed. Got the offer.",
  },
  {
    name: "Marcus T.",
    role: "Solutions Architect",
    initials: "MT",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    quote: "The role-play felt surprisingly real. The feedback after each answer was more useful than any mock interview I've done with friends.",
  },
  {
    name: "Priya R.",
    role: "Pre-Sales Engineer at AWS",
    initials: "PR",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    quote: "Went from generic prep to role-specific, interviewer-aware prep. The STAR frameworks saved me hours of writing.",
  },
];

/* ── Main Landing component ─────────────────────────────────────────── */

export default function Landing() {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";
  const ctaLabel = user ? "Go to Dashboard" : "Start Free Session";

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Nav */}
      <header className="border-b border-gray-800/40 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight">
          InterviewPrep<span className="text-indigo-400">AI</span>
        </span>
        <Link
          to={ctaHref}
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {user ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        {/* Animated gradient glow */}
        <div className="absolute inset-0 -top-20 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-cyan-600/10 via-indigo-600/15 to-transparent blur-3xl animate-[pulse_8s_ease-in-out_infinite_1s]" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 text-xs font-medium text-indigo-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-powered interview prep for $100K+ roles
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-5">
            Your interview coach that{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">knows the JD</span>,{" "}
            <br className="hidden sm:block" />
            your interviewers, and your weak spots
          </motion.h1>
          <motion.p variants={fadeUp} className="text-gray-400 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Paste a job URL. Get role analysis, tailored questions, and scored mock interviews
            with real-time feedback -- all in one place.
          </motion.p>
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-4">
            <Link
              to={ctaHref}
              className="rounded-xl bg-indigo-600 px-7 py-3.5 font-semibold text-sm hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/25"
            >
              {ctaLabel}
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-gray-700 px-7 py-3.5 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Social proof line */}
      <div className="text-center text-gray-600 text-sm pb-20">
        Built for Solutions Engineers, SEs, and anyone prepping for multi-round tech interviews.
      </div>

      {/* Feature sections */}
      <div id="features" className="space-y-20 sm:space-y-32 pb-24">
        {FEATURES.map((f, i) => {
          const reversed = i % 2 === 1;
          return (
            <motion.section
              key={f.label}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              variants={stagger}
              className="max-w-6xl mx-auto px-6"
            >
              <div className={`flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-16`}>
                {/* Text */}
                <motion.div variants={fadeUp} className="flex-1 max-w-lg">
                  <span className="inline-block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                    {f.label}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                    {f.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed mb-5">
                    {f.description}
                  </p>
                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-gray-300">
                        <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                {/* Mockup */}
                <motion.div variants={fadeScale} className="flex-1 max-w-md w-full">
                  {f.mockup}
                </motion.div>
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* Social proof */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={stagger}
        className="max-w-5xl mx-auto px-6 pb-24"
      >
        <motion.h2 variants={fadeUp} className="text-center text-2xl font-bold mb-10">
          What early users are saying
        </motion.h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className="rounded-xl bg-gray-900/50 border border-gray-800/50 p-5"
            >
              <p className="text-gray-300 text-sm leading-relaxed mb-4 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${t.color} border flex items-center justify-center text-xs font-bold`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Pricing */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={stagger}
        className="max-w-4xl mx-auto px-6 pb-24"
      >
        <motion.h2 variants={fadeUp} className="text-center text-2xl font-bold mb-10">
          Simple pricing
        </motion.h2>
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <motion.div variants={fadeUp} className="rounded-xl bg-gray-900/50 border border-gray-800/50 p-6">
            <h3 className="text-white font-semibold text-lg mb-1">Free</h3>
            <p className="text-3xl font-bold text-white mb-4">$0<span className="text-gray-500 text-sm font-normal">/forever</span></p>
            <ul className="space-y-2 text-sm text-gray-400 mb-6">
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>2 sessions per day</li>
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Full JD analysis</li>
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Prep + role-play modes</li>
            </ul>
            <Link to={ctaHref} className="block text-center rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors">
              Get started
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="rounded-xl bg-gradient-to-b from-indigo-500/10 to-gray-900/50 border border-indigo-500/30 p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-3 py-0.5">
              Most popular
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">Pro</h3>
            <p className="text-3xl font-bold text-white mb-4">$29<span className="text-gray-500 text-sm font-normal">/month</span></p>
            <ul className="space-y-2 text-sm text-gray-400 mb-6">
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Unlimited sessions</li>
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Everything in Free</li>
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Cross-session progress tracking</li>
              <li className="flex items-center gap-2"><svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Priority support</li>
            </ul>
            <Link to={ctaHref} className="block text-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
              Upgrade to Pro
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/20 p-10">
          <h2 className="text-2xl font-bold mb-3">
            Stop winging your interviews
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Your first two sessions are free. No credit card needed. Start prepping in under a minute.
          </p>
          <Link
            to={ctaHref}
            className="inline-flex rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-sm hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/40 py-6 text-center text-gray-600 text-xs">
        InterviewPrepAI &middot; Built by{" "}
        <a href="https://linkedin.com/in/adammakaoui" target="_blank" rel="noopener" className="text-gray-400 hover:text-white transition-colors">
          Adam Makaoui
        </a>
      </footer>
    </div>
  );
}
