import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { handbookSections, queryLog } from "~/server/db/schema";
import { retrieve, type RetrievableSection, type Hit } from "~/lib/retrieve";
import { classify, effectiveSensitivity } from "~/lib/guardrails";
import { buildSystemPrompt, buildUserContext } from "~/lib/system-prompt";
import { MODEL_ID } from "~/lib/constants";
import { CENTER } from "~/lib/center-config";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const lastUser = messages.filter((m) => m.role === "user").at(-1);
  const userText =
    lastUser?.parts.find((p): p is { type: "text"; text: string } => p.type === "text")
      ?.text ?? "";
  const today = new Date().toISOString().slice(0, 10);

  // 1. Load active handbook sections.
  const rawSections = await db
    .select()
    .from(handbookSections)
    .where(eq(handbookSections.isActive, true));
  const sections: RetrievableSection[] = rawSections.map((r) => ({
    id: r.id,
    title: r.title,
    sectionPath: r.sectionPath,
    keywords: r.keywords,
    content: r.content,
    sensitivity: r.sensitivity as RetrievableSection["sensitivity"],
  }));

  // 2. Guardrail — regex sentiment + intent classifier. No LLM call.
  const classifier = classify(userText);

  // 2a. Emergency short-circuit. Never call the model.
  if (classifier.kind === "emergency") {
    const text = classifier.canned.replace("{PHONE}", CENTER.phone);

    await db.insert(queryLog).values({
      question: userText,
      matchedSectionId: null,
      retrievalScore: null,
      answered: true,
      escalated: true,
      sensitive: true,
      answerText: text,
    });

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const id = "emergency-" + Date.now();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // 3. Retrieve (skip for complaints — don't surface a policy match for venting).
  const freshHit =
    classifier.kind === "complaint" ? null : retrieve(userText, sections);

  // 3a. Look up the most recently cited source from earlier turns. We inject
  //     it as a secondary source so the model can reference numbers and
  //     policies from prior topics, e.g. cross-multiplying a sibling discount
  //     (turn 1) against tuition rates (turn 2).
  const recentPath =
    messages.length > 1 ? extractRecentSourcePath(messages) : null;
  const priorSection =
    recentPath && classifier.kind !== "complaint"
      ? (sections.find((s) => s.sectionPath === recentPath) ?? null)
      : null;

  // 3b. Assemble sources. Primary (current turn) first; prior source second
  //     if different. If there's no fresh hit but there is a prior source,
  //     promote the prior to primary (the existing source-carryover behavior).
  const hits: Hit[] = [];
  if (freshHit) hits.push(freshHit);
  if (
    priorSection &&
    (!freshHit || freshHit.section.id !== priorSection.id)
  ) {
    hits.push({ section: priorSection, score: 0 });
  }
  // Primary hit drives sensitivity routing and the citation.
  const hit = hits[0] ?? null;

  // 4. Combine classifier with matched section sensitivity.
  const sensitivity = effectiveSensitivity(classifier, hit?.section ?? null);

  // 5. Build static system + per-request user context.
  const system = buildSystemPrompt();
  const context = buildUserContext({ hits, sensitivity, today });

  // 6. Augment the last user message to prepend the XML context.
  const augmented: UIMessage[] = messages.map((m, i) => {
    if (i !== messages.length - 1 || m.role !== "user") return m;
    return {
      ...m,
      parts: m.parts.map((p) =>
        p.type === "text" ? { ...p, text: `${context}\n\n${p.text}` } : p,
      ),
    };
  });

  // 7. Stream.
  const result = streamText({
    model: anthropic(MODEL_ID),
    system,
    messages: await convertToModelMessages(augmented),
    stopWhen: stepCountIs(2),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
    onError: ({ error }) => {
      console.error("[chat] streamText error:", error);
    },
    onFinish: async ({ text }) => {
      try {
        const answered = !!hit;
        const escalated = sensitivity.kind !== "safe" || !hit;
        await db.insert(queryLog).values({
          question: userText,
          matchedSectionId: hit?.section.id ?? null,
          retrievalScore: hit?.score ?? null,
          answered,
          escalated,
          sensitive: sensitivity.kind !== "safe",
          answerText: text ?? "",
        });
      } catch (err) {
        console.error("[chat] onFinish log failed:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

// Walk backwards through the message history to find the most recent
// "Source: <path>" trailer in an assistant turn. Returns the path or null.
function extractRecentSourcePath(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const text = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    const match = text.match(/\bSource:\s*(.+?)\s*$/);
    if (match) return match[1].trim();
  }
  return null;
}
