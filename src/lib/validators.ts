import { z } from "zod";

export const Sensitivity = z.enum(["safe", "policy_escalate", "handoff"]);
export type Sensitivity = z.infer<typeof Sensitivity>;

export const SectionInput = z.object({
  sectionPath: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
  keywords: z.array(z.string().min(1).max(40)).max(60),
  sensitivity: Sensitivity.default("safe"),
  isActive: z.boolean().default(true),
});
export type SectionInput = z.infer<typeof SectionInput>;

export const SectionPatch = SectionInput.partial();
export type SectionPatch = z.infer<typeof SectionPatch>;

export const Section = SectionInput.extend({
  id: z.number().int().positive(),
  updatedAt: z.string(),
});
export type Section = z.infer<typeof Section>;

export const QueryLogRow = z.object({
  id: z.number().int().positive(),
  question: z.string(),
  matchedSectionId: z.number().int().nullable(),
  retrievalScore: z.number().int().nullable(),
  answered: z.boolean(),
  escalated: z.boolean(),
  sensitive: z.boolean(),
  answerText: z.string(),
  createdAt: z.string(),
  matchedSectionTitle: z.string().nullable().optional(),
  askedCount: z.number().int().optional(),
});
export type QueryLogRow = z.infer<typeof QueryLogRow>;

export const AnalyticsCounts = z.object({
  total: z.number().int(),
  answered: z.number().int(),
  escalated: z.number().int(),
  unanswered: z.number().int(),
  sensitive: z.number().int(),
});
export type AnalyticsCounts = z.infer<typeof AnalyticsCounts>;

export const DraftBody = z.object({
  question: z.string().min(3).max(500),
});

export const PromptInput = z.object({
  text: z.string().min(3).max(120),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
});
export type PromptInput = z.infer<typeof PromptInput>;

export const PromptPatch = PromptInput.partial();
export type PromptPatch = z.infer<typeof PromptPatch>;

export const Prompt = PromptInput.extend({
  id: z.number().int().positive(),
  updatedAt: z.string(),
});
export type Prompt = z.infer<typeof Prompt>;

export const AnalyzeKeywordsBody = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(20).max(4000),
  existingKeywords: z.array(z.string()).max(60).default([]),
});
