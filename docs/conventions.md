# Conventions — golden rules for this codebase

Always-on rules. `AGENTS.md` points here, so this file is loaded into every
agent's context. When this conflicts with default behavior or training data,
this file wins. When this conflicts with `docs/implementation-plan.md`, the
plan wins (it's the more specific spec).

---

## A. Stack lock

- **Next.js 16** with App Router. Dynamic-route params are a `Promise` — type
  handlers as `{ params: Promise<{ id: string }> }` and `await` them.
- **AI SDK 6** (`ai@6.x`). Use `streamText`, `tool`, `stepCountIs`,
  `convertToModelMessages`. The chat route returns
  `result.toUIMessageStreamResponse()`.
- **`@ai-sdk/react`** for the parent UI (`useChat`).
- **Drizzle + Neon Postgres** via `drizzle-orm/neon-http` and
  `@neondatabase/serverless`. Schema uses `pg-core`. `jsonb` with
  `.$type<string[]>()` for array columns.
- **`@t3-oss/env-nextjs` + zod** for env validation. `import { env } from "~/env"`.
- **Tailwind v4** for styling.
- **Do not add**: tRPC, react-query, Clerk, Stripe, Resend, vector DB,
  embeddings, a second LLM, voice. They are explicitly out of scope.
- **Rate limiting** is in-memory (`~/lib/rate-limit.ts`) per Vercel instance.
  This is sufficient for one-IP abuse; Upstash Redis would be the production
  upgrade for cross-instance correctness, intentionally deferred.

---

## B. Architecture rules (non-negotiable)

1. **REST route handlers only.** Every data operation is a Next route handler
   under `src/app/api/...`. The chat route is the only streaming endpoint;
   every other route returns `Response.json(...)`.
2. **Validate at every edge.** Every route handler runs `Schema.safeParse(...)`
   at the top. On failure, return `400` with the zod error. Components never
   touch the DB; they go through `~/lib/api.ts`.
3. **One data-access layer.** All DB reads/writes live behind `~/server/db`.
   Route handlers do parse → call → respond. No business logic in handlers,
   none in components.
4. **Pure logic is pure.** `lib/retrieve.ts` and `lib/guardrails.ts` take
   inputs and return outputs. They do not import `db`, `fetch`, or `env`.
5. **Drizzle inferred types only.** Use `handbookSections.$inferSelect` /
   `$inferInsert`. Never hand-write row types.
6. **One model constant.** `MODEL_ID` lives in `~/lib/constants.ts` and is
   imported in exactly one place — the chat route.
7. **Shared validators.** Request/response zod schemas live in
   `~/lib/validators.ts` and are imported by both the route handler and
   `~/lib/api.ts`.
8. **No `any` outside of generated/external boundaries.** If you find yourself
   reaching for `any`, you're missing a type from Drizzle or zod.
9. **Path alias `~/*` → `src/*`.** Already configured. Use it; never write
   relative imports across directories.

---

## C. AI / RAG rules

These exist so the model cannot invent things the center doesn't actually offer.

1. **The handbook is the only source of truth.** The `handbookSections`
   table is the entire knowledge base — prose policies AND facts (prices,
   dates, hours) all live in section content. The model never recalls
   policies or numbers from training. There are no separate `tuition` /
   `closures` / `menu` tables and no tool calls for structured data.
2. **Threshold-gated retrieval.** `lib/retrieve.ts` returns `null` when no
   section scores above the threshold. When `null` (and no prior-turn source
   exists), the chat route does **not** inject any `<source>` block, and the
   system prompt instructs the model to refuse the question and offer to
   connect with staff.
3. **Multi-source injection.** The chat route assembles a `hits[]` array of
   sources: the current turn's match is primary; any DIFFERENT section cited
   in an earlier assistant turn is added as a secondary source marked
   `role="prior_turn"`. This lets the model carry numbers across topic shifts
   (e.g. "what's the discount?" then "how much for two kids?"). Citation is
   always the primary source.
4. **Citation contract.** When a `<source title="X">…</source>` block is
   present, the model must end its answer with `Source: X`. The UI surfaces
   this; missing citations are visibly wrong.
4. **Deterministic sensitivity router.** `lib/guardrails.ts` classifies the
   user message via regex before the model is called. Emergencies
   short-circuit (no model call, canned response). Medical / custody /
   individual-child intent inject a prompt directive that forbids advice
   and forces an explicit hand-off to staff.
5. **Pinned model.** `MODEL_ID` is a constant. Don't pass a string literal
   at the call site.
6. **Cache the static system prompt.** `providerOptions.anthropic.cacheControl:
   { type: "ephemeral" }` applies to the entire `system` string. To get
   real cache hits, `system` MUST be fully static across requests. All
   per-request content (the `<source>` block, the sensitivity directive,
   today's date) goes inside the **last user message** as an XML
   `<context>` block. Do not inline per-request content into `system`.
7. **Read intent, not just keywords.** The regex sentiment/intent
   classifier in `guardrails.ts` runs before retrieval and is the guard
   against context-blind responses (the "glad you enjoyed our food"
   failure mode). A `complaint` classification SKIPS retrieval entirely
   and forces an acknowledge-and-route response, regardless of what
   keywords match a handbook section.
8. **Log every turn.** `onFinish` writes a `queryLog` row with question,
   matched section id, score, and answered/escalated/sensitive flags. No
   exceptions — the audit trail is the whole point of the admin analytics
   view.
9. **Voice rules are part of the prompt.** The "polite educator" voice
   spec lives in the static system prefix. Never weaken it: no "great
   question," no "I'm just an AI," no apology spiral, no guessing.

---

## D. UI rules

1. **Mobile-first.** Design for ~360–480px width first; desktop is a max-width
   container.
2. **Parent UI** (`/`) uses `useChat` from `@ai-sdk/react`. Render
   `message.parts`, not `message.content`.
3. **Provenance line** under every safe, grounded answer: small muted tag
   reading `From: {sectionPath}`.
4. **Escalation card** replaces the provenance line on any escalated
   answer (sensitive intent or no source match). It has an accent border,
   a one-line headline, the center phone number, and a short reinforcing
   line. This card is the visible empathy gesture — don't bury it in a
   subtitle.
5. **Admin UI** (`/admin`) has no auth. Three tabs: Handbook, Recent
   Questions, and Suggested Prompts (parent-facing chip list, operator-
   editable).
6. **The improvement loop button** ("Add to handbook →" on unanswered
   queryLog rows) is the demo's hero feature. Auto-extract keywords from
   the question on the prefill. Make it obvious and one-click.
7. **Operator co-pilot.** When the editor opens from an unanswered
   question, the chat route fires a one-shot `generateText` call against
   the question to pre-draft the section content in the center's voice.
   The operator edits/approves; the AI never auto-saves.
8. **Keyword analyzer.** The Keywords field has a `+ Suggest keywords with
   AI` button that calls `generateObject` with a typed zod schema and
   merges the returned keyword phrases (deduped against existing) into the
   chip list.

---

## E. What not to do

- Don't add features the plan doesn't list.
- Don't introduce abstractions for hypothetical future requirements.
- Don't add error handling for scenarios that can't happen at this scale.
- Don't write comments that restate what the code does. Reserve comments for
  non-obvious *why*.
- Don't create README/marketing docs unless explicitly asked.
- Don't migrate or rename without being asked — the prototype `db:push`es,
  it doesn't track migrations.
- Don't fetch external APIs at runtime (no weather, no calendar APIs). The
  center's data is what's in our DB.

---

## F. Reference repos and docs

- `node_modules/next/dist/docs/` — authoritative Next 16 docs. Read before
  writing route handlers, layouts, or anything App-Router-shaped.
- `node_modules/ai/docs/` — authoritative AI SDK 6 docs. Read before touching
  `streamText`, tools, or stop conditions.
- `../askLou/SquireSolutions/src/` — **reference only**. Lift patterns
  (error classifier, retrieval scoring shape, streamText config). Never copy
  domain logic. Never copy its tRPC/Clerk wiring.
- `docs/implementation-plan.md` — the full spec for this build. The most
  specific source of truth.

---

## G. Vercel deployment contract

- Only two env vars: `DATABASE_URL`, `ANTHROPIC_API_KEY`.
- Both set in **all three** Vercel environments (Production / Preview /
  Development). Preview deploys must boot.
- No edge runtime. Route handlers run on the default Node runtime so Drizzle
  works.
- No build-time DB calls. Anything that touches the DB happens in a request
  handler or in `seed.ts`.
