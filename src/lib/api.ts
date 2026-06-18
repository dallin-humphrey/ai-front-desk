import type {
  Section,
  SectionInput,
  SectionPatch,
  QueryLogRow,
  AnalyticsCounts,
  Prompt,
  PromptInput,
  PromptPatch,
} from "./validators";

const j = async <T>(p: Promise<Response>): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
};

const jsonHeaders = { "Content-Type": "application/json" };

export const api = {
  listSections: () =>
    j<{ sections: Section[] }>(fetch("/api/sections")),

  getSection: (id: number) =>
    j<{ section: Section }>(fetch(`/api/sections/${id}`)),

  createSection: (input: SectionInput) =>
    j<{ section: Section }>(
      fetch("/api/sections", {
        method: "POST",
        body: JSON.stringify(input),
        headers: jsonHeaders,
      }),
    ),

  updateSection: (id: number, patch: SectionPatch) =>
    j<{ section: Section }>(
      fetch(`/api/sections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: jsonHeaders,
      }),
    ),

  deleteSection: (id: number) =>
    j<{ ok: true }>(
      fetch(`/api/sections/${id}`, { method: "DELETE" }),
    ),

  draftSection: (question: string) =>
    j<{ draft: string }>(
      fetch("/api/sections/draft", {
        method: "POST",
        body: JSON.stringify({ question }),
        headers: jsonHeaders,
      }),
    ),

  analyzeKeywords: (input: {
    title: string;
    content: string;
    existingKeywords: string[];
  }) =>
    j<{ keywords: string[] }>(
      fetch("/api/sections/analyze-keywords", {
        method: "POST",
        body: JSON.stringify(input),
        headers: jsonHeaders,
      }),
    ),

  getAnalytics: (filter?: "all" | "unanswered" | "escalated" | "sensitive") =>
    j<{ rows: QueryLogRow[]; counts: AnalyticsCounts }>(
      fetch(`/api/analytics${filter ? `?filter=${filter}` : ""}`),
    ),

  listPrompts: () =>
    j<{ prompts: Prompt[] }>(fetch("/api/prompts")),

  createPrompt: (input: PromptInput) =>
    j<{ prompt: Prompt }>(
      fetch("/api/prompts", {
        method: "POST",
        body: JSON.stringify(input),
        headers: jsonHeaders,
      }),
    ),

  updatePrompt: (id: number, patch: PromptPatch) =>
    j<{ prompt: Prompt }>(
      fetch(`/api/prompts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: jsonHeaders,
      }),
    ),

  deletePrompt: (id: number) =>
    j<{ ok: true }>(
      fetch(`/api/prompts/${id}`, { method: "DELETE" }),
    ),
};
