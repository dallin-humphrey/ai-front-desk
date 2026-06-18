/**
 * Lexical retrieval over the handbook.
 *
 * The handbook is the only source of truth for the front desk: the model
 * is required (by the system prompt) to answer ONLY from sources we inject
 * into its context. This file decides which section gets injected.
 *
 * Pure module: no DB, no fetch, no env. The caller passes sections in and
 * gets a single best hit or null. That makes it trivial to unit-test and
 * cheap to call on every chat request.
 *
 * Scoring model:
 *   - Exact phrase match (`q.includes(kw)`)                  → +10
 *   - Partial token match against any of the section's kws   → +3 per UNIQUE query token
 *
 * The "unique query token" dedupe is critical. Without it, a common word
 * like "day" would rack up +3 for every holiday keyword in Closures &
 * Holidays (`veterans day`, `memorial day`, `labor day`, etc.) and a
 * question about packing for "the first day" of school would land on the
 * holidays section instead of "What to Bring." With dedupe, "day" can
 * only contribute +3 once per section, no matter how many keywords it
 * touches.
 *
 * Plural handling: `variants()` tries `t` and `t.slice(0, -1)` so a query
 * containing "naps" matches keyword "nap time" via the singular stem.
 * Cheap stemming that handles regular English plurals without bringing in
 * a real stemmer dependency.
 */
import { RETRIEVAL_THRESHOLD } from "./constants";

/**
 * The subset of a handbook section needed for retrieval. The chat route
 * maps DB rows into this shape so this module doesn't depend on Drizzle.
 */
export type RetrievableSection = {
  id: number;
  title: string;
  sectionPath: string;
  keywords: string[];
  content: string;
  sensitivity: "safe" | "policy_escalate" | "handoff";
};

/** A matched section plus the score it earned. Returned by `retrieve()`. */
export type Hit = { section: RetrievableSection; score: number };

/**
 * Common words stripped before scoring. Keeps short, generic words
 * ("what", "how", "is") from generating noise across all sections.
 */
export const STOPWORDS = new Set([
  "what", "is", "the", "how", "do", "i", "can", "you",
  "explain", "tell", "me", "about", "a", "an", "my", "your",
  "of", "for", "to", "in", "on", "at", "and", "or", "but",
  "are", "was", "be", "have", "has", "will", "would", "could",
  "should", "if", "it", "this", "that", "with", "from", "by",
  "as", "we", "us",
]);

/**
 * Lowercase, strip non-alphanumeric chars, split on whitespace, drop
 * tokens that are stopwords or shorter than 3 chars. Shared by `retrieve`
 * and `extractKeywords` so the admin co-pilot prefill always matches the
 * same tokens the retrieval engine looks for.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Generate match variants for a token to bridge simple English plurals
// (naps -> nap, kids -> kid, fees -> fee). Original token is always first
// so dedupe in partialMatched counts the user's actual word, not the stem.
function variants(t: string): string[] {
  const out = [t];
  if (t.endsWith("s") && t.length >= 4) out.push(t.slice(0, -1));
  return out;
}

/**
 * Score every section against the query and return the best hit, or null
 * if no section clears `RETRIEVAL_THRESHOLD`. The chat route uses the
 * returned hit to inject a `<source>` block; on null it tells the model
 * to refuse (no source = no answer).
 */
export function retrieve(
  query: string,
  sections: RetrievableSection[],
): Hit | null {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const qTokens = tokenize(query);

  const scored = sections.map((section) => {
    let exactScore = 0;
    // Dedupe partial matches by query token. Without this, common words
    // like "day" pile up across multiple holiday keywords and beat the
    // intended section.
    const partialMatched = new Set<string>();

    for (const kwRaw of section.keywords) {
      const kw = kwRaw.toLowerCase();
      if (q.includes(kw)) {
        exactScore += 10;
        continue;
      }
      for (const t of qTokens) {
        let matched = false;
        for (const v of variants(t)) {
          if (kw.includes(v) || v.includes(kw)) {
            matched = true;
            break;
          }
        }
        if (matched) {
          partialMatched.add(t);
          break;
        }
      }
    }

    const score = exactScore + partialMatched.size * 3;
    return { section, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return top && top.score >= RETRIEVAL_THRESHOLD ? top : null;
}

/**
 * Used by the admin "Add to handbook →" prefill: extracts a dedup'd list
 * of content tokens from the parent's question to seed the keyword chip
 * input. Uses the same tokenizer as `retrieve`, so the extracted keywords
 * are guaranteed to match the original question on re-ask.
 */
export function extractKeywords(text: string): string[] {
  return Array.from(new Set(tokenize(text)));
}
