import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  createSessionStream,
  extractFields,
  lookupInterviewer,
  getResume,
  getSavedResumes,
  parseResumeFile,
  type InterviewerInfo,
  type SavedResumesData,
} from "../lib/api";
import UpgradeModal from "../components/UpgradeModal";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

/** Interview stage options for the form. */
const STAGES = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "recruiter_screen", label: "Recruiter Screen" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "final_panel", label: "Final Panel" },
  { value: "vp_round", label: "VP Round" },
  { value: "other", label: "Other (custom)" },
];

/** Labels for backend pipeline nodes shown during session creation. */
const NODE_LABELS: Record<string, string> = {
  parse: "Parsing job description...",
  analyze: "Analyzing role & company...",
  generate: "Generating interview questions...",
  draft: "Drafting answer frameworks...",
  roleplay_ask: "Preparing interviewer...",
  summary: "Finalizing session...",
};

type JdMode = "text" | "url";

/**
 * SectionHeading — Apple-grade section title for the New Session form.
 *
 * Design intent:
 * - Type carries the hierarchy (no eyebrow pills, no colored rails, no badges).
 * - A single hairline divider grounds the title inside its card, mirroring
 *   macOS Settings / Apple form patterns.
 * - "Optional" is a quiet inline caption rather than a chip — it should read
 *   like a footnote, not compete with the title.
 */
function SectionHeading({
  title,
  optional = false,
}: {
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-3 border-b border-border/60 pb-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {optional && (
        <span className="text-xs font-medium text-muted-foreground">
          Optional
        </span>
      )}
    </div>
  );
}

/**
 * Form for creating prep sessions. Key handlers: handleAutoFill (extracts fields from job description),
 * handleLookup (web search for interviewer title), handleResumeFile (PDF/DOCX upload),
 * handleSubmit (creates session via SSE stream, navigates early on generate complete).
 */
export default function NewSession() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("url");
  /** Multi-resume profile from API; null if unavailable (fallback to legacy single string). */
  const [savedResumesData, setSavedResumesData] = useState<SavedResumesData | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | "custom">("custom");
  const [savedResumeLegacy, setSavedResumeLegacy] = useState("");
  const [resumeOverride, setResumeOverride] = useState(false);
  const [customStage, setCustomStage] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [lookingUp, setLookingUp] = useState<number | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [form, setForm] = useState({
    company: "",
    role: "",
    job_description: "",
    job_url: "",
    stage: "phone_screen",
    resume: "",
    mode: "prep",
    /** Dashboard grouping; empty = use normalized company name */
    pipeline_group: "",
  });

  const [interviewers, setInterviewers] = useState<InterviewerInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getSavedResumes();
      if (cancelled) return;
      if (data && data.items.length > 0) {
        setSavedResumesData(data);
        const def = data.items.find((i) => i.id === data.default_id) ?? data.items[0];
        setSelectedResumeId(def.id);
        setResumeOverride(false);
        setForm((prev) => ({ ...prev, resume: def.text }));
      } else {
        const r = await getResume();
        if (!cancelled && r) setSavedResumeLegacy(r);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set =
    (field: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setForm({ ...form, [field]: e.target.value });

  /** Extracts company, role, stage from posting text or URL via extractFields API. */
  const handleAutoFill = async () => {
    setExtracting(true);
    setError("");
    try {
      const result = await extractFields({
        job_description: jdMode === "text" ? form.job_description : "",
        job_url: jdMode === "url" ? form.job_url : "",
      });
      setForm((prev) => ({
        ...prev,
        company: result.company || prev.company,
        role: result.role || prev.role,
        stage: result.stage_suggestion || prev.stage,
        job_description: result.job_description || prev.job_description,
      }));
    } catch (err) {
      // Prefer the backend's actionable message (fetch_failed /
      // extraction_empty / missing_input) over a generic string. Only
      // fall back to the old copy if the server wasn't reachable at
      // all or responded with an unexpected shape.
      const message =
        err instanceof Error && err.message && !/^Failed:\s*\d+/.test(err.message)
          ? err.message
          : "Failed to extract fields. Check the job description or URL and try again.";
      setError(message);
    } finally {
      setExtracting(false);
    }
  };

  /** Web search for interviewer title by name and company. */
  const handleLookup = async (idx: number) => {
    const person = interviewers[idx];
    if (!person.name.trim()) return;
    setLookingUp(idx);
    try {
      const result = await lookupInterviewer(person.name, form.company);
      if (result.title) {
        updateInterviewer(idx, "title", result.title);
      }
    } catch {
      /* silent fail */
    } finally {
      setLookingUp(null);
    }
  };

  /** Parses uploaded PDF/DOCX/TXT and populates resume field. */
  const handleResumeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    setError("");
    try {
      const text = await parseResumeFile(file);
      setForm((prev) => ({ ...prev, resume: text }));
      setResumeOverride(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse resume file");
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  };

  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (jdMode === "text" && !form.job_description.trim()) {
      setError("Please enter a job description.");
      return;
    }
    if (jdMode === "url" && !form.job_url.trim()) {
      setError("Please enter a job posting URL.");
      return;
    }

    const stage =
      form.stage === "other" ? customStage || "general" : form.stage;

    setLoading(true);
    setProgress([]);
    let navigated = false;
    try {
      let resumePayload = form.resume;
      if (!resumeOverride && selectedResumeId !== "custom" && savedResumesData) {
        const slot = savedResumesData.items.find((i) => i.id === selectedResumeId);
        if (slot) resumePayload = slot.text;
      } else if (!resumeOverride && !savedResumesData) {
        resumePayload = savedResumeLegacy || form.resume;
      }
      const resume = resumePayload;
      await createSessionStream(
        {
          ...form,
          stage,
          resume,
          job_description: jdMode === "text" ? form.job_description : "",
          job_url: jdMode === "url" ? form.job_url : "",
          interviewers: interviewers.filter((i) => i.name || i.title),
          pipeline_group: form.pipeline_group.trim(),
        },
        (node, sessionId) => {
          setProgress((prev) => [...prev, node]);
          if (node === "generate" && !navigated) {
            navigated = true;
            navigate(`/app/prep/${sessionId}`);
          }
        }
      );
    } catch (err) {
      if (!navigated) {
        const status = err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        if (status === 402 || msg.includes("402") || msg.toLowerCase().includes("daily limit")) {
          setShowUpgrade(true);
        } else {
          setError(msg);
        }
      }
    } finally {
      if (!navigated) setLoading(false);
    }
  };

  function parseNameTitle(raw: string): { name: string; title: string } | null {
    const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (!match) return null;
    return { name: match[1].trim(), title: match[2].trim() };
  }

  const addInterviewer = () =>
    setInterviewers([...interviewers, { name: "", title: "" }]);

  const updateInterviewer = (
    idx: number,
    field: "name" | "title",
    value: string
  ) => {
    const updated = [...interviewers];
    updated[idx] = { ...updated[idx], [field]: value };
    setInterviewers(updated);
  };

  const removeInterviewer = (idx: number) =>
    setInterviewers(interviewers.filter((_, i) => i !== idx));

  const hasJdContent =
    (jdMode === "text" && form.job_description.trim().length > 20) ||
    (jdMode === "url" && form.job_url.trim().length > 5);

  /** Shared input styling — softer border, subtle inner shadow for depth. */
  const inputClass =
    "w-full rounded-lg bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/70 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm shadow-gray-200/40 dark:shadow-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-colors";

  /** Section card wrapping related form fields. */
  const sectionCard =
    "rounded-2xl border border-border/80 bg-card/90 p-6 shadow-sm backdrop-blur-sm dark:bg-gray-900/45 sm:p-7";

  const allNodes = form.mode === "prep"
    ? ["parse", "analyze", "generate", "draft"]
    : ["parse", "analyze", "generate", "roleplay_ask"];

  return (
    <PageContainer size="md">
      <Link
        to="/app"
        className="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sessions
      </Link>

      <PageHeader
        title={<span className="font-display">New prep session</span>}
        description="Paste a job description or URL and we'll generate tailored prep materials, questions, and answer frameworks."
        className="mb-8"
      />

      {loading ? (
        <div className="space-y-3 py-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Building your prep session...
          </h2>
          {allNodes.map((node) => {
            const done = progress.includes(node);
            const isActive =
              !done &&
              progress.length > 0 &&
              allNodes.indexOf(node) ===
                allNodes.findIndex((n) => !progress.includes(n));
            return (
              <div key={node} className="flex items-center gap-3">
                {done ? (
                  <svg
                    className="w-5 h-5 text-emerald-600 dark:text-green-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isActive ? (
                  <svg
                    className="animate-spin h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-700 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    done
                      ? "text-emerald-700 dark:text-green-300"
                      : isActive
                      ? "text-gray-900 dark:text-white font-medium"
                      : "text-gray-500 dark:text-gray-600"
                  }`}
                >
                  {NODE_LABELS[node] || node}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* ── Job Posting ─────────────────────────────────────── */}
          <div className={`${sectionCard} order-1`}>
            <SectionHeading title="Job posting" />
            <div className="mb-3 flex items-center gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setJdMode("url")}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    jdMode === "url"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Paste URL
                </button>
                <button
                  type="button"
                  onClick={() => setJdMode("text")}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    jdMode === "text"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>
            {jdMode === "text" ? (
              <textarea
                rows={8}
                value={form.job_description}
                onChange={set("job_description")}
                placeholder="Paste the full job description here..."
                className={`${inputClass} resize-y`}
              />
            ) : (
              <input
                type="url"
                value={form.job_url}
                onChange={set("job_url")}
                placeholder="https://careers.example.com/job/12345"
                className={inputClass}
              />
            )}

            {hasJdContent && (
              <button
                type="button"
                onClick={handleAutoFill}
                disabled={extracting}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {extracting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Extracting...
                  </>
                ) : (
                  "Auto-Fill Company, Role & Stage"
                )}
              </button>
            )}
          </div>

          {/* ── Role Details ────────────────────────────────────── */}
          <div className={`${sectionCard} order-2`}>
            <SectionHeading title="Role details" />
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company
                  </label>
                  <input
                    value={form.company}
                    onChange={set("company")}
                    placeholder="e.g. Google"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </label>
                  <input
                    value={form.role}
                    onChange={set("role")}
                    placeholder="e.g. Senior Solutions Engineer"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Interview stage
                  </label>
                  <select
                    value={form.stage}
                    onChange={set("stage")}
                    className={inputClass}
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {form.stage === "other" && (
                    <input
                      value={customStage}
                      onChange={(e) => setCustomStage(e.target.value)}
                      placeholder="e.g. Case Study, System Design Review"
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mode
                  </label>
                  <select
                    value={form.mode}
                    onChange={set("mode")}
                    className={inputClass}
                  >
                    <option value="prep">Just Prep Me</option>
                    <option value="roleplay">Let Me Practice (Role-Play)</option>
                  </select>
                </div>
              </div>

              <details className="group rounded-xl border border-border bg-muted/30 p-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 outline-none transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                  <span className="inline-flex items-center gap-2">
                    Hiring pipeline group
                    <span className="text-xs font-normal text-muted-foreground">Optional</span>
                    <svg className="size-4 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 space-y-2">
                  <input
                    value={form.pipeline_group}
                    onChange={set("pipeline_group")}
                    placeholder="Defaults to company"
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use one group name for multiple rounds with the same employer.
                  </p>
                </div>
              </details>
            </div>
          </div>

          {/* ── Interviewers ───────────────────────────────────── */}
          <div className={`${sectionCard} order-4`}>
            <SectionHeading title="Interviewers" optional />
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">
                Interviewers
              </label>
              <button
                type="button"
                onClick={addInterviewer}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                + Add Interviewer
              </button>
            </div>
            {interviewers.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-600">
                Add interviewer names and titles for more tailored prep.
              </p>
            ) : (
              <div className="space-y-2">
                {interviewers.map((person, i) => {
                  const parsed = parseNameTitle(person.name);
                  return (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <input
                        value={person.name}
                        onChange={(e) =>
                          updateInterviewer(i, "name", e.target.value)
                        }
                        placeholder="Name"
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        value={person.title}
                        onChange={(e) =>
                          updateInterviewer(i, "title", e.target.value)
                        }
                        placeholder="Title (e.g. VP Engineering)"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => handleLookup(i)}
                        disabled={lookingUp === i || !person.name.trim()}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-30 shrink-0 px-2 py-1"
                        title="Look up title"
                      >
                        {lookingUp === i ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInterviewer(i)}
                        className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 shrink-0 p-1"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {parsed && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...interviewers];
                          updated[i] = { name: parsed.name, title: parsed.title };
                          setInterviewers(updated);
                        }}
                        className="ml-1 inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/40 rounded-full px-3 py-1 transition-colors"
                      >
                        Move &ldquo;{parsed.title}&rdquo; to title?
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Resume / Background ────────────────────────────── */}
          <div className={`${sectionCard} order-3`}>
            <SectionHeading title="Resume" optional />
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">
                Resume / Background
              </label>
              <div className="flex items-center gap-3">
                <Link
                  to="/app/settings"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
                >
                  Manage saved resumes
                </Link>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer">
                  {uploadingResume ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload PDF / DOCX
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleResumeFile}
                    className="hidden"
                    disabled={uploadingResume}
                  />
                </label>
              </div>
            </div>

            {savedResumesData && savedResumesData.items.length > 0 && (
              <div className="mb-3">
                <label htmlFor="resume-profile-select" className="sr-only">
                  Saved resume profile
                </label>
                <select
                  id="resume-profile-select"
                  value={selectedResumeId}
                  onChange={(e) => {
                    const v = e.target.value as string | "custom";
                    if (v === "custom") {
                      setSelectedResumeId("custom");
                      setResumeOverride(true);
                    } else {
                      setSelectedResumeId(v);
                      setResumeOverride(false);
                      const slot = savedResumesData.items.find((i) => i.id === v);
                      if (slot) setForm((prev) => ({ ...prev, resume: slot.text }));
                    }
                  }}
                  className={`${inputClass} text-sm py-2`}
                >
                  {savedResumesData.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label || "Untitled"}
                      {i.id === savedResumesData.default_id ? " (default)" : ""}
                    </option>
                  ))}
                  <option value="custom">Custom (this session only)</option>
                </select>
              </div>
            )}

            {savedResumesData &&
            savedResumesData.items.length > 0 &&
            !resumeOverride &&
            selectedResumeId !== "custom" ? (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-emerald-700 dark:text-green-400 font-medium">
                    Using saved profile
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {(savedResumesData.items.find((i) => i.id === selectedResumeId)?.text ?? "").slice(0, 120)}
                    {(savedResumesData.items.find((i) => i.id === selectedResumeId)?.text.length ?? 0) > 120
                      ? "…"
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const slot = savedResumesData.items.find((i) => i.id === selectedResumeId);
                    setResumeOverride(true);
                    if (slot) setForm((prev) => ({ ...prev, resume: slot.text }));
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium shrink-0"
                >
                  Edit text
                </button>
              </div>
            ) : savedResumeLegacy && !savedResumesData && !resumeOverride ? (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-sm text-emerald-700 dark:text-green-400 font-medium">
                    Saved resume loaded
                  </span>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {savedResumeLegacy.slice(0, 100)}...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResumeOverride(true);
                    setForm((prev) => ({ ...prev, resume: savedResumeLegacy }));
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium shrink-0 ml-3"
                >
                  Edit
                </button>
              </div>
            ) : (
              <>
                <textarea
                  rows={4}
                  value={form.resume}
                  onChange={(e) => {
                    setResumeOverride(true);
                    setForm({ ...form, resume: e.target.value });
                  }}
                  placeholder="Paste your resume or key experience points for personalized answers..."
                  className={`${inputClass} resize-y`}
                />
                {(selectedResumeId === "custom" || resumeOverride) && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Edits here apply to this session only unless you save profiles in Settings.
                  </p>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="order-5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/50 dark:border-red-700 px-4 py-3 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="order-6 rounded-2xl border border-indigo-200/70 bg-indigo-50/80 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Ready to generate your prep?</p>
                <p className="mt-1 text-xs text-muted-foreground">We’ll build questions, frameworks, and role-play context from this setup.</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="min-h-11 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                Start Prep Session
              </button>
            </div>
          </div>
        </form>
      )}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </PageContainer>
  );
}
