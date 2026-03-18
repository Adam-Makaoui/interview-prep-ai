import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSession,
  extractFields,
  getResume,
  saveResume,
  type InterviewerInfo,
} from "../lib/api";

const STAGES = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "recruiter_screen", label: "Recruiter Screen" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "final_panel", label: "Final Panel" },
  { value: "other", label: "Other (custom)" },
];

type JdMode = "text" | "url";

export default function NewSession() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("text");
  const [savedResume, setSavedResume] = useState("");
  const [resumeOverride, setResumeOverride] = useState(false);
  const [customStage, setCustomStage] = useState("");

  const [form, setForm] = useState({
    company: "",
    role: "",
    job_description: "",
    job_url: "",
    stage: "phone_screen",
    resume: "",
    mode: "prep",
  });

  const [interviewers, setInterviewers] = useState<InterviewerInfo[]>([]);

  useEffect(() => {
    getResume().then((r) => {
      if (r) setSavedResume(r);
    });
  }, []);

  const set =
    (field: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setForm({ ...form, [field]: e.target.value });

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
    } catch {
      setError("Failed to extract fields. Check the JD or URL and try again.");
    } finally {
      setExtracting(false);
    }
  };

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
    try {
      const resume = resumeOverride
        ? form.resume
        : savedResume || form.resume;
      const session = await createSession({
        ...form,
        stage,
        resume,
        job_description: jdMode === "text" ? form.job_description : "",
        job_url: jdMode === "url" ? form.job_url : "",
        interviewers: interviewers.filter((i) => i.name || i.title),
      });
      navigate(`/prep/${session.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResume = async () => {
    if (!form.resume.trim()) return;
    await saveResume(form.resume);
    setSavedResume(form.resume);
    setResumeOverride(false);
  };

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

  const inputClass =
    "w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Start a Prep Session</h1>
      <p className="text-gray-400 mb-8">
        Paste the job description or URL and we'll generate tailored prep
        materials.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* JD input: text or URL */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium text-gray-300">
              Job Description
            </label>
            <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-700">
              <button
                type="button"
                onClick={() => setJdMode("text")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  jdMode === "text"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                Paste Text
              </button>
              <button
                type="button"
                onClick={() => setJdMode("url")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  jdMode === "url"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                Paste URL
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

          {/* Auto-fill button */}
          {hasJdContent && (
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={extracting}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-gray-700 hover:text-indigo-200 disabled:opacity-50 transition-colors"
            >
              {extracting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Extracting...
                </>
              ) : (
                "Auto-Fill Company, Role & Stage"
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Company
            </label>
            <input
              value={form.company}
              onChange={set("company")}
              placeholder="e.g. DataRobot"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Interview Stage
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
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

        {/* Interviewers (dynamic list) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Interviewers{" "}
              <span className="text-gray-500">(optional)</span>
            </label>
            <button
              type="button"
              onClick={addInterviewer}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              + Add Interviewer
            </button>
          </div>
          {interviewers.length === 0 ? (
            <p className="text-xs text-gray-600">
              Add interviewer names and titles for more tailored prep.
            </p>
          ) : (
            <div className="space-y-2">
              {interviewers.map((person, i) => (
                <div key={i} className="flex gap-2 items-center">
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
                    onClick={() => removeInterviewer(i)}
                    className="text-gray-500 hover:text-red-400 shrink-0 p-1"
                    title="Remove"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resume */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Resume / Background{" "}
            <span className="text-gray-500">(optional)</span>
          </label>
          {savedResume && !resumeOverride ? (
            <div className="rounded-lg bg-gray-900 border border-gray-700 px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm text-green-400 font-medium">
                  Saved resume loaded
                </span>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {savedResume.slice(0, 100)}...
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResumeOverride(true);
                  setForm({ ...form, resume: savedResume });
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium shrink-0 ml-3"
              >
                Edit
              </button>
            </div>
          ) : (
            <>
              <textarea
                rows={4}
                value={form.resume}
                onChange={set("resume")}
                placeholder="Paste your resume or key experience points for personalized answers..."
                className={`${inputClass} resize-y`}
              />
              {form.resume.trim() && (
                <button
                  type="button"
                  onClick={handleSaveResume}
                  className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Save as default resume
                </button>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing & Generating...
            </span>
          ) : (
            "Start Prep Session"
          )}
        </button>
      </form>
    </main>
  );
}
