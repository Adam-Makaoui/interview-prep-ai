import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import {
  getResume,
  getSavedResumes,
  parseResumeFile,
  putSavedResumes,
  type SavedResumesData,
} from "../lib/api";

const MAX_RESUME_SLOTS = 2;
const MAX_RESUME_CHARS = 80_000;

function newSlotId(): string {
  return crypto.randomUUID();
}

function emptyResumeDraft(): SavedResumesData {
  const id = newSlotId();
  return {
    default_id: id,
    items: [{ id, label: "Default resume", text: "" }],
  };
}

function resumeDraftFromText(text: string): SavedResumesData {
  const draft = emptyResumeDraft();
  draft.items[0].text = text;
  return draft;
}

function normalizeResumeDraft(data: SavedResumesData): SavedResumesData {
  const items = data.items.slice(0, MAX_RESUME_SLOTS);
  const fallback = items[0]?.id ?? data.default_id;
  const default_id = items.some((item) => item.id === data.default_id) ? data.default_id : fallback;
  return {
    ...data,
    default_id,
    items: items.length > 0 ? items : emptyResumeDraft().items,
  };
}

function formatSavedTime(date: Date | null): string {
  if (!date) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Resumes page — standalone resume library for saved profiles.
 *
 * This keeps resume upload/editing independent from session creation so users can
 * maintain their default resume without starting a new analysis.
 */
export default function Resumes() {
  const [draft, setDraft] = useState<SavedResumesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [editorSlotId, setEditorSlotId] = useState<string | null>(null);
  const [editorBuffer, setEditorBuffer] = useState("");
  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      const data = await getSavedResumes();
      if (cancelled) return;
      if (data) {
        setDraft(normalizeResumeDraft(data));
        setLastSavedAt(new Date());
        setLoading(false);
        return;
      }

      const legacyResume = await getResume();
      if (cancelled) return;
      setDraft(normalizeResumeDraft(legacyResume ? resumeDraftFromText(legacyResume) : emptyResumeDraft()));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const editorSlot = draft?.items.find((item) => item.id === editorSlotId);
  const savedTimeLabel = useMemo(() => formatSavedTime(lastSavedAt), [lastSavedAt]);

  const persist = async (nextDraft = draft) => {
    if (!nextDraft || nextDraft.items.length === 0) return;
    setSaving(true);
    setErr("");
    try {
      const next = await putSavedResumes(normalizeResumeDraft(nextDraft));
      setDraft(normalizeResumeDraft(next));
      setDirty(false);
      setLastSavedAt(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateLabel = (id: string, label: string) => {
    setDirty(true);
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, label: label.slice(0, 120) } : item,
            ),
          }
        : current,
    );
  };

  const updateText = (id: string, text: string) => {
    const nextText = text.slice(0, MAX_RESUME_CHARS);
    setDirty(true);
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, text: nextText } : item,
            ),
          }
        : current,
    );
  };

  const setDefault = (id: string) => {
    setDirty(true);
    setDraft((current) => (current ? { ...current, default_id: id } : current));
  };

  const removeSlot = (id: string) => {
    if (!draft || draft.items.length <= 1) return;
    const slot = draft.items.find((item) => item.id === id);
    if (slot?.text.trim() && !window.confirm("Remove this resume?")) return;
    const nextItems = draft.items.filter((item) => item.id !== id);
    setDirty(true);
    setDraft({
      ...draft,
      default_id: draft.default_id === id ? nextItems[0].id : draft.default_id,
      items: nextItems,
    });
  };

  const addSlot = () => {
    setDirty(true);
    setDraft((current) => {
      if (!current || current.items.length >= MAX_RESUME_SLOTS) return current;
      const id = newSlotId();
      return {
        ...current,
        items: [...current.items, { id, label: `Resume ${current.items.length + 1}`, text: "" }],
      };
    });
  };

  const openEditor = (id: string) => {
    const text = draft?.items.find((item) => item.id === id)?.text ?? "";
    setEditorBuffer(text);
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
    <PageContainer size="lg">
      <PageHeader
        title={<span className="font-display">Resumes</span>}
        description="Save up to two. Pick one as your default."
        action={
          <Button type="button" onClick={() => void persist()} disabled={!dirty || saving || loading}>
            {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      {err && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {err}
        </div>
      )}

      {loading || !draft ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="py-10 text-sm text-muted-foreground">
            Loading resumes...
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {draft.items.map((slot) => {
            const isDefault = slot.id === draft.default_id;
            return (
              <Card key={slot.id} className="border-border/70 bg-card/95 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={slot.label}
                        onChange={(e) => updateLabel(slot.id, e.target.value)}
                        aria-label="Resume label"
                        className="h-9 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                      />
                      <p className="text-xs text-muted-foreground">
                        {dirty ? "Unsaved changes" : `Last saved ${savedTimeLabel}`}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <input
                        type="radio"
                        name="default-resume"
                        checked={isDefault}
                        onChange={() => setDefault(slot.id)}
                        className="size-3 accent-indigo-600"
                      />
                      Default
                    </label>
                  </div>

                  <div className="min-h-28 rounded-xl border border-border bg-background/70 p-3">
                    <p className="line-clamp-4 whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground">
                      {slot.text.trim() || "No resume text yet. Replace this slot with a PDF, DOCX, TXT, or open Edit."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {slot.text.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} characters
                    </span>
                    {isDefault && <span className="text-indigo-600 dark:text-indigo-400">Used by new sessions</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditor(slot.id)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          className="sr-only"
                          disabled={uploadingSlotId !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void importFileToSlot(slot.id, file ?? null);
                            e.target.value = "";
                          }}
                        />
                        {uploadingSlotId === slot.id ? "Replacing..." : "Replace..."}
                      </label>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive disabled:opacity-40"
                      onClick={() => removeSlot(slot.id)}
                      disabled={draft.items.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {draft.items.length < MAX_RESUME_SLOTS && (
            <button
              type="button"
              onClick={addSlot}
              className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <span className="mb-2 text-2xl leading-none">+</span>
              Add resume
              <span className="mt-1 text-xs">Keep another version ready for a different role.</span>
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
        <span>Ready to prep with your default resume?</span>
        <Button asChild variant="outline">
          <Link to="/app/new">Start a new session</Link>
        </Button>
      </div>

      <Dialog open={!!editorSlotId && !!editorSlot} onOpenChange={(open) => !open && setEditorSlotId(null)}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Edit {editorSlot?.label || "resume"}</DialogTitle>
            <DialogDescription>
              Keep the text clean and readable. Formatting is less important than content.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5">
            <textarea
              value={editorBuffer}
              onChange={(e) => setEditorBuffer(e.target.value.slice(0, MAX_RESUME_CHARS))}
              className="h-[min(60vh,520px)] w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="Paste resume text..."
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {editorBuffer.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} characters
            </p>
          </div>
          <DialogFooter className="border-t border-border px-5 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={applyEditor}>
              Apply text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
