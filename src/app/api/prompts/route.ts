/**
 * /api/prompts — list + create the chips parents see in the empty state.
 *
 *   GET  → { prompts: Prompt[] } (only active, sorted by `sortOrder`)
 *   POST → { prompt: Prompt }    (validates body via PromptInput)
 *
 * Live-loaded by the parent UI on mount; admin Suggested Prompts tab
 * provides the operator-side CRUD.
 */
import { db } from "~/server/db";
import { suggestedPrompts } from "~/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { PromptInput } from "~/lib/validators";

export async function GET() {
  const rows = await db
    .select()
    .from(suggestedPrompts)
    .where(eq(suggestedPrompts.isActive, true))
    .orderBy(asc(suggestedPrompts.sortOrder), asc(suggestedPrompts.id));
  return Response.json({
    prompts: rows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const parsed = PromptInput.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }
  const [inserted] = await db
    .insert(suggestedPrompts)
    .values(parsed.data)
    .returning();
  return Response.json({
    prompt: { ...inserted, updatedAt: inserted.updatedAt.toISOString() },
  });
}
