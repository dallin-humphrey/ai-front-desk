import { RETRIEVAL_THRESHOLD } from "./constants";

export type RetrievableSection = {
  id: number;
  title: string;
  sectionPath: string;
  keywords: string[];
  content: string;
  sensitivity: "safe" | "policy_escalate" | "handoff";
};

export type Hit = { section: RetrievableSection; score: number };

export const STOPWORDS = new Set([
  "what", "is", "the", "how", "do", "i", "can", "you",
  "explain", "tell", "me", "about", "a", "an", "my", "your",
  "of", "for", "to", "in", "on", "at", "and", "or", "but",
  "are", "was", "be", "have", "has", "will", "would", "could",
  "should", "if", "it", "this", "that", "with", "from", "by",
  "as", "we", "us",
]);

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

export function extractKeywords(text: string): string[] {
  return Array.from(new Set(tokenize(text)));
}
