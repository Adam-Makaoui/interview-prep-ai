import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  getProfile,
  getSavedResumes,
  parseResumeFile,
  putSavedResumes,
  putLlmModel,
  type SavedResumesData,
  type UserProfile,
} from "../lib/api";
import { useTheme } from "../lib/theme";

const MAX_RESUME_SLOTS = 3;
const MAX_RESUME_CHARS = 80_000;

function newSlotId(): string {
  return crypto.randomUUID();
}

function AiModelSection({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (p: UserProfile) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const choices = profile.llm_model_choices ?? [];
  const stored = profile.llm_model ?? "";
  const effective = profile.llm_model_effective ?? "";
  const selectedId =
    stored && choices.some((c) => c.id === stored && c.available)
      ? stored
      : effective || choices.find((c) => c.available)?.id || "";

  const pick = async (id: string) => {
    const ch = choices.find((c) => c.id === id);
    if (!ch?.available) return;
    setSaving(true);
    setErr("");
    try {
      const partial = await putLlmModel(id);
      onUpdate({
        ...profile,
        llm_model: partial.llm_model ?? id,
        llm_model_effective: partial.llm_model_effective ?? id,
        llm_model_choices: partial.llm_model_choices ?? profile.llm_model_choices,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save model");
    } finally {
      setSaving(false);
    }
  };

  if (!choices.length) return null;

  return (
    <section className="rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800/60">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">AI model</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Choose which OpenAI model runs your prep sessions (analyze, questions, answers, role-play).
        </p>
      </div>
      <div className="px-6 py-5 space-y-3">
        {choices.map((c) => (
          <label
            key={c.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
              selectedId === c.id
                ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/10 dark:border-indigo-500/40"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            } ${!c.available ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <input
              type="radio"
              name="llm-model"
              className="mt-1"
              checked={selectedId === c.id}
              disabled={!c.available || saving}
              onChange={() => void pick(c.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{c.label}</span>
                {c.min_plan === "pro" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded px-1.5 py-0.5">
                    Pro
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.description}</p>
            </div>
          </label>
        ))}
        {saving && <p className="text-xs text-gray-500 dark:text-gray-400">Saving…</p>}
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
          Preference is stored on your account. Later, Pro and other paid tiers can unlock higher-quality models as
          part of your subscription.
        </p>
      </div>
    </section>
  );
}

function ResumeSettingsSection() {
  const [draft, setDraft] = useState<SavedResumesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editorSlotId, setEditorSlotId] = useState<string | null>(null);
  const [editorBuffer, setEditorBuffer] = useState("");
  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      const data = await getSavedResumes();
      if (!cancelled) {
        if (!data) {
          setErr("Could not load saved resumes. You may need to sign in again.");
        }
        setDraft(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!draft || draft.items.length === 0) return;
    setSaving(true);
    setErr("");
    try {
      const next = await putSavedResumes(draft);
      setDraft(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateLabel = (id: string, label: string) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            items: d.items.map((it) => (it.id === id ? { ...it, label: label.slice(0, 120) } : it)),
          }
        : d,
    );
  };

  const updateText = (id: string, text: string) => {
    const t = text.slice(0, MAX_RESUME_CHARS);
    setDraft((d) =>
      d
        ? {
            ...d,
            items: d.items.map((it) => (it.id === id ? { ...it, text: t } : it)),
          }
        : d,
    );
  };

  const setDefault = (id: string) => {
    setDraft((d) => (d ? { ...d, default_id: id } : d));
  };

  const removeSlot = (id: string) => {
    if (!draft || draft.items.length <= 1) return;
    const slot = draft.items.find((i) => i.id === id);
    if (slot?.text.trim() && !window.confirm("Remove this resume slot?")) return;
    const nextItems = draft.items.filter((i) => i.id !== id);
    let default_id = draft.default_id;
    if (default_id === id) default_id = nextItems[0].id;
    setDraft({ ...draft, default_id, items: nextItems });
  };

  const addSlot = () => {
    setDraft((d) => {
      if (!d || d.items.length >= MAX_RESUME_SLOTS) return d;
      const id = newSlotId();
      return {
        ...d,
        items: [...d.items, { id, label: `Resume ${d.items.length + 1}`, text: "" }],
      };
    });
  };

  const previewText = draft?.items.find((i) => i.id === previewId)?.text ?? "";
  const editorSlot = draft?.items.find((i) => i.id === editorSlotId);

  const openEditor = (id: string) => {
    const t = draft?.items.find((i) => i.id === id)?.text ?? "";
    setEditorBuffer(t);
    setEditorSlotId(id);
  };

  const applyEditor = () => {
    if (editorSlotId) updateText(editorSlotId, editorBuffer);
    setEditorSlotId(null);
  };

  const importFileToSlot = async (slotId: string, file: File | null) => {
    if (!file) return;
    setUploadingSlotId(slotId);
    setErr("");
    try {
      const text = await parseResumeFile(file);
      updateText(slotId, text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file");
    } finally {
      setUploadingSlotId(null);
    }
  };

  return (
    <>
      <section className="rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Saved resumes</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Add, label, and edit up to {MAX_RESUME_SLOTS} profiles here—this is the home for your resumes. New Session
              only picks which profile to use for that interview; manage content here or import a PDF/DOCX.
            </p>
          </div>
          <Link
            to="/app/new"
            className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            New session
          </Link>
        </div>
        <div className="px-6 py-5 space-y-4">
          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading resumes…</p>}
          {!loading && err && !draft && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{err}</p>
          )}
          {!loading && draft && (
            <>
              {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
              <div className="space-y-4">
                {draft.items.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700/80 bg-gray-50/80 dark:bg-gray-950/40 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="text"
                          value={slot.label}
                          onChange={(e) => updateLabel(slot.id, e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                          aria-label="Resume label"
                        />
                        {slot.id === draft.default_id && (
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="sr-only"
                            disabled={uploadingSlotId !== null}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              void importFileToSlot(slot.id, f ?? null);
                              e.target.value = "";
                            }}
                          />
                          {uploadingSlotId === slot.id ? "Importing…" : "Import file"}
                        </label>
                        <button
                          type="button"
                          onClick={() => openEditor(slot.id)}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Full editor
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewId(slot.id)}
                          className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline"
                        >
                          Preview
                        </button>
                        {slot.id !== draft.default_id && (
                          <button
                            type="button"
                            onClick={() => setDefault(slot.id)}
                            className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline"
                          >
                            Set as default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          disabled={draft.items.length <= 1}
                          className="text-xs font-medium text-red-600 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={slot.text}
                      onChange={(e) => updateText(slot.id, e.target.value)}
                      rows={8}
                      placeholder="Paste resume text for this profile…"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y min-h-[180px] font-mono"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {slot.text.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} characters
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addSlot}
                  disabled={draft.items.length >= MAX_RESUME_SLOTS}
                  className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add resume
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {editorSlotId && editorSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-editor-title"
          onClick={() => setEditorSlotId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 id="resume-editor-title" className="text-sm font-semibold text-gray-900 dark:text-white">
                Edit &quot;{editorSlot.label}&quot;
              </h3>
              <button
                type="button"
                onClick={() => setEditorSlotId(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close editor without saving"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <textarea
                value={editorBuffer}
                onChange={(e) => setEditorBuffer(e.target.value.slice(0, MAX_RESUME_CHARS))}
                className="h-[min(60vh,520px)] w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                placeholder="Resume text…"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {editorBuffer.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} — click Save changes below
                the list to persist, or apply now and keep editing.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setEditorSlotId(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyEditor();
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Apply to slot
              </button>
            </div>
          </div>
        </div>
      )}

      {previewId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-preview-title"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 id="resume-preview-title" className="text-sm font-semibold text-gray-900 dark:text-white">
                Preview
              </h3>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close preview"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto p-4 flex-1 min-h-0">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                {previewText || "(Empty)"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const plan = profile?.plan ?? "free";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your subscription, get support, and customize your experience.
        </p>
      </div>

      {user && <ResumeSettingsSection />}

      {user && profile?.authenticated && profile.llm_model_choices && profile.llm_model_choices.length > 0 && (
        <AiModelSection profile={profile} onUpdate={setProfile} />
      )}

      {/* Subscription */}
      <section className="rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Subscription</h2>
        </div>
        <div className="px-6 py-5">
          {plan === "pro" ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pro Plan</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">$29/month</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-500/30">
                Active
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Free Plan</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {profile?.daily_limit ?? 2} sessions per day
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Upgrade to Pro for unlimited sessions
                </p>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                  Unlock unlimited daily sessions, priority generation, advanced analytics, and premium AI models.
                </p>
                <button
                  disabled
                  className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
                >
                  Coming soon
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Support */}
      <section className="rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Support</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help or have feedback? Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <a
            href="mailto:adam.makaoui@outlook.com?subject=InterviewPrep%20AI%20support"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:hover:bg-indigo-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            Contact Support
          </a>
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/adammakaoui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
            >
              Adam Makaoui
            </a>
          </p>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Theme</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {theme === "dark" ? "Dark mode is on." : "Light mode is on."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "light"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 ${
                theme === "light" ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  theme === "light" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {user && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Signed in as {user.email}
        </p>
      )}
    </div>
  );
}
