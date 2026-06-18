/**
 * GET /api/analytics — backs the admin Recent Questions tab.
 *
 * Query: `?filter=all|unanswered|escalated|sensitive`
 * Returns: `{ rows: QueryLogRow[], counts: AnalyticsCounts }`
 *
 * The `askedCount` field on each row is the count of unanswered turns
 * whose normalized question text matches. Under the "unanswered" filter
 * the rows are deduped by normalized question (one row per unique
 * question) and sorted by `askedCount` desc, then recency — so the
 * operator sees the most-asked gaps at the top of the list.
 */
import { db } from "~/server/db";
import { handbookSections, queryLog } from "~/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { RECENT_QUESTIONS_LIMIT } from "~/lib/constants";

type Filter = "all" | "unanswered" | "escalated" | "sensitive";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filter = (url.searchParams.get("filter") ?? "all") as Filter;

  // Pull recent rows joined with section title.
  const rows = await db
    .select({
      id: queryLog.id,
      question: queryLog.question,
      matchedSectionId: queryLog.matchedSectionId,
      retrievalScore: queryLog.retrievalScore,
      answered: queryLog.answered,
      escalated: queryLog.escalated,
      sensitive: queryLog.sensitive,
      answerText: queryLog.answerText,
      createdAt: queryLog.createdAt,
      matchedSectionTitle: handbookSections.sectionPath,
    })
    .from(queryLog)
    .leftJoin(
      handbookSections,
      eq(queryLog.matchedSectionId, handbookSections.id),
    )
    .orderBy(desc(queryLog.createdAt))
    .limit(1000);

  // Compute "asked N times" for unanswered questions by normalized text.
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const askedCount = new Map<string, number>();
  for (const r of rows) {
    if (!r.answered) {
      const key = normalize(r.question);
      askedCount.set(key, (askedCount.get(key) ?? 0) + 1);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    askedCount: !r.answered ? askedCount.get(normalize(r.question)) : undefined,
  }));

  const counts = {
    total: enriched.length,
    answered: enriched.filter((r) => r.answered).length,
    escalated: enriched.filter((r) => r.escalated).length,
    unanswered: enriched.filter((r) => !r.answered).length,
    sensitive: enriched.filter((r) => r.sensitive).length,
  };

  let filtered = enriched;
  if (filter === "unanswered") {
    // Dedupe by normalized question text. Show the most recent occurrence
    // per unique question, sorted by asked-count desc (the "what to fix
    // first" prioritization), then recency. One row per question keeps the
    // improvement-loop button list scannable.
    const seen = new Set<string>();
    const deduped = [];
    for (const r of filtered.filter((r) => !r.answered)) {
      const key = normalize(r.question);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    deduped.sort(
      (a, b) =>
        (b.askedCount ?? 0) - (a.askedCount ?? 0) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    filtered = deduped;
  } else if (filter === "escalated") {
    filtered = filtered.filter((r) => r.escalated);
  } else if (filter === "sensitive") {
    filtered = filtered.filter((r) => r.sensitive);
  }

  return Response.json({
    rows: filtered.slice(0, RECENT_QUESTIONS_LIMIT),
    counts,
  });
}
