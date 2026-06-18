/**
 * Tunable knobs collected in one place so the rest of the codebase doesn't
 * litter magic numbers and string literals.
 */

/**
 * The Anthropic model used everywhere we call the LLM. Pinned. Bumping
 * versions is one edit; nothing else changes.
 */
export const MODEL_ID = "claude-sonnet-4-6";

/**
 * Minimum lexical retrieval score for a section to qualify as a match.
 * Tuned to "two strong partial matches OR one exact-phrase keyword."
 * High enough to avoid spurious hits, low enough that real questions land.
 */
export const RETRIEVAL_THRESHOLD = 6;

/** Cap on the row count returned by `GET /api/analytics`. */
export const RECENT_QUESTIONS_LIMIT = 50;

// Per-IP rate limits for LLM-burning routes. Belt-and-suspenders on top of
// the Anthropic-side spend cap.
export const RATE_LIMITS = {
  // Parent chat. Burst-friendly for real testing but caps a hammer attack.
  chat: { windowMs: 60_000, max: 20 },
  // Co-pilot draft + keyword analyzer. Operator-side, lower bound.
  llmAux: { windowMs: 60_000, max: 10 },
} as const;
