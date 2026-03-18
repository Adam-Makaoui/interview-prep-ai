import { useState } from "react";
import type { Answer, Question } from "../lib/api";

const THEME_COLORS: Record<string, string> = {
  "Technical Depth": "bg-blue-900/50 text-blue-300 border-blue-800",
  "Soft Skills & Communication": "bg-pink-900/50 text-pink-300 border-pink-800",
  "Leadership & Management": "bg-purple-900/50 text-purple-300 border-purple-800",
  "Problem Solving": "bg-cyan-900/50 text-cyan-300 border-cyan-800",
  "Culture Fit & Motivation": "bg-green-900/50 text-green-300 border-green-800",
  "Stakeholder Management": "bg-orange-900/50 text-orange-300 border-orange-800",
  "Strategic Thinking": "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  "Partnership & Collaboration": "bg-teal-900/50 text-teal-300 border-teal-800",
  "Domain Knowledge": "bg-amber-900/50 text-amber-300 border-amber-800",
  "Self-Awareness & Growth": "bg-rose-900/50 text-rose-300 border-rose-800",
};

function themeBadge(theme: string) {
  const cls = THEME_COLORS[theme] || "bg-gray-800 text-gray-300 border-gray-700";
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${cls}`}>
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
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden transition-all">
      {/* Collapsed header -- always visible */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-white font-medium">{answer.question}</p>
          <div className="flex flex-wrap items-center gap-2">
            {theme && themeBadge(theme)}
            {category && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                {category}
              </span>
            )}
            {askedBy && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                Likely: {askedBy}
              </span>
            )}
            {answer.timing_guidance && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {answer.timing_guidance}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-gray-800">
          <div className="pt-4">
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wide mb-1">
              Answer Framework
            </h4>
            <p className="text-gray-300 text-sm leading-relaxed">
              {answer.answer_framework}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wide mb-1">
              Key Points
            </h4>
            <ul className="space-y-1">
              {answer.key_points.map((p, i) => (
                <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">&#10003;</span> {p}
                </li>
              ))}
            </ul>
          </div>

          {answer.response_strategy && (
            <div>
              <h4 className="text-xs font-semibold text-yellow-300 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Response Strategy
              </h4>
              <p className="text-gray-300 text-sm bg-yellow-900/20 rounded-lg px-3 py-2 border border-yellow-900/30">
                {answer.response_strategy}
              </p>
            </div>
          )}

          {answer.example_to_use && (
            <div>
              <h4 className="text-xs font-semibold text-green-300 uppercase tracking-wide mb-1">
                Example to Use
              </h4>
              <p className="text-gray-400 text-sm">{answer.example_to_use}</p>
            </div>
          )}

          {answer.avoid && (
            <div>
              <h4 className="text-xs font-semibold text-red-300 uppercase tracking-wide mb-1">
                Avoid
              </h4>
              <p className="text-gray-400 text-sm">{answer.avoid}</p>
            </div>
          )}

          {answer.red_flags && answer.red_flags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Red Flags
              </h4>
              <ul className="space-y-1">
                {answer.red_flags.map((f, i) => (
                  <li key={i} className="text-red-300/80 text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">&#10007;</span> {f}
                  </li>
                ))}
              </ul>
            </div>
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
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-white font-medium">{question.question}</p>
          <div className="flex flex-wrap items-center gap-2">
            {question.theme && themeBadge(question.theme)}
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {question.category}
            </span>
            {question.likely_asked_by && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                Likely: {question.likely_asked_by}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-0 border-t border-gray-800">
          <p className="text-gray-500 text-sm pt-3">{question.why_asked}</p>
        </div>
      )}
    </div>
  );
}
