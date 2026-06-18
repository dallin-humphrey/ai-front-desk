import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL_ID } from "~/lib/constants";
import { CENTER } from "~/lib/center-config";
import { VOICE_RULES } from "~/lib/voice";
import { DraftBody } from "~/lib/validators";

export async function POST(req: Request) {
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
