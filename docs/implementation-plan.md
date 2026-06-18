# AI Front Desk — Implementation Plan

This is the single source of truth for the build. The Claude Code agent that
does the implementation reads this file and follows it. When this conflicts
with anything else (training data, defaults, the AskLou reference repo at
`../askLou/SquireSolutions`), this file wins. AskLou is a reference only —
ignore it unless something specific is missing here.

---

## 0. The bet

A mobile-friendly Q&A surface for a fictional daycare (Maple Grove Early
Learning). The model answers parent questions by reading a **single
operator-owned handbook** stored in our database. When the handbook covers
it, the answer is grounded and cited. When it doesn't, the model says so and
offers to connect them with staff. When the question is sensitive — illness,
medication, custody, a child-specific judgment — the model states the
written policy and explicitly hands off; it never plays doctor or arbiter.

Two surfaces:

- **Parent UI** (`/`) — chat, streaming answers, suggested-question chips,
  source attribution under every answer, graceful escalation card on
  sensitive or out-of-scope questions.
- **Admin UI** (`/admin`) — no auth. Two views: **Handbook** (edit any
  section, add new ones, organized by chapter) and **Recent Questions** (last
  50, with an "asked N times" badge on unanswered ones and a one-click
  **"Add to handbook →"** that closes the improvement loop on camera).

Brightwheel's evaluation criteria mapped to features:

| Criterion       | Where it lives                                                  |
| --------------- | --------------------------------------------------------------- |
| Scope finished  | Every example question answers correctly from the seed.         |
| Persuasiveness  | Improvement loop + provenance + named-incumbent framing.        |
| User empathy    | Sensitive-case copy + escalation card + educator voice.         |
| Uniqueness      | Logged miss → 1-click handbook entry, closing the loop visibly. |

---

## 1. The handbook as the source

The whole system is built around one idea: **the handbook is the only
source of truth**, and the operator owns it.

- Seeded with ~13 sections covering what a real childcare handbook covers
  (hours, tuition, illness, medication, custody, etc.). Loosely follows the
  structure of the Albuquerque DCFD handbook the assignment links to, but
  invented for Maple Grove.
- Each section has a hierarchical path (e.g., *"Health & Safety > Illness
  & Fever"*) so the admin UI displays a real handbook tree, not a flat list.
- Lexical retrieval picks the best-matching section per query and injects
  it into the system prompt as a `<source>` block. Threshold-gated — no
  match means no source means the model is required to refuse.
- The operator can edit any section, add new ones, or turn a logged miss
  into a new section in one click. Coverage scales with what the operator
  writes into the handbook.

> "Should we be able to answer any question that's in the handbook?"
> **Yes.** That's the whole point. The 13 seeded sections deliberately cover
> the standard handbook surface. If a real reviewer asks about late-pickup
> fees or what to bring on the first day, it lands on a section.

There are **no separate `tuition` / `closures` / `menu` tables** in this
build. Those facts live inside the relevant handbook sections (the
"Tuition & Fees" section contains the prices in prose; "Closures &
Holidays" lists the dates; "Lunch & Nutrition" contains this week's menu).
One table, one source, one editing surface.

---

## 2. Verified stack

Already installed (`package.json` confirmed):

```
next                       16.2.9
react / react-dom          19.2.4
typescript                 5.x
tailwindcss                4.x
ai                         6.0.207
@ai-sdk/anthropic          3.0.85
@ai-sdk/react              3.0.209
@neondatabase/serverless   1.1.0
drizzle-orm                0.45.2
drizzle-kit (dev)          0.31.10
@t3-oss/env-nextjs         0.13.11
zod                        4.4.3
tsx (dev)                  4.22.4
```

**Pinned model:** `MODEL_ID = "claude-sonnet-4-6"`. Lives in
`~/lib/constants.ts` and is imported in exactly one place — the chat route.

**Scripts to add** to `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:push":     "drizzle-kit push",
"db:seed":     "tsx src/server/db/seed.ts"
```

No tRPC, no react-query, no Clerk, no Upstash, no Stripe, no Resend. REST
route handlers everywhere. The chat route is the only streaming endpoint.

---

## 3. Architecture rules (non-negotiable)

1. **REST route handlers only.** Every data operation is a Next route
   handler. The chat route streams; everything else returns
   `Response.json(...)`.
2. **Validate at every edge.** Every handler runs `Schema.safeParse(...)` at
   the top and returns 400 on failure.
3. **One data-access layer.** All DB reads/writes live behind
   `~/server/db`. Components go through `~/lib/api.ts`.
4. **Pure logic is pure.** `lib/retrieve.ts` and `lib/guardrails.ts` take
   inputs and return outputs. No DB, no fetch, no env.
5. **Drizzle inferred types only.** `$inferSelect` / `$inferInsert`.
6. **One model constant.** `MODEL_ID` in `~/lib/constants.ts`, imported in
   exactly one place — the chat route.
7. **Next.js 16 dynamic-route params are a `Promise`.** Type as
   `{ params: Promise<{ id: string }> }` and `await params`.

---

## 4. Folder tree (target)

```
src/
  app/
    layout.tsx
    loading.tsx                 # root suspense boundary
    error.tsx                   # root error boundary (client component)
    page.tsx                    # parent chat (client component, useChat)
    admin/
      page.tsx                  # admin console (client component)
      loading.tsx
      error.tsx
    api/
      chat/route.ts             # POST, streaming
      sections/route.ts         # GET list, POST create
      sections/[id]/route.ts    # GET, PATCH, DELETE
      sections/draft/route.ts   # POST — operator co-pilot draft (§14.3)
      analytics/route.ts        # GET recent questions + counts

  server/
    db/
      index.ts                  # neon-http drizzle client
      schema.ts                 # 2 tables, one file
      seed.ts                   # tsx-run seed script

  lib/
    retrieve.ts                 # lexical scorer (pure)
    guardrails.ts               # emergency + sensitivity routing (pure)
    voice.ts                    # VOICE_RULES — single source, shared
    system-prompt.ts            # buildSystemPrompt + buildUserContext
    validators.ts               # shared zod schemas (§4.5)
    api.ts                      # typed fetch wrapper for the client (§14.0)
    constants.ts                # MODEL_ID, thresholds
    center-config.ts            # static center facts (name, phone, hours)

  components/
    chat/...
    admin/...

  env.js
  styles/globals.css
```

---

## 5. Environment & deployment

### 5.1 Env vars (just two)

| Key                 | Used in                              | Source                                            |
| ------------------- | ------------------------------------ | ------------------------------------------------- |
| `DATABASE_URL`      | `~/server/db/index.ts`               | Neon → Connection Details (pooled URL).           |
| `ANTHROPIC_API_KEY` | `~/app/api/chat/route.ts` (provider) | console.anthropic.com — set spend cap.            |

### 5.2 `src/env.js`

```js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
```

### 5.3 Local + Vercel

- `.env.local` already has both keys; `.gitignore` excludes `.env*`.
- On Vercel: add **both** keys to **Production, Preview, and Development**
  environments. Preview deploys must boot.
- Default Node runtime. No edge. No build-time DB calls.

### 5.4 First-time DB push

```bash
npm run db:generate   # writes migration SQL
npm run db:push       # applies to Neon
npm run db:seed       # writes Maple Grove handbook
```

### 5.5 `drizzle.config.ts` (root)

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema.ts",
  out:    "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
} satisfies Config;
```

---

## 6. Data model (just 2 tables)

`src/server/db/schema.ts`, all `pg-core`.

```
handbookSections
  id              serial PK
  sectionPath     text NOT NULL                    -- "Health & Safety > Illness & Fever"
  title           text NOT NULL                    -- "Illness & Fever Policy"
  content         text NOT NULL                    -- the prose
  keywords        jsonb $type<string[]> NOT NULL   -- ["fever","sick","100.4","cough"]
  sensitivity     text NOT NULL DEFAULT 'safe'     -- 'safe' | 'policy_escalate' | 'handoff'
  isActive        boolean NOT NULL DEFAULT true
  updatedAt       timestamp NOT NULL DEFAULT now() $onUpdate(now)

queryLog
  id              serial PK
  question        text NOT NULL
  matchedSectionId integer NULL REFERENCES handbookSections(id)
  retrievalScore  integer NULL
  answered        boolean NOT NULL                 -- got a real answer at all
  escalated       boolean NOT NULL                 -- model deferred to staff
  sensitive       boolean NOT NULL                 -- guardrail flagged non-safe
  answerText      text NOT NULL
  createdAt       timestamp NOT NULL DEFAULT now()
```

That's it. No separate facts tables, no escalations table, no center
settings table.

### 6.1 Shared zod schemas (`src/lib/validators.ts`)

Used by route handlers (parse incoming bodies) AND `~/lib/api.ts` (typed
response shapes for the client). Single source for both directions.

```ts
import { z } from "zod";

export const Sensitivity = z.enum(["safe", "policy_escalate", "handoff"]);

export const SectionInput = z.object({
  sectionPath: z.string().min(1).max(120),
  title:       z.string().min(1).max(120),
  content:     z.string().min(1).max(4000),
  keywords:    z.array(z.string().min(1).max(40)).max(40),
  sensitivity: Sensitivity.default("safe"),
  isActive:    z.boolean().default(true),
});

export const Section = SectionInput.extend({
  id:        z.number().int().positive(),
  updatedAt: z.string(),          // ISO from JSON
});

export const QueryLogRow = z.object({
  id:               z.number().int().positive(),
  question:         z.string(),
  matchedSectionId: z.number().int().nullable(),
  retrievalScore:   z.number().int().nullable(),
  answered:         z.boolean(),
  escalated:        z.boolean(),
  sensitive:        z.boolean(),
  answerText:       z.string(),
  createdAt:        z.string(),
  askedCount:       z.number().int().optional(),   // populated for unanswered rows
});

export const AnalyticsCounts = z.object({
  total:       z.number().int(),
  answered:    z.number().int(),
  escalated:   z.number().int(),
  unanswered:  z.number().int(),
});

export type SectionInput   = z.infer<typeof SectionInput>;
export type Section        = z.infer<typeof Section>;
export type QueryLogRow    = z.infer<typeof QueryLogRow>;
export type AnalyticsCounts = z.infer<typeof AnalyticsCounts>;
```

The `Sensitivity` enum is the **one definition** of valid sensitivity
values. Route handlers reject unknown values; UI dropdowns derive their
options from `Sensitivity.options`.

---

## 7. Center config (static, in code)

`src/lib/center-config.ts` exports a single const used by the system
prompt. Editable by changing the file, not through the admin UI (saves
build time without losing demo polish).

```ts
export const CENTER = {
  name: "Maple Grove Early Learning",
  phone: "(801) 555-0142",
  address: "1820 E. Maplewood Ln, Sandy, UT 84092",
  weekdayHours: "7:00 AM – 6:00 PM",
} as const;
```

---

## 8. Retrieval (lexical, deterministic)

`~/lib/retrieve.ts`. Pure function — caller passes sections in, gets a
single best hit or `null`.

```ts
type Section = { id: number; title: string; sectionPath: string;
                 keywords: string[]; content: string;
                 sensitivity: "safe" | "policy_escalate" | "handoff" };
type Hit = { section: Section; score: number };

const STOPWORDS = new Set(["what","is","the","how","do","i","can","you",
  "explain","tell","me","about","a","an","my","your","of","for","to","in","on","s"]);
const THRESHOLD = 6;

export function retrieve(query: string, sections: Section[]): Hit | null {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const qTokens = q.split(/\s+/).filter(t => t.length > 2 && !STOPWORDS.has(t));

  const scored = sections.map(section => {
    let score = 0;
    for (const kw of section.keywords.map(k => k.toLowerCase())) {
      if (q.includes(kw)) score += 10;                              // exact phrase
      else for (const t of qTokens)
        if (kw.includes(t) || t.includes(kw)) score += 3;           // partial match
    }
    return { section, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score >= THRESHOLD ? scored[0] : null;
}
```

The threshold (6) means roughly "two partial matches or one exact phrase."
High enough to avoid spurious hits, low enough that real questions land.
Operator effectively tunes retrieval by editing keywords on a section.

---

## 9. Guardrails (deterministic, before the LLM)

`~/lib/guardrails.ts`. Pure regex classification on the user message.

The point of these guardrails is **context-awareness that retrieval can't
provide.** Lexical scoring matches keywords; it doesn't read intent. A
complaint that happens to mention "lunch" should not be answered with the
menu. A parent describing a past injury isn't asking for the injury policy.
The classifier runs before retrieval and steers the routing.

```ts
export type Sensitivity =
  | { kind: "emergency"; canned: string }
  | { kind: "complaint" }
  | { kind: "medical" }
  | { kind: "custody" }
  | { kind: "individual_child" }
  | { kind: "safe" };

const EMERGENCY = /\b(911|not breathing|choking|unconscious|seizure|severe (allergic|reaction))\b/i;
const COMPLAINT = /\b(complain|complaint|frustrat|disappoint|upset|unhappy|withdraw|cancel(ling)?|refund|terrible|awful|never again|worst|sue|lawyer|unacceptable|ridiculous|furious)\b/i;
const MEDICAL   = /\b(fever|sick|vomit(ing)?|diarrhea|temperature|rash|medication|allergic|allergy|hives|injury|hurt)\b/i;
const CUSTODY   = /\b(custody|divorc|restraining|court order|step ?parent|legal guardian|pickup permission)\b/i;
const INDIV     = /\b(my (child|kid|son|daughter|baby)|how did (he|she|they) (eat|nap|do|sleep)|daily sheet)\b/i;

export function classify(text: string): Sensitivity {
  if (EMERGENCY.test(text)) return {
    kind: "emergency",
    canned:
      "If this is an emergency, call 911 right now. Then call us at {PHONE} " +
      "so we can support you. I can't help with emergencies through chat."
  };
  if (COMPLAINT.test(text)) return { kind: "complaint" };
  if (CUSTODY.test(text))   return { kind: "custody" };
  if (INDIV.test(text))     return { kind: "individual_child" };
  if (MEDICAL.test(text))   return { kind: "medical" };
  return { kind: "safe" };
}
```

Behavior in the chat route:

- **emergency** — short-circuit. No model call. Stream the canned text
  (phone interpolated), log with `sensitive=true, escalated=true,
  answered=true`.
- **complaint** — **skip retrieval entirely.** Inject a directive: "The
  parent is expressing frustration or a complaint. Do NOT recite policy
  or answer the question literally. Acknowledge their experience in one
  short, sincere sentence and direct them to call us so a person can
  help." Log `sensitive=true, escalated=true`. This is the guard against
  the "glad you enjoyed our food" failure mode — a complaint about lunch
  must never be answered with the menu.
- **custody** / **individual_child** — inject a directive: "Do not answer
  this; state the relevant policy if a source is provided, then direct
  the parent to contact staff directly."
- **medical** — inject a directive: "Do not give medical advice. State
  the policy from the source if any, then explicitly hand off."
- **safe** — normal grounding flow.

> Edge case worth noting: regex sentiment is crude. It will miss sarcasm
> ("Great, another snow day…") and dry frustration. That's an accepted
> limitation of the 3-hour scope; the writeup names it as a next step
> (lightweight sentiment classifier).

### 9.1 Effective sensitivity (two-dimensional)

The classifier reads the **parent's intent** from the message. The matched
handbook section carries its own `sensitivity` field reflecting the
**topic's** nature. These are different signals and both matter:

| Scenario                                                   | Classifier | Section          | Effective       |
|------------------------------------------------------------|------------|------------------|-----------------|
| "What's your fever policy?" (calm, neutral wording)        | `safe`     | `policy_escalate`| `medical`       |
| "How do I update custody info?"                            | `safe`     | `handoff`        | `custody`       |
| "My kid has a fever and I'm pissed about how this is handled" | `complaint` | `policy_escalate` | `complaint` |

Use the **stronger** of the two. The chat route computes effective
sensitivity once before calling `buildUserContext`:

```ts
function effectiveSensitivity(
  classifier: Sensitivity,
  section: Section | null
): Sensitivity {
  // Classifier takes priority when non-safe — it reflects actual intent.
  if (classifier.kind !== "safe") return classifier;
  // Otherwise upgrade based on the matched section's topic.
  if (section?.sensitivity === "handoff")         return { kind: "custody" };
  if (section?.sensitivity === "policy_escalate") return { kind: "medical" };
  return classifier;
}
```

Without this, a calmly-worded *"what's your fever policy?"* would answer
without the safety directive, because the classifier wouldn't fire on
"policy" / "fever" alone (those are descriptive, not symptomatic).

---

## 10. Voice (the polite-educator rules)

**Single source.** Lives in `src/lib/voice.ts` as
`export const VOICE_RULES = \`...\``. Imported by `system-prompt.ts`
(injected into the static system prefix) AND by the co-pilot draft route
(§14.3). Never duplicated. Change the file, both places update.

This is the most important string in the build.

```
VOICE
- Speak as "we" — you represent the center.
- Be specific. If a policy has a number (a fever threshold, a wait time,
  a price), say the number.
- Give the "why" in one short clause when it helps. Don't lecture.
- Acknowledge hard moments briefly. Don't perform sympathy.
- Keep replies short. Two or three sentences is usually right.
- Read the tone of the message, not just the words. If a parent is
  frustrated, scared, or grieving, do not respond with cheerful
  boilerplate. Match their register.
- Never say "great question," "of course," "absolutely," "thanks for
  reaching out," "I'm just an AI," or "I apologize but."
- When you don't have an answer, say so simply: "I don't have that on
  file. Let me have someone from our office reach out so you get the
  right answer." No apology spiral. No guessing.
- For sensitive cases (illness, medication, allergies, custody, anything
  about a specific child): state the written policy from the source, then
  explicitly hand off. Example: "I can't tell you whether to bring your
  child in today — please call us at {PHONE} so we can think it through
  with you."
- For complaints or expressions of frustration: do NOT answer the
  literal question. Acknowledge in one sincere sentence (no "thanks for
  the feedback") and connect them with a person. Example: "I'm sorry
  you're dealing with this. Please call our director at {PHONE} so we
  can work through it with you directly."
```

---

## 11. System prompt + per-request context

**Critical caching detail:** `providerOptions.anthropic.cacheControl`
applies to the whole `system` string. If a `<source>` block goes in
`system`, every distinct question is a cache miss. To actually benefit
from caching, the `system` parameter stays **fully static** across
requests, and per-request content (the source block, the sensitivity
directive, today's date) is injected as XML inside the latest **user
message** instead.

`buildSystemPrompt()` returns the static system string. A separate
helper, `buildUserContext({ hit, sensitivity, today })`, returns the XML
context prepended to the user's actual question.

### 11.1 Static system prompt (fully cacheable)

```
You are the AI front desk for {CENTER_NAME}, a child care center. You
help parents with quick, accurate answers grounded in our written
handbook.

ANSWER RULES
1. Answer ONLY from <source> blocks the user provides in their message
   context. If no source is provided, you do not have that information —
   say so and offer to connect the family with staff.
2. Never invent prices, dates, hours, menus, holidays, or policies. If a
   number is not in a source, you don't know it.
3. When a <source> block is present, end your reply with: "Source: {title}".
4. Keep replies short, warm, and clear.

ESCALATION RULES
- If you don't have the information, tell the parent and offer to have
  someone reach out. Do not speculate.
- Never give medical advice. For any illness, medication, allergy, or
  whether-a-specific-child question, state the written policy (if any)
  and direct the family to contact staff.
- Never resolve custody, pickup-permission, or legal questions.
- Never speak to a specific child's day, naps, meals, or behavior.
  Direct the parent to their daily sheet or to staff.

COMPLAINT RULES
- If the user message contains a <complaint/> tag in its context, the
  parent is expressing frustration or a complaint. Do NOT answer the
  literal question. Do NOT recite policy. Acknowledge their experience
  in one short, sincere sentence and direct them to call our office so
  a person can help. No "thanks for the feedback." No corporate
  boilerplate.

DATE-SENSITIVE QUESTIONS
- Today's date is provided in the <today/> tag in the user message
  context. Use it to interpret "today," "tomorrow," "this week," etc.

[VOICE rules from §10 inserted here, verbatim]

CENTER FACTS
- Name: {CENTER_NAME}
- Phone: {PHONE}
- Address: {ADDRESS}
- Weekday hours: {HOURS}
```

### 11.2 Per-request user context (NOT cached)

Built by `buildUserContext({ hit, sensitivity, today })` and prepended to
the user's raw question. Wrap everything in a `<context>` block so the
model parses it cleanly:

```xml
<context>
  <today>2026-06-17</today>
  <!-- Only present when retrieve() returned a hit above threshold -->
  <source title="Illness & Fever Policy"
          path="Health & Safety > Illness & Fever Policy">
    {content}
  </source>
  <!-- Present only when sensitivity is not "safe" -->
  <safety kind="medical">
    Do not give medical advice. State the policy from the source above
    if any, then explicitly direct the family to call us.
  </safety>
  <!-- Or, for complaints -->
  <complaint>
    The parent is expressing frustration. Acknowledge them and route
    to staff. Do not answer the literal question.
  </complaint>
</context>

{the user's actual question text}
```

The final user message sent to the model is the XML context block
followed by the parent's literal text. This keeps `system` stable and
cacheable while giving the model everything it needs per-turn.

---

## 12. The chat route

`src/app/api/chat/route.ts`. Plain Next route handler, streams via AI SDK 6.

```ts
import { streamText, stepCountIs, convertToModelMessages,
         createUIMessageStream, createUIMessageStreamResponse,
         type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { retrieve } from "~/lib/retrieve";
import { classify, effectiveSensitivity } from "~/lib/guardrails";
import { MODEL_ID } from "~/lib/constants";
import { CENTER } from "~/lib/center-config";
import { buildSystemPrompt, buildUserContext } from "~/lib/system-prompt";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const lastUser  = messages.filter(m => m.role === "user").at(-1);
  const userText  = lastUser?.parts.find(p => p.type === "text")?.text ?? "";
  const today     = new Date().toISOString().slice(0, 10);

  const sections = await db.select().from(schema.handbookSections)
    .where(eq(schema.handbookSections.isActive, true));

  // 1. Guardrail (regex sentiment + intent classifier — does NOT call LLM)
  const classifier = classify(userText);

  // 1a. Emergency short-circuit — never call the model.
  //     Hand-build a UI message stream so useChat consumes it identically
  //     to a real streamed response. Exact API: see node_modules/ai/docs
  //     for createUIMessageStream signature in v6.
  if (classifier.kind === "emergency") {
    const text = classifier.canned.replace("{PHONE}", CENTER.phone);
    await db.insert(schema.queryLog).values({
      question: userText, matchedSectionId: null, retrievalScore: null,
      answered: true, escalated: true, sensitive: true, answerText: text,
    });
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const id = "em-" + Date.now();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end",   id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // 2. Retrieve — skip entirely for complaints (we don't want to surface
  //    a policy match for a parent who's actually venting)
  const hit = classifier.kind === "complaint"
    ? null
    : retrieve(userText, sections as any);

  // 2a. Combine the parent's intent (classifier) with the matched section's
  //     sensitivity into the effective routing. This is what catches
  //     calmly-worded sensitive questions like "what's your fever policy?".
  const sensitivity = effectiveSensitivity(classifier, hit?.section ?? null);

  // 3. Build the static system + per-request user context (XML)
  const system  = buildSystemPrompt();      // fully static, cacheable
  const context = buildUserContext({ hit, sensitivity, today });

  // Rewrite the LAST user message to prepend the XML context. We mutate a
  // shallow copy so the original UIMessage array isn't touched.
  const augmented: UIMessage[] = messages.map((m, i) => {
    if (i !== messages.length - 1 || m.role !== "user") return m;
    return {
      ...m,
      parts: m.parts.map(p =>
        p.type === "text" ? { ...p, text: `${context}\n\n${p.text}` } : p),
    };
  });

  // 4. Stream
  const result = streamText({
    model: anthropic(MODEL_ID),
    system,
    messages: await convertToModelMessages(augmented),
    stopWhen: stepCountIs(2),     // safety belt; we have no tools
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },  // caches `system`
    },
    onError: ({ error }) => console.error("[chat] streamText error:", error),
    onFinish: async (r) => {
      const answered  = !!hit;
      const escalated = sensitivity.kind !== "safe" || !hit;
      await db.insert(schema.queryLog).values({
        question:         userText,
        matchedSectionId: hit?.section.id ?? null,
        retrievalScore:   hit?.score ?? null,
        answered,
        escalated,
        sensitive:        sensitivity.kind !== "safe",
        answerText:       r.text ?? "",
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
```

Key points to verify against AI SDK 6 docs while building:
- The exact `createUIMessageStream` / `createUIMessageStreamResponse`
  helper names and signatures (check `node_modules/ai/docs/`).
- That `text-start` / `text-delta` / `text-end` are the v6 part types
  `useChat` expects. If the API differs, fall back to streamText with a
  one-shot system prompt that says "Output exactly: …" — same UX, one
  extra cheap API call per emergency (rare).
- `stopWhen: stepCountIs(2)` is a safety belt — no tools means a single
  step is expected.

---

## 13. Parent UI (`/`)

**Visual direction (applies to both UIs).** Brightwheel-adjacent: warm,
soft, primary-friendly. The 2-minute video needs to *look* like a real
product, not a Tailwind starter. Lock these decisions before recording:

- **Palette:** off-white background (`bg-stone-50`), deep teal primary
  (`text-teal-700` / `bg-teal-600`), warm amber accent on the escalation
  card border (`border-amber-400`), neutral grays for text. Avoid pure
  black/white.
- **Type:** one sans-serif throughout (Inter or Geist). Body 16px, chat
  bubbles 17px, headings semibold not bold.
- **Bubbles:** parent bubbles right-aligned with `rounded-2xl` and a
  subtle teal tint; assistant bubbles left-aligned, cream background, no
  shadow. ~12px gap between turns.
- **Motion:** streaming text appears naturally via `useChat` deltas.
  Suggested chips fade in on mount (50ms stagger). Escalation card has a
  subtle scale-in. No bouncing, no spinners that look generic.

That's the whole visual brief — pick these once, apply everywhere.

---

Mobile-first. Single column, max-width ~480px on desktop. Uses `useChat`
from `@ai-sdk/react`.

- Sticky header: center name + "Front Desk" subtitle.
- Empty state: 5 suggested-question chips. 3 of Brightwheel's 5 canonical
  examples to prove the script works, 2 center-specific to prove breadth:
  - "Are you open on Veterans Day?"
  - "What's tuition for infants?"
  - "My child has a fever, can they come in?"
  - "What time does drop-off end?"
  - "What should I pack on my toddler's first day?"
- Streaming chat transcript. Render `message.parts`, not `message.content`.
- **Provenance line** under safe-grounded answers: small muted tag reading
  `From: {sectionPath}`.
- **Escalation card** under any escalated answer (sensitivity ≠ safe, OR
  no source hit). Replaces the provenance line. Has:
  - subtle accent border
  - one-line headline: *"Let's get a person involved."*
  - body: the center phone number, plus reinforcing copy. For medical:
    *"I can share our written policy, but I can't judge whether your
    child should come in. Please call us so we can think it through with
    you."* For no-match: *"This isn't in our handbook yet. Let me have
    someone from our office reach out so you get the right answer."*
- Input: textarea + send. Autofocus. Enter submits, Shift+Enter newline.
- **Loading + error states** (from `useChat`):
  - `status === "submitted"` → show a three-dot typing indicator under
    the last assistant bubble. Hide it as soon as the first delta
    arrives.
  - `status === "streaming"` → input stays enabled but a subtle pulse
    on the send icon shows work is in progress.
  - `error != null` → show an inline error banner with retry button:
    *"Hmm, that didn't go through. Try again, or call us at {PHONE}."*
    Use the AI SDK's `reload()` helper for the retry. Don't swallow
    errors — a silent hang is the worst demo failure mode.

---

## 14. Admin UI (`/admin`, no auth)

### 14.0 Client API wrapper (`src/lib/api.ts`)

One typed module the admin UI talks to. No raw `fetch` calls in
components.

```ts
import type { Section, SectionInput, QueryLogRow, AnalyticsCounts } from "./validators";

const j = async <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
};

export const api = {
  listSections:   ()                       => j<{ sections: Section[] }>(fetch("/api/sections")),
  getSection:     (id: number)             => j<{ section: Section }>(fetch(`/api/sections/${id}`)),
  createSection:  (input: SectionInput)    => j<{ section: Section }>(fetch("/api/sections",
                       { method: "POST", body: JSON.stringify(input),
                         headers: { "Content-Type": "application/json" } })),
  updateSection:  (id: number, p: Partial<SectionInput>)
                                           => j<{ section: Section }>(fetch(`/api/sections/${id}`,
                       { method: "PATCH", body: JSON.stringify(p),
                         headers: { "Content-Type": "application/json" } })),
  deleteSection:  (id: number)             => j<{ ok: true }>(fetch(`/api/sections/${id}`,
                       { method: "DELETE" })),
  draftSection:   (question: string)       => j<{ draft: string }>(fetch("/api/sections/draft",
                       { method: "POST", body: JSON.stringify({ question }),
                         headers: { "Content-Type": "application/json" } })),
  getAnalytics:   (filter?: string)        => j<{ rows: QueryLogRow[]; counts: AnalyticsCounts }>(
                       fetch(`/api/analytics${filter ? `?filter=${filter}` : ""}`)),
};
```

The matching response shapes (`Section`, `SectionInput`, `QueryLogRow`,
`AnalyticsCounts`) live in `~/lib/validators.ts` as inferred zod types
and are reused server-side for parsing.

Two tabs (§14.1 + §14.2). A third capability (§14.3) is the operator
co-pilot, which lives inside the "Add to handbook →" flow.

### 14.1 Handbook

Left rail: handbook tree, grouped by chapter (the first part of
`sectionPath`). Each section row shows title, sensitivity badge, last
edited.

Right pane: section editor when one is selected. Fields:

- Section path (text, e.g. `"Health & Safety > Illness & Fever"`)
- Title
- Sensitivity (dropdown: safe / policy_escalate / handoff, with helper
  text under each)
- Keywords (chip input — comma or enter to add)
- Content (textarea, mono font, ~12 rows visible)

"New section" button opens a blank editor. Delete button on existing
sections.

### 14.2 Recent Questions

Last 50 queryLog rows, newest first. Filter chips: **All / Unanswered /
Escalated / Sensitive**.

Each row shows the question, matched section path (or "no match"), the
sensitivity/escalation badges. On unanswered rows: an **"asked N times"**
badge computed from the analytics route (group unanswered rows by
normalized question text, count).

**The improvement-loop button.** On any unanswered row, a primary
**"Add to handbook →"** button. Click opens the Handbook tab with a new
section editor prefilled:

- Title: cleaned-up version of the question (trim, strip trailing `?`,
  capitalize first letter)
- Section path: best-guess chapter (default: `"General"`)
- Keywords: auto-extracted using **the same tokenizer as `retrieve.ts`**
  for consistency — lowercase, replace non-alphanumerics with spaces,
  split on whitespace, drop tokens of length ≤ 2 and any token in the
  `STOPWORDS` set. Dedupe. Operator edits before saving. Reusing the
  retrieval tokenizer is the point: keywords extracted this way will
  match the same query that surfaced the miss
- Content: **drafted by the operator co-pilot (§14.3)**, not blank
- Sensitivity: defaulted to `safe`

The operator reviews the draft, edits as needed, hits save, and that
question is handled from then on. This is the demo's hero moment.

### 14.3 Operator co-pilot (the "fund this engineer" feature)

When the editor opens from an unanswered question, the Content field
shows a spinner and immediately fires `api.draftSection(question)`. The
server-side route `POST /api/sections/draft` calls Claude once with the
center's voice rules and the parent's original question, and returns a
short draft paragraph the operator can edit.

**Why it matters.** Pasting a hand-typed answer takes 2–3 minutes of
camera time and reads as a chore. A live draft that fills in 2–3 seconds
flips the story from "logged miss → manual fix" to "the system proposes
its next answer; the operator approves." That's the loop a team actually
wants to fund.

**Route shape** (`src/app/api/sections/draft/route.ts`):

```ts
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { MODEL_ID } from "~/lib/constants";
import { CENTER } from "~/lib/center-config";
import { VOICE_RULES } from "~/lib/voice";   // exported from system-prompt.ts

const Body = z.object({ question: z.string().min(3).max(500) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 });

  const { text } = await generateText({
    model: anthropic(MODEL_ID),
    system: `You are drafting a new handbook entry for ${CENTER.name}, a
child care center. A parent asked the question below and our handbook
does not cover it yet. Write a short, warm, polite-educator paragraph
(60–140 words) the operator can edit and save as the answer.

${VOICE_RULES}

If you don't have specific facts (prices, dates, exact policies), use
bracketed placeholders the operator will fill in — e.g., "[discount
percentage]", "[start date]". Never invent numbers. Output only the
paragraph, no preamble, no "Here is a draft:".`,
    prompt: parsed.data.question,
  });

  return Response.json({ draft: text });
}
```

**Placeholders are deliberate.** The draft uses `[bracketed]` slots
where it doesn't know facts, so the operator's edit is a tiny insert
(*"[discount percentage]"* → *"10%"*) rather than rewriting from
scratch. That's both the right behavior (no hallucinated prices) and a
better-looking edit on camera.

**Failure modes:**
- The draft API call fails → show *"Couldn't draft a suggestion. Try
  again or write the answer yourself."* in the Content field. The
  operator can still save manually.
- The draft includes hallucinated specifics → operator catches and
  edits before saving. The system never auto-saves drafts.

This is also the single largest contributor to the "uniqueness" rubric
beyond the improvement loop itself.

---

## 15. Seed handbook (Maple Grove, ~13 sections)

`src/server/db/seed.ts` inserts these. Each section's content should mirror
the voice rules in §10 — specific, warm, explanatory in one clause where
relevant.

| #  | sectionPath                                       | sensitivity      |
|----|---------------------------------------------------|------------------|
| 1  | Daily Operations > Hours & Daily Schedule         | safe             |
| 2  | Daily Operations > Arrival & Departure            | safe             |
| 3  | Daily Operations > Late Pickup & Fees             | safe             |
| 4  | Daily Operations > Closures & Holidays            | safe             |
| 5  | Daily Operations > Communication & Daily Sheets   | safe             |
| 6  | Enrollment & Tuition > Tuition & Fees             | safe             |
| 7  | Enrollment & Tuition > Tours & Enrollment         | safe             |
| 8  | Health & Safety > Illness & Fever Policy          | policy_escalate  |
| 9  | Health & Safety > Medication Administration       | policy_escalate  |
| 10 | Health & Safety > Allergies & Special Diets       | policy_escalate  |
| 11 | Family Partnership > Custody & Authorized Pickups | handoff          |
| 12 | Daily Care > Lunch & Nutrition                    | safe             |
| 13 | Daily Care > What to Bring                        | safe             |

**Seed copy voice rules** (in addition to §10):
- Mirror real-handbook specificity. "Fever ≥100.4°F"; "fever-free for 24
  hours without medication"; "tuition $1,720/month for infants." Vague
  language reads as AI-generated; specific language reads as a real
  center's policy.
- Each section is 80–160 words. Not a paragraph dump, not a bullet list.
- Concrete details where they exist (the Veterans Day closure is on a
  date; tuition has a number per age band; lunch is a specific menu for
  this week).

**Keyword hygiene is critical.** Lexical retrieval has no semantic
understanding — "fees" won't hit a section keyed only "tuition." Seed
each section's keywords with the synonyms a parent would actually type:
`tuition / cost / price / fee / fees / pay / monthly`,
`hours / time / open / close / drop-off / pickup / schedule`,
`sick / fever / ill / temperature / unwell / cough`,
`tour / visit / look around / see the school`. Time spent on keywords is
the single biggest lever for retrieval accuracy.

---

## 16. Anti-hallucination & trust (the contract)

Five layered defenses, each enforced by code or by an explicit prompt
contract:

1. **Threshold-gated grounding.** `retrieve` returns `null` below
   threshold. No `<source>` block goes into the prompt. The prompt
   contract requires the model to refuse in that case.
2. **Single source of truth.** The DB is the only source. No web fetch,
   no external APIs, no model training-data recall allowed by the prompt.
3. **Citation contract.** When a `<source>` is present, the model must
   end with `Source: {title}`. Missing citations are visibly wrong.
4. **Sensitivity router.** Deterministic regex classification before the
   model is called. Emergencies skip the model entirely.
5. **Audit log.** Every turn writes a `queryLog` row. The operator
   analytics page is the audit trail.

**Drift control:**
- Pinned model constant. Pinned package versions. `package-lock.json`
  committed.
- Operator edits update `updatedAt`; admin UI shows it. No silent
  background "improvement."
- Seed uses upserts so re-running is idempotent.

---

## 17. Build order

Each checkpoint should leave the app boot-able.

1. **Install** (already done): `@ai-sdk/react` is installed. Add the three
   `db:*` scripts to `package.json`.
2. **Env** — `src/env.js`.
3. **DB layer** — `drizzle.config.ts`, `schema.ts`, `db/index.ts`.
   Run `db:generate && db:push`.
4. **Seed** — write `src/server/db/seed.ts` with all 13 sections. Run
   `db:seed`. From here on the DB has the handbook.
5. **Pure libs** — `constants.ts`, `center-config.ts`, `retrieve.ts`,
   `guardrails.ts`, `validators.ts`, `api.ts`, `system-prompt.ts`.
6. **REST routes** — `sections` (GET/POST), `sections/[id]` (GET/PATCH/
   DELETE), `sections/draft` (POST, co-pilot), `analytics` (GET).
7. **Chat route** — `app/api/chat/route.ts`. Riskiest piece; reserve buffer
   for the first stream test.
8. **Parent UI** — `useChat` skeleton, then chips, then provenance line,
   then the escalation card, then mobile polish.
9. **Admin UI** — handbook tree + section editor first, then Recent
   Questions, then the "Add to handbook" prefill loop with the co-pilot
   draft last (highest-impact moment).
10. **Boundaries** — `app/loading.tsx`, `app/error.tsx`,
    `app/admin/loading.tsx`, `app/admin/error.tsx`. Each is ~10 lines:
    loading shows a centered spinner with our palette; error shows a
    small banner with a Retry button (`reset()` from the boundary's
    props). Prevents cold-start flash.
11. **Polish** — walk the 5 chip questions on mobile, eyeball the
    streaming animation, verify the escalation card copy.
12. **Deploy** — push to GitHub, import in Vercel, set both env vars in
    all three environments, deploy, walk the 5 questions on the live URL.
13. **Submission** — pre-seed the queryLog (see §19 setup), then record
    the < 2 min video following §19 exactly.

---

## 18. Explicitly out of scope

- Auth on the admin UI.
- Voice / TTS / STT.
- A second-model review pass.
- Vector / embedding retrieval.
- PDF ingestion (the handbook is hand-written for Maple Grove).
- Real email / SMS escalation delivery (we capture in `queryLog`).
- Multi-center support.
- Rate limiting.
- Migrations workflow (we `db:push` once).

Each is a defensible "next step" in the writeup but does not appear in the
prototype.

---

## 19. Demo script (< 2 minute video)

Total runtime target: **90–100 seconds**.

**Setup (off-camera):**
- Open two tabs side by side: Parent UI on the left, `/admin` → Recent
  Questions on the right.
- Pre-seed the queryLog with 4 copies of an off-script question the seed
  doesn't answer — e.g., *"Do you offer a sibling discount?"* — by hitting
  chat with it four times. This makes the "asked 4 times" badge real on
  camera.
- **Pre-run the co-pilot once** in private to confirm the draft for
  *"Do you offer a sibling discount?"* reads cleanly with placeholders
  (e.g., `[discount percentage]`). If the draft is rough on the test
  run, tighten `VOICE_RULES` in `system-prompt.ts` before recording.
- Know your one edit in advance: which placeholder you'll replace
  (probably the percentage) and with what value. The edit should be
  ~3 seconds on camera, not a re-write.
- **Do not edit the auto-extracted keywords on camera.** The whole
  point is that the same query that surfaced the miss will match the
  new section. If you "clean up" keywords, the re-ask in Beat 5 may
  miss.

**Beat 1 — Happy path (~15s) [scope]**
- Parent tab. Tap *"What's tuition for infants?"* Answer streams,
  provenance shows `From: Enrollment & Tuition > Tuition & Fees`.
- Tap *"Are you open on Veterans Day?"* Answer streams, cites
  `From: Daily Operations > Closures & Holidays`.
- VO: *"Specific to this center, grounded in our handbook, never guessed."*

**Beat 2 — Sensitive case (~20s) [user empathy]**
- Tap *"My child has a fever, can they come in?"*
- Answer states the 100.4°F policy and the 24-hour rule.
- Escalation card appears: *"I can share our written policy, but I can't
  judge whether your child should come in today. Please call us at
  (801) 555-0142 so we can think it through with you."*
- VO: *"It never plays doctor. It states the policy and gets a human
  involved — the front desk's actual job."*

**Beat 3 — Knows what it doesn't know (~15s) [persuasiveness]**
- Type *"Do you offer a sibling discount?"*
- Model: *"I don't have that on file. Let me have someone from our office
  reach out so you get the right answer."* Escalation card appears.
- VO: *"When it isn't in our handbook, it says so — and routes to a
  human."*

**Beat 4 — Closing the loop (~30s) [uniqueness]**
- Flip to `/admin` → Recent Questions → Unanswered filter.
- *"Do you offer a sibling discount?"* sits at the top with
  **"asked 4 times"**.
- Click **"Add to handbook →"**. Editor opens prefilled — section path
  set, keywords auto-extracted, and the **co-pilot drafts the content
  in ~2 seconds** with `[bracketed]` placeholders for any specifics.
- VO: *"The system drafts a suggested answer in our voice — and leaves
  placeholders where it doesn't know the number."*
- Replace the placeholder with the real value (one short edit). Save.
- VO: *"The operator approves what the AI proposed. That's the loop."*

**Beat 5 — The next time (~15s) [the close]**
- Flip to parent tab. Ask the same question again.
- Answer streams in. Provenance shows the new section path.
- VO: *"Same question, real answer. That's the loop — and that's why this
  saves a busy admin hours every week."*

| Beat | Brightwheel criterion         | What it shows                              |
| ---- | ----------------------------- | ------------------------------------------ |
| 1    | Scope & completeness          | Specific, grounded, working.               |
| 2    | User empathy                  | Gracefully handles the trap question.      |
| 3    | Persuasiveness                | Refuses to hallucinate; routes to a human. |
| 4    | Uniqueness                    | The improvement loop, made tangible.       |
| 5    | Persuasiveness + completeness | Closes the loop on camera.                 |

---

## 20. Writeup outline (< 1 page)

Draft `docs/writeup.md` alongside the build. Story-first, not feature-list.

1. **The incumbent.** Open with the operator's morning, concretely.
   Name what we replace: voicemail tag, text triage, hard-to-search PDFs.
   *"Brightwheel's primer describes 850k providers operating across 15+
   disconnected systems. The most fragmented surface among them is the
   one with no system at all — parent inbound."*
2. **The bet.** A Front Desk module inside Brightwheel. The handbook is
   the source of truth, the operator owns it, and the system learns from
   what it misses.
3. **The trust architecture (one paragraph).** Threshold-gated retrieval,
   citation contract, deterministic sensitivity router, never gives
   medical or custody advice, every turn logged.
4. **The improvement loop (one paragraph).** A logged miss turns into a
   handbook entry in one click. The system gets better every day — and
   the operator stays in control.
5. **The wedge.** Even hand-wavy: "Saves a 50-family center ~5 admin hours
   per week; across 850k providers, that's a category-defining lift."
6. **What's next.** One audacious line — "Same loop applied to outbound
   draft replies, so the front desk learns to handle escalations too."
   Plus the safe next-steps: auth, voice, embeddings at scale,
   localization for global centers.
