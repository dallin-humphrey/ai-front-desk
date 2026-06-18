/**
 * /api/prompts/[id] — partial-update and delete a suggested prompt.
 *
 *   PATCH  → { prompt: Prompt }  (validates body via PromptPatch)
 *   DELETE → { ok: true }
 *
 * Used by the admin Suggested Prompts tab for inline edits, reorders
 * (via `sortOrder`), and hide / show toggles (via `isActive`).
 */
import { db } from "~/server/db";
import { suggestedPrompts } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PromptPatch } from "~/lib/validators";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const parsed = PromptPatch.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }
  const [updated] = await db
    .update(suggestedPrompts)
    .set(parsed.data)
    .where(eq(suggestedPrompts.id, idNum))
    .returning();
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    prompt: { ...updated, updatedAt: updated.updatedAt.toISOString() },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  await db.delete(suggestedPrompts).where(eq(suggestedPrompts.id, idNum));
  return Response.json({ ok: true });
}
