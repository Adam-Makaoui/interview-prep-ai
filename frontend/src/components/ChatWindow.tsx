import { useState, useRef, useEffect } from "react";
import type { Session } from "../lib/api";
import { startRoleplay } from "../lib/api";

interface Props {
  session: Session;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onSessionUpdate: (s: Session) => void;
  submitting: boolean;
}

export default function ChatWindow({ session, onSubmitAnswer, onSessionUpdate, submitting }: Props) {
  const [input, setInput] = useState("");
  const [switching, setSwitching] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  type ChatMsg = NonNullable<Session["chat_history"]>[number];
  const chat: ChatMsg[] = session.chat_history ?? [];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  const handleSend = async () => {
    if (!input.trim() || submitting) return;
    const answer = input.trim();
    setInput("");
    await onSubmitAnswer(answer);
  };

  const handleStartRoleplay = async () => {
    setSwitching(true);
    try {
      const updated = await startRoleplay(session.session_id);
      onSessionUpdate(updated);
    } catch {
      alert("Failed to start role-play. Questions may not have been generated yet.");
    } finally {
      setSwitching(false);
    }
  };

  if (session.mode !== "roleplay") {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-900/40 border border-indigo-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-gray-300 mb-2 font-medium">
            Ready to practice? Start a mock interview based on these questions.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            An AI interviewer will ask you each question and a coach will give you real-time feedback.
          </p>
        </div>
        <button
          onClick={handleStartRoleplay}
          disabled={switching || !session.questions?.length}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {switching ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting Practice...
            </>
          ) : (
            "Start Practice Interview"
          )}
        </button>
        {!session.questions?.length && (
          <p className="text-xs text-gray-600 mt-2">Questions must be generated first.</p>
        )}
      </div>
    );
  }

  if (session.summary && session.status === "complete") {
    const summary = session.summary as Record<string, string | number | string[]>;
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="text-5xl font-bold text-indigo-400 mb-2">
            {String(summary.overall_score)}/10
          </div>
          <div className={`text-lg font-semibold ${
            summary.readiness_level === "ready" ? "text-green-400" :
            summary.readiness_level === "almost there" ? "text-amber-400" :
            "text-red-400"
          }`}>
            {String(summary.readiness_level).toUpperCase()}
          </div>
        </div>

        {Array.isArray(summary.top_strengths) && (
          <section>
            <h3 className="text-sm font-semibold text-green-300 uppercase tracking-wide mb-2">Top Strengths</h3>
            <ul className="space-y-1">
              {(summary.top_strengths as string[]).map((s, i) => (
                <li key={i} className="text-gray-300 text-sm flex gap-2">
                  <span className="text-green-400">+</span> {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(summary.priority_improvements) && (
          <section>
            <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wide mb-2">Priority Improvements</h3>
            <ul className="space-y-1">
              {(summary.priority_improvements as string[]).map((s, i) => (
                <li key={i} className="text-gray-300 text-sm flex gap-2">
                  <span className="text-amber-400">!</span> {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.final_advice && (
          <section>
            <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wide mb-2">Final Advice</h3>
            <p className="text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-800">
              {String(summary.final_advice)}
            </p>
          </section>
        )}

        {session.feedback?.length ? (
          <section>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Question Breakdown</h3>
            <div className="space-y-3">
              {session.feedback.map((f, i) => (
                <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-white font-medium text-sm">{f.question}</p>
                    <span className={`text-sm font-bold shrink-0 ml-3 ${
                      f.score >= 8 ? "text-green-400" : f.score >= 5 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {f.score}/10
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mb-1">Your answer: {f.user_answer}</p>
                  <p className="text-gray-400 text-xs">Tip: {f.tip}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {chat.map((msg: ChatMsg, i: number) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : msg.role === "coach"
                  ? "bg-amber-900/40 text-amber-100 border border-amber-800 rounded-bl-md"
                  : "bg-gray-800 text-gray-200 rounded-bl-md"
              }`}
            >
              {msg.role === "coach" && (
                <span className="text-xs font-semibold text-amber-300 uppercase block mb-1">
                  Coach Feedback
                </span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {session.status === "awaiting_answer" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type your answer..."
            disabled={submitting}
            className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={submitting || !input.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              "Send"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
