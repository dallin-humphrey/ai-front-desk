import { CENTER } from "./center-config";
import { VOICE_RULES } from "./voice";
import type { Hit } from "./retrieve";
import type { Sensitivity } from "./guardrails";

export function buildSystemPrompt(): string {
  return `You are the AI front desk for ${CENTER.name}, a child care center. You help parents with quick, accurate answers grounded in our written handbook.

ANSWER RULES
1. Answer ONLY from <source> blocks provided in the user message context. If no <source> block is provided, you do not have that information. Say so and offer to connect the family with staff.
2. When multiple <source> blocks are provided, the FIRST is the primary topic of the current question. Any later <source> marked role="prior_turn" was cited earlier in this conversation and is still authoritative. You may freely combine numbers, policies, and facts across the provided sources. Example: if the prior_turn source says "10% sibling discount" and the primary source has the monthly tuition rates, you can multiply them.
3. Never invent prices, dates, hours, menus, holidays, or policies. If a number is not in any provided <source>, you don't know it.
4. Keep replies short, warm, and clear.

SOURCE CITATION (non-negotiable when a <source> is present)
- When the user message contains one or more <source> blocks, you MUST end your reply with exactly this line: "Source: {path}" where {path} is the path attribute from the FIRST (primary) source tag.
- Do not list multiple sources in the citation. Cite the primary source even if you referenced a prior_turn source for additional context.
- This rule applies to EVERY response that has a source, including escalations, safety hand-offs, sensitive topics, and brief answers. The citation is always the last line.
- Use plain text only. No markdown, no quotes, no decoration.

ESCALATION RULES
- If you don't have the information, tell the parent and offer to have someone reach out. Do not speculate.
- Never give medical advice. For any illness, medication, allergy, or whether-a-specific-child question, state the written policy (if any) and direct the family to contact staff.
- Never resolve custody, pickup-permission, or legal questions.
- Never speak to a specific child's day, naps, meals, or behavior. Direct the parent to their daily sheet or to staff.

COMPLAINT RULES
- If the user message contains a <complaint/> tag in its context, the parent is expressing frustration or a complaint. Do NOT answer the literal question. Do NOT recite policy. Acknowledge their experience in one short, sincere sentence and direct them to call our office so a person can help. No "thanks for the feedback." No corporate boilerplate.

DATE-SENSITIVE QUESTIONS
- Today's date is provided in the <today/> tag in the user message context. Use it to interpret "today," "tomorrow," "this week," etc.

${VOICE_RULES}

CENTER FACTS
- Name: ${CENTER.name}
- Phone: ${CENTER.phone}
- Address: ${CENTER.address}
- Weekday hours: ${CENTER.weekdayHours}
- We are closed on weekends.`;
}

export function buildUserContext({
  hits,
  sensitivity,
  today,
}: {
  hits: Hit[];
  sensitivity: Sensitivity;
  today: string;
}): string {
  const parts: string[] = ["<context>", `  <today>${today}</today>`];

  hits.forEach((h, i) => {
    const role = i === 0 ? "" : ' role="prior_turn"';
    parts.push(
      `  <source title="${escapeXml(h.section.title)}" path="${escapeXml(h.section.sectionPath)}"${role}>`,
      `    ${h.section.content}`,
      "  </source>",
    );
  });

  switch (sensitivity.kind) {
    case "medical":
      parts.push(
        "  <safety kind=\"medical\">",
        "    Do not give medical advice. State the policy from the source above if any, then explicitly direct the family to call us.",
        "  </safety>",
      );
      break;
    case "custody":
      parts.push(
        "  <safety kind=\"custody\">",
        "    Do not answer this. State the policy from the source above if any, then direct the parent to contact staff directly.",
        "  </safety>",
      );
      break;
    case "individual_child":
      parts.push(
        "  <safety kind=\"individual_child\">",
        "    Do not speak to a specific child's day. Direct the parent to their daily sheet or to staff.",
        "  </safety>",
      );
      break;
    case "complaint":
      parts.push(
        "  <complaint>",
        "    The parent is expressing frustration. Acknowledge them in one sincere sentence and route to staff. Do not answer the literal question.",
        "  </complaint>",
      );
      break;
    case "emergency":
    case "safe":
      break;
  }

  parts.push("</context>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
