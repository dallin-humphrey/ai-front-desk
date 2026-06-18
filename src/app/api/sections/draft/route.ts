/**
 * POST /api/sections/draft — the operator co-pilot.
 *
 * Body: `{ question: string }` (a logged unanswered question)
 * Returns: `{ draft: string }`
 *
 * Fires one `generateText` call against Claude with the parent's question
 * and our `VOICE_RULES`. The model writes a 60-to-140-word paragraph in
 * the same voice the rest of the handbook uses, with `[bracketed]`
 * placeholders for any specifics it can't infer. The operator edits,
 * approves, and saves through the normal section CRUD; the AI never
 * auto-saves.
 *
 * Rate-limited per IP via `RATE_LIMITS.llmAux`.
 */
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL_ID, RATE_LIMITS } from "~/lib/constants";
import { CENTER } from "~/lib/center-config";
import { VOICE_RULES } from "~/lib/voice";
import { DraftBody } from "~/lib/validators";
import { checkRateLimit, clientKey, rateLimited } from "~/lib/rate-limit";

export async function POST(req: Request) {
  const rl = checkRateLimit(clientKey(req), RATE_LIMITS.llmAux);
  if (!rl.allowed) return rateLimited(rl);

  const parsed = DraftBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: anthropic(MODEL_ID),
      system: `You are drafting a new handbook entry for ${CENTER.name}, a child care center. A parent asked the question below and our handbook does not cover it yet. Write a short, warm, polite-educator paragraph (60 to 140 words) the operator can edit and save as the answer.

${VOICE_RULES}

If you don't have specific facts (prices, dates, exact policies), use bracketed placeholders the operator will fill in, like "[discount percentage]" or "[start date]". Never invent numbers. Output only the paragraph, no preamble, no "Here is a draft:".`,
      prompt: parsed.data.question,
    });

    return Response.json({ draft: text.trim() });
  } catch (err) {
    console.error("[draft] generateText failed:", err);
    return Response.json(
      { error: "Failed to draft a suggestion" },
      { status: 500 },
    );
  }
}
