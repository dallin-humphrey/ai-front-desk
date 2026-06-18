/**
 * /api/sections/[id] — read, partial-update, delete a single section.
 *
 *   GET    → { section: Section }   or 404
 *   PATCH  → { section: Section }   (validates body via SectionPatch)
 *   DELETE → { ok: true }
 *
 * Next.js 16 makes `params` a Promise; each handler awaits it. The id is
 * coerced to a positive integer before any DB call.
 */
import { db } from "~/server/db";
import { handbookSections } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { SectionPatch } from "~/lib/validators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const [row] = await db
    .select()
    .from(handbookSections)
    .where(eq(handbookSections.id, idNum));
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    section: { ...row, updatedAt: row.updatedAt.toISOString() },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const parsed = SectionPatch.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }
  const [updated] = await db
    .update(handbookSections)
    .set(parsed.data)
    .where(eq(handbookSections.id, idNum))
    .returning();
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    section: { ...updated, updatedAt: updated.updatedAt.toISOString() },
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
  await db.delete(handbookSections).where(eq(handbookSections.id, idNum));
  return Response.json({ ok: true });
}
