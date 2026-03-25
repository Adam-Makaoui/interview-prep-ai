import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const FEATURES = [
  {
    title: "JD Analysis",
    desc: "Paste a job URL and get company intel, key skills, culture signals, and how you match the JD -- in 30 seconds.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    title: "Tailored Q&A",
    desc: "Stage-specific questions with STAR-method answer frameworks personalized to your resume. Not generic top-10 lists.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    title: "AI Role-Play",
    desc: "Practice with a realistic interviewer persona that adapts to your stage and interviewers. Get scored feedback after every answer.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    title: "Skills Scorecard",
    desc: "Live competency tracking across role-specific dimensions. See where you're strong and what to drill before the real thing.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

export default function Landing() {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";
  const ctaLabel = user ? "Go to Dashboard" : "Start Free Session";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 text-xs font-medium text-indigo-400 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-powered interview prep for $100K+ roles
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-5">
          Your interview coach that{" "}
          <span className="text-indigo-400">knows the JD</span>,{" "}
          <br className="hidden sm:block" />
          your interviewers, and your weak spots
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          Paste a job URL. Get role analysis, tailored questions, and scored mock interviews
          with real-time feedback -- all in one place. Stop googling "top 10 interview questions."
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to={ctaHref}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-sm hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {ctaLabel}
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Social proof placeholder */}
      <div className="text-center text-gray-600 text-sm pb-16">
        Built for Solutions Engineers, SEs, and anyone prepping for multi-round tech interviews.
      </div>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-2xl font-bold mb-12">
          Everything you need in <span className="text-indigo-400">one session</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-gray-900/50 border border-gray-800/50 p-6 hover:border-indigo-500/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                {f.icon}
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/20 p-10">
          <h2 className="text-2xl font-bold mb-3">
            $29/mo to land a $150K+ job
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Your first session is free. No credit card needed. Upgrade when you're ready to drill every round.
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
