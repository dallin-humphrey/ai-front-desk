"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "~/lib/api";
import { extractKeywords } from "~/lib/retrieve";
import type {
  Section,
  SectionInput,
  QueryLogRow,
  AnalyticsCounts,
  Prompt,
} from "~/lib/validators";

type Tab = "handbook" | "questions" | "prompts";
type EditorState =
  | { mode: "idle" }
  | { mode: "edit"; section: Section }
  | { mode: "new"; prefill?: Partial<SectionInput>; sourceQuestion?: string };

const SENSITIVITY_LABELS: Record<SectionInput["sensitivity"], string> = {
  safe: "Safe (answer normally)",
  policy_escalate: "Policy + escalate (state policy, then hand off)",
  handoff: "Handoff (never auto-answer, route to staff)",
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>("handbook");
  const [sections, setSections] = useState<Section[]>([]);
  const [editor, setEditor] = useState<EditorState>({ mode: "idle" });
  const [refreshTick, setRefreshTick] = useState(0);
  // Increments each time a "new" editor session is opened, so the editor
  // component remounts with fresh state.
  const [newEditorSeq, setNewEditorSeq] = useState(0);

  useEffect(() => {
    api.listSections().then((r) => setSections(r.sections)).catch(console.error);
  }, [refreshTick]);

  const startNewFromQuestion = useCallback((q: QueryLogRow) => {
    setTab("handbook");
    const title = humanizeTitle(q.question);
    const keywords = extractKeywords(q.question);
    setEditor({
      mode: "new",
      prefill: {
        title,
        sectionPath: "General > " + title,
        keywords,
        content: "",
        sensitivity: "safe",
        isActive: true,
      },
      sourceQuestion: q.question,
    });
    setNewEditorSeq((n) => n + 1);
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold">Maple Grove Front Desk</h1>
            <p className="text-sm text-[var(--muted)]">Admin console</p>
          </div>
          <nav className="flex gap-1 text-sm">
            <TabButton active={tab === "handbook"} onClick={() => setTab("handbook")}>
              Handbook
            </TabButton>
            <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
              Recent Questions
            </TabButton>
            <TabButton active={tab === "prompts"} onClick={() => setTab("prompts")}>
              Suggested Prompts
            </TabButton>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {tab === "handbook" && (
          <HandbookTab
            sections={sections}
            editor={editor}
            setEditor={setEditor}
            newEditorSeq={newEditorSeq}
            onNewEditorBumpSeq={() => setNewEditorSeq((n) => n + 1)}
            onSaved={() => setRefreshTick((n) => n + 1)}
          />
        )}
        {tab === "questions" && (
          <QuestionsTab
            onAddToHandbook={startNewFromQuestion}
            refreshKey={refreshTick}
          />
        )}
        {tab === "prompts" && <PromptsTab />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-[var(--primary-soft)] text-[var(--primary)] font-medium"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- */
/* Handbook tab                                                          */
/* -------------------------------------------------------------------- */

function HandbookTab({
  sections,
  editor,
  setEditor,
  onSaved,
  newEditorSeq,
  onNewEditorBumpSeq,
}: {
  sections: Section[];
  editor: EditorState;
  setEditor: (e: EditorState) => void;
  onSaved: () => void;
  newEditorSeq: number;
  onNewEditorBumpSeq: () => void;
}) {
  const grouped = useMemo(() => groupByChapter(sections), [sections]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      {/* Tree */}
      <aside className="md:sticky md:top-6 self-start space-y-4 max-h-[calc(100dvh-7rem)] overflow-y-auto">
        <button
          onClick={() => {
            setEditor({ mode: "new" });
            onNewEditorBumpSeq();
          }}
          className="w-full text-left rounded-md bg-[var(--primary)] text-white px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          + New section
        </button>
        <div className="space-y-4">
          {Object.entries(grouped).map(([chapter, items]) => (
            <div key={chapter}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5 px-1">
                {chapter}
              </div>
              <ul className="space-y-0.5">
                {items.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() =>
                        setEditor({ mode: "edit", section: s })
                      }
                      className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-alt)] flex items-center justify-between gap-2 ${
                        editor.mode === "edit" && editor.section.id === s.id
                          ? "bg-[var(--surface-alt)] font-medium"
                          : ""
                      }`}
                    >
                      <span className="truncate">{s.title}</span>
                      <SensitivityBadge value={s.sensitivity} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div>
        {editor.mode === "idle" ? (
          <EmptyEditor />
        ) : (
          <SectionEditor
            key={editor.mode === "edit" ? `e-${editor.section.id}` : `n-${newEditorSeq}`}
            state={editor}
            onCancel={() => setEditor({ mode: "idle" })}
            onSaved={() => {
              setEditor({ mode: "idle" });
              onSaved();
            }}
          />
        )}
      </div>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
      Select a section to edit, or create a new one.
    </div>
  );
}

function SensitivityBadge({ value }: { value: SectionInput["sensitivity"] }) {
  const cls =
    value === "safe"
      ? "bg-stone-100 text-stone-600"
      : value === "policy_escalate"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  const label =
    value === "safe" ? "safe" : value === "policy_escalate" ? "policy" : "handoff";
  return (
    <span className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

function SectionEditor({
  state,
  onCancel,
  onSaved,
}: {
  state: Exclude<EditorState, { mode: "idle" }>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isNew = state.mode === "new";
  const initial =
    state.mode === "edit"
      ? state.section
      : {
          id: 0,
          sectionPath: state.prefill?.sectionPath ?? "General > New Section",
          title: state.prefill?.title ?? "",
          content: state.prefill?.content ?? "",
          keywords: state.prefill?.keywords ?? [],
          sensitivity: state.prefill?.sensitivity ?? "safe",
          isActive: state.prefill?.isActive ?? true,
          updatedAt: "",
        };

  const sourceQuestion =
    state.mode === "new" ? state.sourceQuestion : undefined;

  const [form, setForm] = useState<SectionInput>({
    sectionPath: initial.sectionPath,
    title: initial.title,
    content: initial.content,
    keywords: initial.keywords,
    sensitivity: initial.sensitivity as SectionInput["sensitivity"],
    isActive: initial.isActive,
  });
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  // Initialize drafting=true synchronously when the editor opens from a
  // parent question, so we don't have to flip it from inside the effect.
  const [drafting, setDrafting] = useState(isNew && !!sourceQuestion);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Co-pilot: fire one draft call when the editor opens from a parent
  // question. The component is keyed so this runs exactly once per session.
  useEffect(() => {
    if (!isNew || !sourceQuestion) return;
    let cancelled = false;
    api
      .draftSection(sourceQuestion)
      .then((r) => {
        if (cancelled) return;
        setForm((f) => ({ ...f, content: r.draft }));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Draft failed:", e);
        setDraftError(
          "Couldn't draft a suggestion. Try again or write the answer yourself.",
        );
      })
      .finally(() => {
        if (!cancelled) setDrafting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, sourceQuestion]);

  const addKeyword = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (form.keywords.includes(v)) return;
    setForm({ ...form, keywords: [...form.keywords, v] });
    setKeywordInput("");
  };
  const removeKeyword = (k: string) =>
    setForm({ ...form, keywords: form.keywords.filter((x) => x !== k) });

  const analyzeKeywords = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const r = await api.analyzeKeywords({
        title: form.title,
        content: form.content,
        existingKeywords: form.keywords,
      });
      if (r.keywords.length === 0) {
        setAnalyzeError("No new suggestions. The current keywords look thorough.");
        return;
      }
      setForm((f) => ({
        ...f,
        keywords: Array.from(new Set([...f.keywords, ...r.keywords])),
      }));
    } catch (e) {
      console.error("analyzeKeywords failed:", e);
      setAnalyzeError("Couldn't analyze. Try again in a moment.");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (state.mode === "edit") {
        await api.updateSection(state.section.id, form);
      } else {
        await api.createSection(form);
      }
      onSaved();
    } catch (e) {
      console.error(e);
      alert("Save failed. See console.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (state.mode !== "edit") return;
    if (!confirm("Delete this section?")) return;
    await api.deleteSection(state.section.id);
    onSaved();
  };

  return (
    <div className="space-y-4 bg-[var(--surface)] rounded-lg border border-[var(--border)] p-5">
      {sourceQuestion && (
        <div className="rounded-md bg-[var(--primary-soft)] text-[var(--primary)] px-3 py-2 text-sm">
          Drafting an answer for: <span className="font-medium">&ldquo;{sourceQuestion}&rdquo;</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Section path">
          <input
            value={form.sectionPath}
            onChange={(e) => setForm({ ...form, sectionPath: e.target.value })}
            placeholder="Health & Safety > Illness & Fever"
            className={inputCls}
          />
        </Field>
        <Field label="Title">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Illness & Fever Policy"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Sensitivity">
        <select
          value={form.sensitivity}
          onChange={(e) =>
            setForm({
              ...form,
              sensitivity: e.target.value as SectionInput["sensitivity"],
            })
          }
          className={inputCls}
        >
          {Object.entries(SENSITIVITY_LABELS).map(([k, label]) => (
            <option value={k} key={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Keywords"
        hint="Words a parent might use. Don't be stingy: synonyms matter."
      >
        <div className="rounded-md border border-[var(--border)] bg-white p-2 flex flex-wrap gap-1.5 min-h-[44px]">
          {form.keywords.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 bg-[var(--surface-alt)] text-sm rounded px-2 py-0.5"
            >
              {k}
              <button
                onClick={() => removeKeyword(k)}
                className="text-[var(--muted)] hover:text-[var(--danger)]"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addKeyword(keywordInput.replace(/,$/, ""));
              }
              if (
                e.key === "Backspace" &&
                !keywordInput &&
                form.keywords.length > 0
              ) {
                removeKeyword(form.keywords[form.keywords.length - 1]);
              }
            }}
            placeholder={form.keywords.length === 0 ? "Type and press Enter" : ""}
            className="flex-1 min-w-[8ch] text-sm bg-transparent outline-none px-1"
          />
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={analyzeKeywords}
            disabled={analyzing || !form.title || form.content.length < 20}
            className="text-xs font-medium px-2.5 py-1 rounded border border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            title={
              form.content.length < 20
                ? "Add a title and ~20 characters of content first"
                : "Let the AI read your content and suggest extra keywords"
            }
          >
            {analyzing ? (
              <>
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-[var(--primary)]" />
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-[var(--primary)]" />
                <span className="typing-dot inline-block w-1 h-1 rounded-full bg-[var(--primary)]" />
                <span className="ml-0.5">Analyzing</span>
              </>
            ) : (
              <>+ Suggest keywords with AI</>
            )}
          </button>
          {analyzeError && (
            <span className="text-xs text-[var(--muted)]">{analyzeError}</span>
          )}
        </div>
      </Field>

      <Field
        label="Content"
        hint={
          drafting
            ? "The AI is drafting a suggestion in our voice. Edit as needed."
            : "What the front desk should tell a parent. Be specific. Real numbers beat vague language."
        }
      >
        {drafting ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)] flex items-center gap-2">
            <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            <span className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            <span className="ml-2">Drafting a suggestion…</span>
          </div>
        ) : (
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={9}
            placeholder="Two or three short paragraphs."
            className={`${inputCls} font-mono text-[13px] leading-relaxed`}
          />
        )}
        {draftError && (
          <div className="text-xs text-[var(--danger)] mt-1">{draftError}</div>
        )}
      </Field>

      <div className="flex items-center justify-between pt-1">
        {state.mode === "edit" ? (
          <button
            onClick={remove}
            className="text-sm text-[var(--danger)] hover:underline"
          >
            Delete section
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded-md hover:bg-[var(--surface-alt)]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || drafting || !form.title || !form.content}
            className="text-sm px-4 py-1.5 rounded-md bg-[var(--primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-transparent";

/* -------------------------------------------------------------------- */
/* Recent Questions tab                                                  */
/* -------------------------------------------------------------------- */

function QuestionsTab({
  onAddToHandbook,
  refreshKey,
}: {
  onAddToHandbook: (q: QueryLogRow) => void;
  refreshKey: number;
}) {
  const [filter, setFilter] = useState<
    "all" | "unanswered" | "escalated" | "sensitive"
  >("all");
  const [rows, setRows] = useState<QueryLogRow[]>([]);
  const [counts, setCounts] = useState<AnalyticsCounts | null>(null);
  // Derived loading: true until the current filter has loaded.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${filter}:${refreshKey}`;
  const loading = loadedKey !== currentKey;

  useEffect(() => {
    let cancelled = false;
    api
      .getAnalytics(filter)
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setCounts(r.counts);
        setLoadedKey(currentKey);
      })
      .catch((e) => {
        if (!cancelled) console.error(e);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey, currentKey]);

  return (
    <div className="space-y-5">
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={counts.total} />
          <StatCard label="Answered" value={counts.answered} tone="primary" />
          <StatCard label="Escalated" value={counts.escalated} tone="accent" />
          <StatCard label="Unanswered" value={counts.unanswered} tone="danger" />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(["all", "unanswered", "escalated", "sensitive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
              filter === f
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[var(--muted)] py-8 text-center">
          No questions match this filter yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <QuestionRow key={r.id} row={r} onAdd={() => onAddToHandbook(r)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "accent" | "danger";
}) {
  const toneCls =
    tone === "primary"
      ? "text-[var(--primary)]"
      : tone === "accent"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function QuestionRow({
  row,
  onAdd,
}: {
  row: QueryLogRow;
  onAdd: () => void;
}) {
  const isUnanswered = !row.answered;
  return (
    <li className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="text-sm font-medium text-[var(--foreground)]">
            &ldquo;{row.question}&rdquo;
          </div>
          {row.askedCount && row.askedCount > 1 && (
            <span className="inline-flex items-center text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
              asked {row.askedCount} times
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted)] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>{relative(row.createdAt)}</span>
          <span>·</span>
          {row.matchedSectionTitle ? (
            <span>matched: {row.matchedSectionTitle}</span>
          ) : (
            <span className="text-[var(--danger)]">no match</span>
          )}
          {row.sensitive && (
            <>
              <span>·</span>
              <span className="text-amber-700">sensitive</span>
            </>
          )}
          {row.escalated && (
            <>
              <span>·</span>
              <span>escalated</span>
            </>
          )}
        </div>
      </div>
      {isUnanswered && (
        <button
          onClick={onAdd}
          className="shrink-0 text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--primary)] text-white hover:opacity-90"
        >
          Add to handbook →
        </button>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------- */
/* Suggested prompts tab                                                 */
/* -------------------------------------------------------------------- */

function PromptsTab() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);
  const loading = loadedKey !== reloadTick;

  useEffect(() => {
    let cancelled = false;
    api
      .listPrompts()
      .then((r) => {
        if (cancelled) return;
        setPrompts(r.prompts);
        setLoadedKey(reloadTick);
      })
      .catch((e) => {
        if (!cancelled) console.error(e);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = () => setReloadTick((n) => n + 1);

  const create = async () => {
    const text = newText.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const nextSortOrder =
        prompts.length === 0
          ? 10
          : Math.max(...prompts.map((p) => p.sortOrder)) + 10;
      await api.createPrompt({ text, sortOrder: nextSortOrder, isActive: true });
      setNewText("");
      reload();
    } catch (e) {
      console.error(e);
      alert("Couldn't create prompt. See console.");
    } finally {
      setSaving(false);
    }
  };

  const updateText = async (id: number, text: string) => {
    try {
      await api.updatePrompt(id, { text });
      reload();
    } catch (e) {
      console.error(e);
      alert("Couldn't update prompt. See console.");
    }
  };

  const toggleActive = async (p: Prompt) => {
    try {
      await api.updatePrompt(p.id, { isActive: !p.isActive });
      reload();
    } catch (e) {
      console.error(e);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this prompt?")) return;
    try {
      await api.deletePrompt(id);
      reload();
    } catch (e) {
      console.error(e);
    }
  };

  const move = async (id: number, direction: -1 | 1) => {
    const idx = prompts.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const swap = prompts[idx + direction];
    if (!swap) return;
    const me = prompts[idx];
    try {
      await Promise.all([
        api.updatePrompt(me.id, { sortOrder: swap.sortOrder }),
        api.updatePrompt(swap.id, { sortOrder: me.sortOrder }),
      ]);
      reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Suggested prompts</h2>
        <p className="text-sm text-[var(--muted)]">
          The chips parents see in the empty state of the chat. Tap to
          edit, reorder, hide, or delete. Add new ones as you notice
          patterns in Recent Questions.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <label className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          New prompt
        </label>
        <div className="flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder='e.g. "Do you have a sibling discount?"'
            className={inputCls}
          />
          <button
            onClick={create}
            disabled={saving || !newText.trim()}
            className="shrink-0 text-sm font-medium px-4 py-2 rounded-md bg-[var(--primary)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>

      {loading && prompts.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">Loading…</div>
      ) : prompts.length === 0 ? (
        <div className="text-sm text-[var(--muted)] py-6 text-center border border-dashed border-[var(--border)] rounded-lg">
          No prompts yet. Add the first one above.
        </div>
      ) : (
        <ul className="space-y-2">
          {prompts.map((p, i) => (
            <PromptRow
              key={p.id}
              prompt={p}
              isFirst={i === 0}
              isLast={i === prompts.length - 1}
              onUpdateText={(text) => updateText(p.id, text)}
              onToggleActive={() => toggleActive(p)}
              onRemove={() => remove(p.id)}
              onMoveUp={() => move(p.id, -1)}
              onMoveDown={() => move(p.id, 1)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromptRow({
  prompt,
  isFirst,
  isLast,
  onUpdateText,
  onToggleActive,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  prompt: Prompt;
  isFirst: boolean;
  isLast: boolean;
  onUpdateText: (text: string) => void;
  onToggleActive: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prompt.text);

  const save = () => {
    const next = draft.trim();
    if (!next || next === prompt.text) {
      setEditing(false);
      return;
    }
    onUpdateText(next);
    setEditing(false);
  };

  return (
    <li
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center gap-3 ${
        prompt.isActive ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
          className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 disabled:cursor-not-allowed leading-none"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
          className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 disabled:cursor-not-allowed leading-none"
        >
          ▼
        </button>
      </div>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(prompt.text);
              setEditing(false);
            }
          }}
          onBlur={save}
          className={`flex-1 ${inputCls}`}
        />
      ) : (
        <button
          onClick={() => {
            setDraft(prompt.text);
            setEditing(true);
          }}
          className="flex-1 text-left text-sm hover:underline"
        >
          {prompt.text}
        </button>
      )}

      <button
        onClick={onToggleActive}
        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] uppercase tracking-wide"
      >
        {prompt.isActive ? "Hide" : "Show"}
      </button>
      <button
        onClick={onRemove}
        aria-label="Delete prompt"
        className="text-[var(--muted)] hover:text-[var(--danger)] text-sm"
      >
        ×
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------- */
/* Helpers                                                               */
/* -------------------------------------------------------------------- */

function groupByChapter(sections: Section[]): Record<string, Section[]> {
  const out: Record<string, Section[]> = {};
  for (const s of sections) {
    const [chapter] = s.sectionPath.split(">").map((p) => p.trim());
    out[chapter] = out[chapter] ?? [];
    out[chapter].push(s);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.title.localeCompare(b.title));
  }
  return out;
}

function humanizeTitle(q: string): string {
  const cleaned = q.trim().replace(/[?!.]+$/, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function relative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
