import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { MODEL_ID, RATE_LIMITS } from "~/lib/constants";
import { AnalyzeKeywordsBody } from "~/lib/validators";
import { checkRateLimit, clientKey, rateLimited } from "~/lib/rate-limit";

const KeywordSuggestions = z.object({
  keywords: z
    .array(z.string().min(1).max(40))
    .min(8)
    .max(25)
    .describe(
      "Short keyword phrases (single words or two-to-three word phrases) parents would actually type when asking about this topic.",
    ),
});

export async function POST(req: Request) {
  const rl = checkRateLimit(clientKey(req), RATE_LIMITS.llmAux);
  if (!rl.allowed) return rateLimited(rl);

  const parsed = AnalyzeKeywordsBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { title, content, existingKeywords } = parsed.data;

  try {
    const { object } = await generateObject({
      model: anthropic(MODEL_ID),
      schema: KeywordSuggestions,
      system: `You help an operator at a childcare center add searchable keywords to a handbook section. Lexical retrieval matches a parent's question against these keywords, so generous synonyms matter.

Generate 12 to 20 keyword phrases that:
- Include the obvious terms from the title and content
- ALWAYS include the base single-word form of any topic, not only multi-word variants. For example, alongside "nap time" / "napping" / "nap schedule", also include the bare word "nap" by itself. Same for "drop off" => also "dropoff", "tuition" => also "fees", "cost", "price", etc. Without base forms, a parent who types one word ("nap?", "fees?") will not match.
- Include common synonyms a parent would actually use ("tuition" should also yield "cost", "price", "fee", "pay", "monthly")
- Include casual phrasings and obvious typos parents make ("drop off", "drop-off", "dropoff", "dropping off")
- Include question-shaped fragments only when highly specific to this section ("can my child come", "what time", "what to bring")

Do NOT include:
- Generic stopwords or filler ("a", "the", "what", "how")
- Made-up policies or numbers that aren't in the content
- Keywords unrelated to this section
- Duplicates of the existing keywords already on file

Return single words or short phrases (max 3 words). Lowercase. No punctuation. No quotes.`,
      prompt: `Section title: ${title}

Section content:
${content}

Existing keywords already on file (do not duplicate these):
${existingKeywords.length > 0 ? existingKeywords.join(", ") : "(none)"}

Suggest new keywords to add.`,
    });

    // Dedupe against existing (case-insensitive) and normalize.
    const existingLower = new Set(existingKeywords.map((k) => k.toLowerCase().trim()));
    const fresh = Array.from(
      new Set(
        object.keywords
          .map((k) => k.toLowerCase().trim())
          .filter((k) => k.length > 0 && !existingLower.has(k)),
      ),
    );

    return Response.json({ keywords: fresh });
  } catch (err) {
    console.error("[analyze-keywords] generateObject failed:", err);
    return Response.json(
      { error: "Failed to analyze keywords" },
      { status: 500 },
    );
  }
}
