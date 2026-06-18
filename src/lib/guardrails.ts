import type { RetrievableSection } from "./retrieve";

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

// Combine the parent's intent (classifier) with the matched section's
// sensitivity field. Classifier wins when non-safe; otherwise we upgrade
// based on the topic the parent landed on.
export function effectiveSensitivity(
  classifier: Sensitivity,
  section: RetrievableSection | null,
): Sensitivity {
  if (classifier.kind !== "safe") return classifier;
  if (section?.sensitivity === "handoff") return { kind: "custody" };
  if (section?.sensitivity === "policy_escalate") return { kind: "medical" };
  return classifier;
}
