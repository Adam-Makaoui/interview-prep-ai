import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSession, submitAnswer, type Session } from "../lib/api";
import ChatWindow from "../components/ChatWindow";
import QuestionCard, { QuestionOnlyCard } from "../components/QuestionCard";

const TABS = ["Analysis", "Q&A", "Role-Play"] as const;
type Tab = (typeof TABS)[number];

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
    setTab("Role-Play");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-indigo-400 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-400">Session not found</div>
    );
  }

  const analysis = session.analysis as Record<
    string,
    string | string[]
  > | null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-400 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sessions
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {session.role} <span className="text-gray-400">at</span>{" "}
          {session.company}
        </h1>
        <div className="flex gap-3 mt-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-900/60 text-indigo-300">
            {session.stage.replace(/_/g, " ")}
          </span>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              session.mode === "roleplay"
                ? "bg-purple-900/60 text-purple-300"
                : "bg-indigo-900/60 text-indigo-300"
            }`}
          >
            {session.mode === "roleplay" ? "role-play" : "prep"}
          </span>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              session.status === "complete"
                ? "bg-green-900/60 text-green-300"
                : session.status === "awaiting_answer"
                ? "bg-amber-900/60 text-amber-300"
                : session.status === "reviewing_feedback"
                ? "bg-cyan-900/60 text-cyan-300"
                : "bg-blue-900/60 text-blue-300"
            }`}
          >
            {session.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className="flex border-b border-gray-800 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Analysis" && analysis && (
        <div className="space-y-6">
          {analysis.role_focus && (
            <section>
              <h2 className="text-lg font-semibold mb-2 text-indigo-300">
                Role Focus
              </h2>
              <p className="text-gray-300 bg-gray-900 rounded-lg p-4">
                {String(analysis.role_focus)}
              </p>
            </section>
          )}

          {Array.isArray(analysis.key_skills) && (
            <section>
              <h2 className="text-lg font-semibold mb-2 text-indigo-300">
                Key Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {(analysis.key_skills as string[]).map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-gray-800 text-sm text-gray-200 border border-gray-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(analysis.culture_signals) && (
            <section>
              <h2 className="text-lg font-semibold mb-2 text-indigo-300">
                Culture Signals
              </h2>
              <ul className="space-y-1">
                {(analysis.culture_signals as string[]).map((s, i) => (
                  <li
                    key={i}
                    className="text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-indigo-400 mt-1">&#8226;</span> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {Array.isArray(analysis.interview_tips) && (
            <section>
              <h2 className="text-lg font-semibold mb-2 text-indigo-300">
                Interview Tips
              </h2>
              <div className="space-y-2">
                {(analysis.interview_tips as string[]).map((tip, i) => (
                  <div
                    key={i}
                    className="bg-gray-900 rounded-lg p-3 text-gray-300 text-sm border border-gray-800"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(analysis.interviewer_focus) && (
            <section>
              <h2 className="text-lg font-semibold mb-2 text-amber-300">
                Interviewer Focus Areas
              </h2>
              <div className="space-y-2">
                {(analysis.interviewer_focus as string[]).map((f, i) => (
                  <div
                    key={i}
                    className="bg-gray-900 rounded-lg p-3 text-gray-300 text-sm border border-amber-900/40"
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
        <p className="text-gray-500">Analysis not available yet.</p>
      )}

      {tab === "Q&A" && (
        <div className="space-y-4">
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
            <p className="text-gray-500">No questions generated yet.</p>
          )}
        </div>
      )}

      {tab === "Role-Play" && (
        <ChatWindow
          session={session}
          onSubmitAnswer={handleAnswer}
          onSessionUpdate={handleSessionUpdate}
          submitting={submitting}
        />
      )}
    </main>
  );
}
