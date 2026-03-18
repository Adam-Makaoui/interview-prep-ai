import type { Answer } from "../lib/api";

interface Props {
  answer: Answer;
  index: number;
}

export default function QuestionCard({ answer, index }: Props) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">
            {index + 1}
          </span>
          <div className="space-y-3 w-full">
            <p className="text-white font-medium">{answer.question}</p>

            <div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
