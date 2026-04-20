import { useState, useRef, useEffect } from "react";
import type { Session, Feedback } from "../lib/api";
import { startRoleplay, continueSession, finishSession } from "../lib/api";

interface Props {
  session: Session;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onSessionUpdate: (s: Session) => void;
  submitting: boolean;
}

/** Progress nudge every N questions; live competency scores update every answer (Scorecard tab). */
const CHECKPOINT_INTERVAL = 5;

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
      : score >= 5
      ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
      : "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
  return (
    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl font-bold border ${color}`}>
      {score}
    </span>
  );
}

function FeedbackCard({
  feedback,
  onNext,
  onFinish,
  advancing,
  showCheckpoint,
  allFeedback,
}: {
  feedback: Feedback;
  onNext: () => void;
  onFinish: () => void;
  advancing: boolean;
  showCheckpoint: boolean;
  allFeedback: Feedback[];
}) {
  const [showImproved, setShowImproved] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/60 p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex items-start gap-4">
          <ScoreBadge score={feedback.score} />
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1">Your Score</h3>
            <p className="text-gray-500 dark:text-gray-500 text-xs truncate">{feedback.question}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-500/5 dark:border-emerald-500/15 p-3">
            <h4 className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
              Strengths
            </h4>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-300 text-sm flex items-start gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 shrink-0 text-xs mt-0.5">&#10003;</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200/80 dark:bg-amber-500/5 dark:border-amber-500/15 p-3">
            <h4 className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
              To Improve
            </h4>
            <ul className="space-y-1.5">
              {feedback.improvements.map((s, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-300 text-sm flex items-start gap-1.5">
                  <span className="text-amber-600 dark:text-amber-400 shrink-0 text-xs mt-0.5">!</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg bg-indigo-50 border border-indigo-200/80 dark:bg-indigo-500/5 dark:border-indigo-500/15 p-3">
          <p className="text-indigo-800 dark:text-indigo-300 text-sm">
            <span className="font-medium">Tip:</span> {feedback.tip}
          </p>
        </div>

        {feedback.improved_answer && (
          <div>
            <button
              onClick={() => setShowImproved(!showImproved)}
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              {showImproved ? "Hide improved answer" : "Show a stronger answer"}
            </button>
            {showImproved && (
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 p-3 border border-gray-200 dark:border-gray-700/50 leading-relaxed">
                {feedback.improved_answer}
              </p>
            )}
          </div>
        )}
      </div>

      {showCheckpoint && <CheckpointCard feedback={allFeedback} />}

      <div className="flex gap-3">
        <button
          onClick={onNext}
          disabled={advancing}
          className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-500/20"
        >
          {advancing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
              </div>
              Loading...
            </span>
          ) : (
            "Next Question"
          )}
        </button>
        {showCheckpoint && (
          <button
            onClick={onFinish}
            disabled={advancing}
            className="rounded-xl bg-gray-100 border border-gray-300 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-700 px-5 py-3 font-medium text-sm disabled:opacity-50 transition-colors"
          >
            Finish & See Scorecard
          </button>
        )}
      </div>
    </div>
  );
}

function CheckpointCard({ feedback }: { feedback: Feedback[] }) {
  const scores = feedback.map((f) => f.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
  const secondHalf = scores.slice(Math.ceil(scores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : firstAvg;
  const trend = secondAvg > firstAvg ? "improving" : secondAvg < firstAvg ? "declining" : "steady";

  return (
    <div className="rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/5 dark:border-indigo-500/20 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-indigo-800 dark:text-indigo-300 font-semibold text-sm">
          Progress Check — {feedback.length} Questions
        </h3>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
            trend === "improving"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
              : trend === "declining"
              ? "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400"
              : "bg-gray-200 text-gray-600 dark:bg-gray-800/60 dark:text-gray-500"
          }`}
        >
          {trend === "improving" ? "Improving" : trend === "declining" ? "Needs Focus" : "Steady"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{avg.toFixed(1)}/10</span>
        <div className="flex gap-1">
          {scores.map((s, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center ${
                s >= 8
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : s >= 5
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
                  : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      <p className="text-gray-600 dark:text-gray-500 text-xs">
        {trend === "improving"
          ? "Great progress! Your answers are getting stronger."
          : trend === "declining"
          ? "Consider slowing down and applying the feedback from earlier questions."
          : "Consistent performance. Focus on the improvement areas above."}
      </p>
    </div>
  );
}

export default function ChatWindow({
  session,
  onSubmitAnswer,
  onSessionUpdate,
  submitting,
}: Props) {
  const [input, setInput] = useState("");
  const [switching, setSwitching] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  type ChatMsg = NonNullable<Session["chat_history"]>[number];
  const chat: ChatMsg[] = session.chat_history ?? [];
  const feedbackList = session.feedback ?? [];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, session.status]);

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

  const handleContinue = async () => {
    setAdvancing(true);
    try {
      const updated = await continueSession(session.session_id);
      onSessionUpdate(updated);
    } catch {
      alert("Failed to load next question.");
    } finally {
      setAdvancing(false);
    }
  };

  const handleFinish = async () => {
    setAdvancing(true);
    try {
      const updated = await finishSession(session.session_id);
      onSessionUpdate(updated);
    } catch {
      alert("Failed to generate summary.");
    } finally {
      setAdvancing(false);
    }
  };

  // --- Not in roleplay mode yet ---
  if (session.mode !== "roleplay") {
    return (
      <div className="text-center py-16">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-gray-800 dark:text-gray-300 mb-1.5 font-medium">
            Ready to practice?
          </p>
          <p className="text-gray-600 dark:text-gray-500 text-sm max-w-sm mx-auto mb-6">
            An AI interviewer will ask you each question and a coach will give you real-time feedback and scoring.
          </p>
        </div>
        <button
          onClick={handleStartRoleplay}
          disabled={switching || !session.questions?.length}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-sm text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-500/20"
        >
          {switching ? (
            <>
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
              </div>
              Starting...
            </>
          ) : (
            "Start Practice Interview"
          )}
        </button>
        {!session.questions?.length && (
          <p className="text-xs text-gray-500 dark:text-gray-600 mt-3">
            Questions must be generated first.
          </p>
        )}
      </div>
    );
  }

  // --- Session complete: redirect to scorecard ---
  if (session.summary && session.status === "complete") {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-800 dark:text-gray-300 font-medium mb-1.5">Session Complete</p>
        <p className="text-gray-600 dark:text-gray-500 text-sm">
          Switch to the <span className="text-indigo-600 dark:text-indigo-400 font-medium">Scorecard</span> tab to see your full results and skills breakdown.
        </p>
      </div>
    );
  }

  // --- Reviewing feedback state ---
  if (session.status === "reviewing_feedback" && feedbackList.length > 0) {
    const latestFeedback = feedbackList[feedbackList.length - 1];
    const isCheckpoint =
      feedbackList.length > 0 &&
      feedbackList.length % CHECKPOINT_INTERVAL === 0;

    return (
      <div className="flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {chat
            .filter((msg) => msg.role !== "coach")
            .map((msg: ChatMsg, i: number) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md border border-gray-200 dark:bg-gray-800/80 dark:text-gray-200 dark:border-gray-700/40"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          <div ref={messagesEnd} />
        </div>

        <FeedbackCard
          feedback={latestFeedback}
          onNext={handleContinue}
          onFinish={handleFinish}
          advancing={advancing}
          showCheckpoint={isCheckpoint}
          allFeedback={feedbackList}
        />
      </div>
    );
  }

  // --- Active roleplay chat ---
  // Height strategy: use dynamic viewport units (`dvh`) so the chat resizes correctly when the mobile
  // keyboard opens (vs `vh` which uses the *initial* viewport and leaves the input hidden behind the
  // keyboard on iOS Safari). Cap at 640px on desktop so the panel doesn't sprawl on tall monitors.
  return (
    <div className="flex flex-col h-[min(calc(100dvh-14rem),640px)] min-h-[360px]">
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {chat
          .filter((msg) => msg.role !== "coach")
          .map((msg: ChatMsg, i: number) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md border border-gray-200 dark:bg-gray-800/80 dark:text-gray-200 dark:border-gray-700/40"
                }`}
              >
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
            className="flex-1 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700/50 px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={submitting || !input.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-medium text-sm text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-500/20"
          >
            {submitting ? (
              <div className="relative w-5 h-5">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
              </div>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
