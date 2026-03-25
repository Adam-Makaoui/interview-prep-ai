import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSession, submitAnswer, type Session } from "../lib/api";
import ChatWindow from "../components/ChatWindow";
import QuestionCard, { QuestionOnlyCard } from "../components/QuestionCard";
import SkillsScorecard from "../components/SkillsScorecard";

const TABS = ["Analysis", "Q&A", "Role-Play", "Scorecard"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, JSX.Element> = {
  Analysis: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  "Q&A": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  "Role-Play": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  ),
  Scorecard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  complete: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Complete" },
  awaiting_answer: { dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-400", label: "Awaiting Answer" },
  reviewing_feedback: { dot: "bg-cyan-400", bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Reviewing Feedback" },
  processing: { dot: "bg-blue-400", bg: "bg-blue-500/10", text: "text-blue-400", label: "Processing" },
  analyzing: { dot: "bg-indigo-400", bg: "bg-indigo-500/10", text: "text-indigo-400", label: "Analyzing" },
};

export default function PrepDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("Analysis");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSession(id).then((s) => {
      setSession(s);
      setLoading(false);
      if (
        s.mode === "roleplay" &&
        (s.status === "awaiting_answer" || s.status === "reviewing_feedback")
      ) {
        setTab("Role-Play");
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id || !session) return;
    const needsPolling =
      session.mode === "prep" &&
      session.questions?.length &&
      !session.answers?.length;
    if (!needsPolling) return;

    const interval = setInterval(async () => {
      try {
        const updated = await getSession(id);
        setSession(updated);
        if (updated.answers?.length) clearInterval(interval);
      } catch {
        /* ignore transient errors */
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, session?.questions?.length, session?.answers?.length, session?.mode]);

  const handleAnswer = async (answer: string) => {
    if (!id) return;
    setSubmitting(true);
    try {
      const updated = await submitAnswer(id, answer);
      setSession(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSessionUpdate = (updated: Session) => {
    setSession(updated);
    if (updated.status === "complete" && updated.summary) {
      setTab("Scorecard");
    } else {
      setTab("Role-Play");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-gray-800" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
          </div>
          <p className="text-gray-500 text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-500">Session not found</div>
    );
  }

  const analysis = session.analysis as Record<string, unknown> | null;
  const statusCfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.processing;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      {/* Breadcrumb */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-400 transition-colors mb-6 group"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Sessions
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {session.role}{" "}
          <span className="text-gray-500 font-normal">at</span>{" "}
          <span className="text-indigo-400">{session.company}</span>
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-800/80 text-gray-300 border border-gray-700/50">
            {session.stage.replace(/_/g, " ")}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${
            session.mode === "roleplay"
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
          }`}>
            {session.mode === "roleplay" ? "Role-Play" : "Prep"}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5 ${statusCfg.bg} ${statusCfg.text} border border-current/10`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} animate-pulse`} />
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Pill Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900/80 rounded-xl border border-gray-800/60 mb-8 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === t
                ? "bg-gray-800 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/40"
            }`}
          >
            {TAB_ICONS[t]}
            {t}
          </button>
        ))}
      </div>

      {/* Analysis Tab */}
      {tab === "Analysis" && analysis && (
        <div className="space-y-6">
          {analysis.role_focus && (
            <section className="rounded-xl bg-gray-900/60 border border-gray-800/60 p-5">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Role Focus
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {String(analysis.role_focus)}
              </p>
            </section>
          )}

          {analysis.company_intel && typeof analysis.company_intel === "object" && (
            <section className="rounded-xl bg-gray-900/60 border border-gray-800/60 p-5 space-y-4">
              <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                Company snapshot
              </h2>
              <p className="text-gray-600 text-xs mb-3">
                Best-effort from JD and web snippets — verify before citing in interview.
              </p>
              {(() => {
                const ci = analysis.company_intel as Record<string, unknown>;
                return (
                  <>
                    {(ci.employee_size_band || ci.market_position) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {ci.employee_size_band && (
                          <div className="rounded-lg bg-gray-800/40 border border-gray-700/40 p-3">
                            <span className="text-gray-500 text-xs uppercase">Size band</span>
                            <p className="text-gray-200 mt-1">{String(ci.employee_size_band)}</p>
                          </div>
                        )}
                        {ci.market_position && (
                          <div className="rounded-lg bg-gray-800/40 border border-gray-700/40 p-3 sm:col-span-2">
                            <span className="text-gray-500 text-xs uppercase">Market position</span>
                            <p className="text-gray-300 mt-1 text-sm leading-relaxed">
                              {String(ci.market_position)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {Array.isArray(ci.competitors) && (ci.competitors as { name?: string; one_liner?: string }[]).length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Competitors & alternatives
                        </h3>
                        <ul className="space-y-2">
                          {(ci.competitors as { name?: string; one_liner?: string }[]).map((c, i) => (
                            <li
                              key={i}
                              className="rounded-lg border border-gray-800/60 bg-gray-950/40 px-3 py-2"
                            >
                              <span className="text-white text-sm font-medium">{c.name}</span>
                              {c.one_liner && (
                                <p className="text-gray-500 text-xs mt-0.5">{c.one_liner}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ci.data_quality_note && (
                      <p className="text-gray-600 text-xs">{String(ci.data_quality_note)}</p>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          {analysis.jd_fit && typeof analysis.jd_fit === "object" && (
            <section className="rounded-xl border border-gray-800/60 overflow-hidden">
              <div className="px-5 py-3 bg-gray-900/80 border-b border-gray-800/60">
                <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  How you match this job description
                </h2>
                <p className="text-gray-600 text-xs mt-1">
                  Resume vs JD — strengths, gaps, and risks to address in prep.
                </p>
              </div>
              <div className="p-5 space-y-4 grid md:grid-cols-2 gap-4">
                {(() => {
                  const j = analysis.jd_fit as Record<string, unknown>;
                  const list = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
                  return (
                    <>
                      {list(j.aligned_strengths).length > 0 && (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-4">
                          <h3 className="text-[11px] font-semibold text-emerald-400 uppercase mb-2">Aligned</h3>
                          <ul className="space-y-1.5 text-sm text-gray-300">
                            {list(j.aligned_strengths).map((t, i) => (
                              <li key={i} className="flex gap-2"><span className="text-emerald-500">+</span>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {list(j.gaps_vs_jd).length > 0 && (
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-4">
                          <h3 className="text-[11px] font-semibold text-amber-400 uppercase mb-2">Gaps vs JD</h3>
                          <ul className="space-y-1.5 text-sm text-gray-300">
                            {list(j.gaps_vs_jd).map((t, i) => (
                              <li key={i} className="flex gap-2"><span className="text-amber-500">!</span>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {list(j.risk_areas).length > 0 && (
                        <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-4 md:col-span-2">
                          <h3 className="text-[11px] font-semibold text-red-400 uppercase mb-2">Risk areas</h3>
                          <ul className="space-y-1.5 text-sm text-gray-300">
                            {list(j.risk_areas).map((t, i) => (
                              <li key={i} className="flex gap-2"><span className="text-red-400">−</span>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {list(j.missing_keywords).length > 0 && (
                        <div className="md:col-span-2 flex flex-wrap gap-2">
                          <span className="text-xs text-gray-500 w-full">JD keywords light on resume:</span>
                          {list(j.missing_keywords).map((kw, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 border border-gray-700">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </section>
          )}

          {Array.isArray(analysis.key_skills) && (
            <section>
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Key Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {(analysis.key_skills as unknown as string[]).map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-gray-900/60 text-sm text-gray-300 border border-gray-800/60"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(analysis.culture_signals) && (
            <section className="rounded-xl bg-gray-900/60 border border-gray-800/60 p-5">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Culture Signals
              </h2>
              <ul className="space-y-2">
                {(analysis.culture_signals as unknown as string[]).map((s, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2.5">
                    <span className="text-indigo-500 mt-0.5 text-xs">&#9679;</span>{s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {Array.isArray(analysis.interview_tips) && (
            <section>
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Interview Tips
              </h2>
              <div className="grid gap-3">
                {(analysis.interview_tips as unknown as string[]).map((tip, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-900/60 border border-gray-800/60 p-4 text-gray-300 text-sm leading-relaxed"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(analysis.interviewer_focus) && (
            <section>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                Interviewer Focus Areas
              </h2>
              <div className="grid gap-3">
                {(analysis.interviewer_focus as unknown as string[]).map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-amber-900/10 border border-amber-800/30 p-4 text-gray-300 text-sm leading-relaxed"
                  >
                    {f}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "Analysis" && !analysis && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-800/60 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Analysis not available yet.</p>
        </div>
      )}

      {/* Q&A Tab */}
      {tab === "Q&A" && (
        <div className="space-y-3">
          {!session.answers?.length && session.questions?.length && (
            <div className="flex items-center gap-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 px-4 py-3 mb-1">
              <div className="relative w-4 h-4 shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-800" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin" />
              </div>
              <span className="text-sm text-indigo-300/80">
                Drafting answer frameworks... Questions are ready below.
              </span>
            </div>
          )}
          {session.answers?.length ? (
            session.answers.map((a, i) => (
              <QuestionCard
                key={i}
                answer={a}
                question={session.questions?.[i]}
                index={i}
              />
            ))
          ) : session.questions?.length ? (
            session.questions.map((q, i) => (
              <QuestionOnlyCard key={i} question={q} index={i} />
            ))
          ) : (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-gray-800/60 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No questions generated yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Role-Play Tab */}
      {tab === "Role-Play" && (
        <ChatWindow
          session={session}
          onSubmitAnswer={handleAnswer}
          onSessionUpdate={handleSessionUpdate}
          submitting={submitting}
        />
      )}

      {/* Scorecard Tab */}
      {tab === "Scorecard" && (
        <SkillsScorecard session={session} />
      )}
    </main>
  );
}
