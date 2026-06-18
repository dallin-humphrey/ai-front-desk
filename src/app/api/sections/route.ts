/**
 * /api/sections — list + create handbook sections.
 *
 *   GET  → { sections: Section[] } (only active sections, sorted by path)
 *   POST → { section: Section }    (validates body via SectionInput)
 *
 * Used by the admin Handbook tab and (via `~/lib/api.ts`) any client UI.
 */
import { db } from "~/server/db";
import { handbookSections } from "~/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { SectionInput } from "~/lib/validators";

export async function GET() {
  const rows = await db
    .select()
    .from(handbookSections)
    .where(eq(handbookSections.isActive, true))
    .orderBy(asc(handbookSections.sectionPath));
  return Response.json({
    sections: rows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const parsed = SectionInput.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }
  const [inserted] = await db
    .insert(handbookSections)
    .values(parsed.data)
    .returning();
  return Response.json({
    section: { ...inserted, updatedAt: inserted.updatedAt.toISOString() },
  });
}
