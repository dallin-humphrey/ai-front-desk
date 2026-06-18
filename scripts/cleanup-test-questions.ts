/**
 * One-off cleanup: delete throwaway test questions from query_log.
 * Edit the array below and run with `npx tsx scripts/cleanup-test-questions.ts`.
 * Does NOT touch handbook_sections or suggested_prompts.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import { queryLog } from "../src/server/db/schema";

const QUESTIONS_TO_DELETE = ["hi"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(neon(url));

  const before = await db
    .select({ id: queryLog.id })
    .from(queryLog)
    .where(
      QUESTIONS_TO_DELETE.length === 1
        ? eq(queryLog.question, QUESTIONS_TO_DELETE[0])
        : inArray(queryLog.question, QUESTIONS_TO_DELETE),
    );

  if (before.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  await db.delete(queryLog).where(
    QUESTIONS_TO_DELETE.length === 1
      ? eq(queryLog.question, QUESTIONS_TO_DELETE[0])
      : inArray(queryLog.question, QUESTIONS_TO_DELETE),
  );

  console.log(`Deleted ${before.length} row(s) matching ${JSON.stringify(QUESTIONS_TO_DELETE)}.`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
