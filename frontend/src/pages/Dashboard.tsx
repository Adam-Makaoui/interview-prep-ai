import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSessions, deleteSession, type Session } from "../lib/api";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

const STAGE_LABELS: Record<string, string> = {
  phone_screen: "Phone Screen",
  recruiter_screen: "Recruiter Screen",
  hiring_manager: "Hiring Manager",
  technical: "Technical",
  behavioral: "Behavioral",
  final_panel: "Final Panel",
  vp_round: "VP Round",
};

const STATUS_DOT: Record<string, string> = {
  complete: "bg-emerald-400",
  awaiting_answer: "bg-amber-400",
  reviewing_feedback: "bg-cyan-400",
  processing: "bg-blue-400",
  analyzing: "bg-indigo-400",
};

// HeroIllustration component for the dashboard page.
function HeroIllustration() {
  return (
    <div className="relative w-20 h-20 mx-auto mb-5">
      <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 dark:border-indigo-500/30 animate-pulse" />
      <svg
        className="relative w-20 h-20 text-indigo-600 dark:text-indigo-400/90 p-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.25}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.051.282-4.026.4-6.378.4s-4.327-.118-6.378-.4c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.49.08-1.11.08-1.75 0m1.75 0v-4.5m0 4.5c0 .667-.167 1.167-.458 1.5M12 8.25v.75m0 0v-.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125v.375m-8.25 3h7.5m-7.5 3h3.375c.621 0 1.125.504 1.125 1.125v.75m0 0H3.375m1.125-.75H3m.375.75v.375c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125v-.375m-10.5 0h10.5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
          className="opacity-40"
        />
      </svg>
    </div>
  );
}

// SessionCard component for the dashboard page.
function SessionCard({
  s,
  onDelete,
}: {
  s: Session;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-800/50 dark:bg-gray-950/40 dark:shadow-none dark:hover:border-indigo-500/30 dark:hover:bg-gray-900/60 transition-all duration-200 group">
      <Link
        to={`/app/prep/${s.session_id}`}
        className="block p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300 transition-colors truncate">
              {s.role || "Untitled Role"}{" "}
              <span className="text-gray-400 dark:text-gray-600 font-normal">·</span>{" "}
              <span className="text-gray-500 dark:text-gray-400 font-normal">{STAGE_LABELS[s.stage] || s.stage}</span>
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  s.mode === "roleplay"
                    ? "bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                    : "bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
                }`}
              >
                {s.mode === "roleplay" ? "Role-Play" : "Prep"}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-500 dark:border-gray-700/30 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] || "bg-gray-500"}`}
                />
                {s.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          {s.created_at && (
            <span className="text-xs text-gray-500 dark:text-gray-600 shrink-0 pr-7">
              {new Date(s.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </Link>

      {/* Delete button */}
      {!confirming ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            setConfirming(true);
          }}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:text-gray-600 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all"
          title="Delete session"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      ) : (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg px-2 py-1.5 shadow-lg z-10">
          <span className="text-xs text-gray-600 dark:text-gray-400">Delete?</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(s.session_id);
            }}
            className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setConfirming(false);
            }}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
    } catch {
      // Silently handle -- could add a toast later
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = (s.pipeline_group || "general").trim() || "general";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    const entries = Array.from(m.entries()).map(([pipeline_group, items]) => {
      items.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
      const displayName =
        items[0]?.company?.trim() ||
        (pipeline_group === "general" ? "Other sessions" : pipeline_group);
      return { pipeline_group, displayName, items };
    });
    entries.sort(
      (a, b) =>
        new Date(b.items[0]?.created_at || 0).getTime() -
        new Date(a.items[0]?.created_at || 0).getTime()
    );
    return entries;
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Your prep hub"
        description={
          sessions.length === 0
            ? "Start a session to get job description analysis, Q&A frameworks, and mock interview scoring."
            : `${sessions.length} session${sessions.length > 1 ? "s" : ""} · grouped by hiring pipeline`
        }
        action={
          sessions.length > 0 ? (
            <Button asChild size="sm">
              <Link to="/app/new">New session</Link>
            </Button>
          ) : undefined
        }
      />

      {sessions.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-indigo-300/70 bg-indigo-50/60 px-6 py-20 text-center shadow-sm dark:border-indigo-500/25 dark:bg-indigo-500/10">
          <div className="pointer-events-none absolute inset-x-16 top-0 h-24 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-400/20" />
          <HeroIllustration />
          <p className="relative text-2xl font-semibold tracking-tight text-foreground mb-2">
            Prep smarter for your next interview
          </p>
          <p className="relative text-muted-foreground text-sm mb-7 max-w-md mx-auto">
            Paste a job description, get role-specific questions and answer frameworks, then
            practice with scored role-play.
          </p>
          <Button asChild size="lg" className="relative min-h-12 px-6 text-base shadow-lg shadow-indigo-500/20">
            <Link to="/app/new">Create your first prep session</Link>
          </Button>
          <p className="relative mt-3 text-xs text-muted-foreground">
            Paste a role. Get questions. Practice with feedback.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ pipeline_group, displayName, items }) => (
            <section key={pipeline_group}>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-px flex-1 bg-border max-w-[40px]" />
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  {displayName}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {items.length} round{items.length > 1 ? "s" : ""}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2 pl-0 sm:pl-2 border-l-2 border-indigo-300 dark:border-indigo-500/20 ml-1">
                {items.map((s) => (
                  <SessionCard key={s.session_id} s={s} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
