import { useState } from "react";
import type { Answer, Question } from "../lib/api";

const THEME_COLORS: Record<string, string> = {
  "Technical Depth": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  "Soft Skills & Communication": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20",
  "Leadership & Management": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  "Problem Solving": "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20",
  "Culture Fit & Motivation": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  "Stakeholder Management": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  "Strategic Thinking": "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  "Partnership & Collaboration": "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20",
  "Domain Knowledge": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  "Self-Awareness & Growth": "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
};

function themeBadge(theme: string) {
  const cls = THEME_COLORS[theme] || "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${cls}`}>
      {theme}
    </span>
  );
}

interface AnswerCardProps {
  answer: Answer;
  question?: Question;
  index: number;
}

export default function QuestionCard({ answer, question, index }: AnswerCardProps) {
  const [open, setOpen] = useState(false);

  const theme = question?.theme || "";
  const category = question?.category || "";
  const askedBy = question?.likely_asked_by;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      open
        ? "bg-white border-gray-300 shadow-lg shadow-gray-200/50 dark:bg-gray-900/80 dark:border-gray-700/60 dark:shadow-black/20"
        : "bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-800/50 hover:border-gray-300 dark:hover:border-gray-700/50 hover:shadow-md hover:shadow-gray-200/40 dark:hover:shadow-black/10"
    }`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors"
      >
        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-gray-900 dark:text-white font-medium text-[15px] leading-snug">{answer.question}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {theme && themeBadge(theme)}
            {category && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700/40">
                {category}
              </span>
            )}
            {askedBy && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                {askedBy}
              </span>
            )}
            {answer.timing_guidance && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1 ml-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {answer.timing_guidance}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 shrink-0 mt-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="h-px bg-gray-200 dark:bg-gray-800/60" />

          <section>
            <h4 className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
              Answer Framework
            </h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {answer.answer_framework}
            </p>
          </section>

          <section>
            <h4 className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
              Key Points
            </h4>
            <ul className="space-y-1.5">
              {answer.key_points.map((p, i) => (
                <li key={i} className="text-gray-600 dark:text-gray-400 text-sm flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5 text-xs">&#10003;</span>{p}
                </li>
              ))}
            </ul>
          </section>

          {answer.response_strategy && (
            <section className="rounded-lg bg-yellow-50 border border-yellow-200/80 dark:bg-yellow-500/5 dark:border-yellow-500/15 p-3.5">
              <h4 className="text-[11px] font-semibold text-yellow-800 dark:text-yellow-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Strategy
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {answer.response_strategy}
              </p>
            </section>
          )}

          {answer.example_to_use && (
            <section>
              <h4 className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                Example to Use
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{answer.example_to_use}</p>
            </section>
          )}

          {answer.avoid && (
            <section>
              <h4 className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                Avoid
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{answer.avoid}</p>
            </section>
          )}

          {answer.red_flags && answer.red_flags.length > 0 && (
            <section className="rounded-lg bg-red-50 border border-red-200/80 dark:bg-red-500/5 dark:border-red-500/15 p-3.5">
              <h4 className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Red Flags
              </h4>
              <ul className="space-y-1.5">
                {answer.red_flags.map((f, i) => (
                  <li key={i} className="text-red-800 dark:text-red-300/70 text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 text-xs">&#10007;</span>{f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

interface QuestionOnlyCardProps {
  question: Question;
  index: number;
}

export function QuestionOnlyCard({ question, index }: QuestionOnlyCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      open
        ? "bg-white border-gray-300 dark:bg-gray-900/80 dark:border-gray-700/60 shadow-md dark:shadow-none"
        : "bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-800/50 hover:border-gray-300 dark:hover:border-gray-700/50 hover:shadow-md dark:hover:shadow-black/10"
    }`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors"
      >
        <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700/40">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-gray-900 dark:text-white font-medium text-[15px] leading-snug">{question.question}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {question.theme && themeBadge(question.theme)}
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700/40">
              {question.category}
            </span>
            {question.likely_asked_by && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                {question.likely_asked_by}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 shrink-0 mt-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4">
          <div className="h-px bg-gray-200 dark:bg-gray-800/60 mb-3" />
          <p className="text-gray-600 dark:text-gray-500 text-sm leading-relaxed">{question.why_asked}</p>
        </div>
      )}
    </div>
  );
}
