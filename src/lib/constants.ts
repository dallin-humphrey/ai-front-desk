export const MODEL_ID = "claude-sonnet-4-6";

export const RETRIEVAL_THRESHOLD = 6;
export const RECENT_QUESTIONS_LIMIT = 50;

// Per-IP rate limits for LLM-burning routes. Belt-and-suspenders on top of
// the Anthropic-side spend cap.
export const RATE_LIMITS = {
  // Parent chat. Burst-friendly for real testing but caps a hammer attack.
  chat: { windowMs: 60_000, max: 20 },
  // Co-pilot draft + keyword analyzer. Operator-side, lower bound.
  llmAux: { windowMs: 60_000, max: 10 },
} as const;
