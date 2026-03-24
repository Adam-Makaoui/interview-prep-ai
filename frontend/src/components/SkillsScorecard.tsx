import type { Session } from "../lib/api";

interface SkillEntry {
  skill: string;
  score: number;
  note: string;
}

interface ScorecardDimension {
  key: string;
  label: string;
  why_it_matters?: string;
}

const SKILL_COLORS = [
  { bar: "bg-indigo-500", text: "text-indigo-400" },
  { bar: "bg-cyan-500", text: "text-cyan-400" },
  { bar: "bg-emerald-500", text: "text-emerald-400" },
  { bar: "bg-amber-500", text: "text-amber-400" },
  { bar: "bg-purple-500", text: "text-purple-400" },
  { bar: "bg-rose-500", text: "text-rose-400" },
  { bar: "bg-teal-500", text: "text-teal-400" },
];

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-amber-400";
  return "text-red-400";
}

function readinessGradient(level: string) {
  switch (level) {
    case "ready":
      return "from-emerald-500 to-emerald-600";
    case "almost there":
      return "from-amber-500 to-amber-600";
    case "needs work":
      return "from-orange-500 to-orange-600";
    default:
      return "from-red-500 to-red-600";
  }
}

interface Props {
  session: Session;
}

export default function SkillsScorecard({ session }: Props) {
  const analysis = session.analysis as Record<string, unknown> | null;
  const dimensions = (Array.isArray(analysis?.scorecard_dimensions)
    ? analysis!.scorecard_dimensions
    : []) as ScorecardDimension[];

  const summary = session.summary as Record<string, unknown> | null;
  const skillAvgs = session.skill_averages || {};
  const hasLiveScores =
    Object.keys(skillAvgs).length > 0 ||
    (session.feedback && session.feedback.length > 0);

  const isComplete =
    session.status === "complete" &&
    summary &&
    summary.message == null;

  /* --- Empty: no dimensions yet --- */
  if (!dimensions.length) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4 border border-gray-700/40">
          <svg
            className="w-7 h-7 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <p className="text-gray-400 font-medium mb-1">Scorecard loads after analysis</p>
        <p className="text-gray-600 text-sm max-w-xs mx-auto">
          Finish session setup. Role-specific competency rows appear here; they update
          after each role-play answer.
        </p>
      </div>
    );
  }

  const overallScore = isComplete ? Number(summary!.overall_score) || 0 : 0;
  const readiness = isComplete
    ? String(summary!.readiness_level || "needs work")
    : "";
  const topStrengths = isComplete && Array.isArray(summary!.top_strengths)
    ? (summary!.top_strengths as string[])
    : [];
  const improvements =
    isComplete && Array.isArray(summary!.priority_improvements)
      ? (summary!.priority_improvements as string[])
      : [];
  const advice = isComplete ? String(summary!.final_advice || "") : "";
  const finalSkills =
    isComplete && Array.isArray(summary!.skills_breakdown)
      ? (summary!.skills_breakdown as SkillEntry[])
      : [];

  return (
    <div className="space-y-8">
      {/* Live session scores — always show when we have dimensions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            This session (live)
          </h3>
          {hasLiveScores && session.mode === "roleplay" && (
            <span className="text-[11px] text-cyan-400/80">
              Updates after each answer
            </span>
          )}
        </div>
        <div className="space-y-3">
          {dimensions.map((d, i) => {
            const color = SKILL_COLORS[i % SKILL_COLORS.length];
            const avg = skillAvgs[d.key];
            const has = typeof avg === "number";
            return (
              <div
                key={d.key}
                className="rounded-xl bg-gray-900/60 border border-gray-800/50 p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{d.label}</span>
                  {has ? (
                    <span className={`text-sm font-bold ${scoreColor(avg)}`}>
                      {avg.toFixed(1)}/10
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>
                <div className="w-full h-2 rounded-full bg-gray-800/80 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${color.bar} transition-all duration-500`}
                    style={{
                      width: has ? `${(avg / 10) * 100}%` : "0%",
                    }}
                  />
                </div>
                {d.why_it_matters && (
                  <p className="text-gray-600 text-xs">{d.why_it_matters}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* All-time placeholder */}
      <section className="rounded-xl border border-dashed border-gray-700/50 bg-gray-900/30 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          General / all-time trend
        </h3>
        <p className="text-gray-600 text-sm">
          Cross-session competency trends need a saved profile (Phase 2). For now, use
          &quot;This session&quot; to track how you perform on this role&apos;s dimensions.
        </p>
      </section>

      {/* Final summary (after role-play complete) */}
      {isComplete && (
        <>
          <div className="rounded-2xl bg-gray-900/60 border border-gray-800/60 p-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 mb-4">
              <span className={`text-3xl font-bold ${scoreColor(overallScore)}`}>
                {overallScore}
              </span>
              <span className="text-gray-600 text-lg font-light">/10</span>
            </div>
            <div
              className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold bg-gradient-to-r ${readinessGradient(readiness)} text-white`}
            >
              {readiness.toUpperCase()}
            </div>
            <p className="text-gray-500 text-sm mt-2">
              Based on {session.feedback?.length || 0} practice questions
            </p>
          </div>

          {finalSkills.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Final skills breakdown
              </h3>
              <div className="space-y-3">
                {finalSkills.map((s, i) => {
                  const color = SKILL_COLORS[i % SKILL_COLORS.length];
                  return (
                    <div
                      key={i}
                      className="rounded-xl bg-gray-900/60 border border-gray-800/50 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{s.skill}</span>
                        <span className={`text-sm font-bold ${scoreColor(s.score)}`}>
                          {s.score}/10
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-800/80 overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full ${color.bar}`}
                          style={{ width: `${(s.score / 10) * 100}%` }}
                        />
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed">{s.note}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topStrengths.length > 0 && (
              <section className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                  Top Strengths
                </h3>
                <ul className="space-y-2">
                  {topStrengths.map((s, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 text-xs shrink-0">
                        &#10003;
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {improvements.length > 0 && (
              <section className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                  Priority Improvements
                </h3>
                <ul className="space-y-2">
                  {improvements.map((s, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5 text-xs shrink-0">!</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {advice && (
            <section className="rounded-xl bg-gray-900/60 border border-gray-800/60 p-5">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Final Advice
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{advice}</p>
            </section>
          )}

          {session.feedback && session.feedback.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Question Breakdown
              </h3>
              <div className="space-y-2">
                {session.feedback.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-900/50 border border-gray-800/50 p-4 flex items-start gap-3"
                  >
                    <span
                      className={`text-sm font-bold shrink-0 mt-0.5 ${scoreColor(f.score)}`}
                    >
                      {f.score}/10
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{f.question}</p>
                      <p className="text-gray-600 text-xs mt-1 line-clamp-1">{f.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {!isComplete && session.mode === "roleplay" && !hasLiveScores && (
        <p className="text-center text-gray-600 text-sm">
          Answer a question in Role-Play to see scores fill in here.
        </p>
      )}
    </div>
  );
}
