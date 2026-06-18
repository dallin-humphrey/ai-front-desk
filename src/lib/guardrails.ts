/**
 * Deterministic intent classifier — the first line of defense before the
 * LLM is ever called.
 *
 * Why this exists: lexical retrieval matches keywords but doesn't read
 * intent. A complaint that happens to mention "lunch" should NOT be
 * answered with the menu. A parent describing a fever isn't asking the
 * model to play doctor. A custody question is not a topic the AI can
 * resolve. This module classifies the user's message via regex before
 * retrieval runs, and the chat route uses the classification to:
 *   - short-circuit emergencies (no LLM call at all)
 *   - skip retrieval entirely for complaints
 *   - inject a `<safety>` directive into the user context for medical /
 *     custody / individual-child intents
 *
 * Limitation: regex sentiment is crude. Sarcasm and very dry frustration
 * will slip past `COMPLAINT`. That's an accepted tradeoff at this scope;
 * the writeup names it as a next step.
 */
import type { RetrievableSection } from "./retrieve";

/**
 * The result of classifying a user message. Drives chat-route branching
 * and the `<safety>` / `<complaint>` directive injected into the prompt.
 */
export type Sensitivity =
  | { kind: "emergency"; canned: string }
  | { kind: "complaint" }
  | { kind: "medical" }
  | { kind: "custody" }
  | { kind: "individual_child" }
  | { kind: "safe" };

const EMERGENCY =
  /\b(911|not breathing|choking|unconscious|seizure|severe (allergic|reaction))\b/i;
const COMPLAINT =
  /\b(complain|complaint|frustrat|disappoint|upset|unhappy|withdraw|cancel(ling|ing)?|refund|terrible|awful|never again|worst|sue|lawyer|unacceptable|ridiculous|furious)\b/i;
const MEDICAL =
  /\b(fever|sick|vomit(ing)?|diarrhea|temperature|rash|medication|allergic|allergy|hives|injury|hurt)\b/i;
const CUSTODY =
  /\b(custody|divorc|restraining|court order|step ?parent|legal guardian|pickup permission)\b/i;
const INDIV =
  /\b(my (child|kid|son|daughter|baby)|how did (he|she|they) (eat|nap|do|sleep)|daily sheet)\b/i;

/**
 * Read the parent's intent from a single message. Matches in this priority
 * order so the most safety-critical class wins ties (e.g. an emergency
 * message that also mentions "fever" classifies as emergency, not medical).
 */
export function classify(text: string): Sensitivity {
  if (EMERGENCY.test(text)) {
    return {
      kind: "emergency",
      canned:
        "If this is an emergency, call 911 right now. Then call us at {PHONE} so we can support you. I can't help with emergencies through chat.",
    };
  }
  if (COMPLAINT.test(text)) return { kind: "complaint" };
  if (CUSTODY.test(text)) return { kind: "custody" };
  if (INDIV.test(text)) return { kind: "individual_child" };
  if (MEDICAL.test(text)) return { kind: "medical" };
  return { kind: "safe" };
}

/**
 * Combine the parent's intent (from `classify`) with the matched section's
 * own `sensitivity` field. Classifier wins when non-safe (it reflects
 * the user's actual intent); otherwise we upgrade based on the topic.
 *
 * Without this, a calmly-worded "what's your fever policy?" would
 * classify as `safe` and skip the medical safety directive, even though
 * the matched section's sensitivity is `policy_escalate`. The two
 * dimensions are different signals and we need both.
 */
export function effectiveSensitivity(
  classifier: Sensitivity,
  section: RetrievableSection | null,
): Sensitivity {
  if (classifier.kind !== "safe") return classifier;
  if (section?.sensitivity === "handoff") return { kind: "custody" };
  if (section?.sensitivity === "policy_escalate") return { kind: "medical" };
  return classifier;
}
