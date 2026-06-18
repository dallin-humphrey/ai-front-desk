/**
 * Drizzle schema. Three tables:
 *
 *   handbook_sections — the knowledge base. Each row is one section of
 *     the operator-owned handbook. Sensitivity tier (`safe` /
 *     `policy_escalate` / `handoff`) drives the chat route's safety
 *     routing. Keywords power lexical retrieval in `~/lib/retrieve.ts`.
 *
 *   query_log — append-only audit log. The chat route writes one row per
 *     turn. The admin Recent Questions tab is the read side.
 *
 *   suggested_prompts — the chip list parents see in the empty state.
 *     Operator-editable so phrasing can be tuned without a code change.
 *
 * Inferred row types (HandbookSection, QueryLogRow, SuggestedPrompt) and
 * insert types are exported from this module — never hand-write row
 * types elsewhere.
 */
import {
  pgTable,
  serial,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const handbookSections = pgTable("handbook_sections", {
  id: serial("id").primaryKey(),
  sectionPath: text("section_path").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  sensitivity: text("sensitivity").notNull().default("safe"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const queryLog = pgTable("query_log", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  matchedSectionId: integer("matched_section_id").references(
    () => handbookSections.id,
    { onDelete: "set null" },
  ),
  retrievalScore: integer("retrieval_score"),
  answered: boolean("answered").notNull(),
  escalated: boolean("escalated").notNull(),
  sensitive: boolean("sensitive").notNull(),
  answerText: text("answer_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Parent-facing suggested-question chips shown in the empty state.
// Operator-editable from the admin UI so the chips can be tuned alongside
// the handbook without a code change.
export const suggestedPrompts = pgTable("suggested_prompts", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type HandbookSection = typeof handbookSections.$inferSelect;
export type NewHandbookSection = typeof handbookSections.$inferInsert;
export type QueryLogRow = typeof queryLog.$inferSelect;
export type NewQueryLogRow = typeof queryLog.$inferInsert;
export type SuggestedPrompt = typeof suggestedPrompts.$inferSelect;
export type NewSuggestedPrompt = typeof suggestedPrompts.$inferInsert;
