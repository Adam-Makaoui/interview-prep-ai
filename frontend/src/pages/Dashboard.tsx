import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSessions, type Session } from "../lib/api";

const STAGE_LABELS: Record<string, string> = {
  phone_screen: "Phone Screen",
  technical: "Technical",
  behavioral: "Behavioral",
  final_panel: "Final Panel",
};

/**
 * Fetches and displays all sessions as clickable cards.
 * Uses {@link listSessions} from api.ts.
 */
export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin h-8 w-8 text-indigo-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Sessions</h1>
          <p className="text-gray-400 mt-1">
            {sessions.length === 0
              ? "No sessions yet. Create one to get started."
              : `${sessions.length} session${sessions.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          to="/new"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-500 text-lg mb-4">Ready to prep for your next interview?</p>
          <Link
            to="/new"
            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Create Your First Session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <Link
              key={s.session_id}
              to={`/prep/${s.session_id}`}
              className="block bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-indigo-500/50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                    {s.role || "Untitled Role"}{" "}
                    <span className="text-gray-500 font-normal">at</span>{" "}
                    {s.company || "Unknown Company"}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                      {STAGE_LABELS[s.stage] || s.stage}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.mode === "roleplay"
                        ? "bg-purple-900/50 text-purple-300 border border-purple-800"
                        : "bg-indigo-900/50 text-indigo-300 border border-indigo-800"
                    }`}>
                      {s.mode === "roleplay" ? "Role-Play" : "Prep"}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.status === "complete"
                        ? "bg-green-900/50 text-green-300 border border-green-800"
                        : s.status === "awaiting_answer"
                        ? "bg-amber-900/50 text-amber-300 border border-amber-800"
                        : "bg-blue-900/50 text-blue-300 border border-blue-800"
                    }`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                {s.created_at && (
                  <span className="text-xs text-gray-600 shrink-0 ml-4">
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
