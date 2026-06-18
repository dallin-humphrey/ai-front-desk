# AI Front Desk

A prototype "AI Front Desk" for a fictional childcare center (Maple Grove
Early Learning), built for the brightwheel take-home exercise.

Two surfaces:

- **Parent** (`/`) — mobile-friendly chat. Answers are grounded in the
  center's written handbook (stored in Postgres). Every answer is cited.
  Sensitive questions (illness, custody, complaints) refuse to give advice
  and route the parent to a person.
- **Admin** (`/admin`) — staff view, no auth. Edit handbook sections, see
  what parents are asking and where the system struggled, and turn an
  unanswered question into a real handbook entry in one click. The
  co-pilot drafts a first version of the answer in the center's voice.

## Trust architecture

- **Handbook is the only source of truth.** The model never recalls
  policies from training. Answers come from `<source>` blocks injected
  per request. If retrieval finds no match, the model is required to
  refuse and route to staff.
- **Deterministic guardrails before the LLM.** A regex classifier reads
  intent from the parent's message (emergency, complaint, medical,
  custody, individual-child) before retrieval runs. The "I love your
  food!" → AI-replies-to-a-complaint failure mode is structurally
  prevented.
- **Citation contract.** When the model has a source, it must end with
  `Source: <path>`. The UI surfaces the citation; missing citations are
  visibly wrong.
- **Audit log.** Every chat turn writes a `queryLog` row with question,
  matched section, score, and answered / escalated / sensitive flags.
  The admin analytics page is the audit trail.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4
- AI SDK 6 (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`)
- Drizzle ORM + Neon Postgres (HTTP driver)
- zod everywhere requests cross a boundary
- `@t3-oss/env-nextjs` for env validation

No tRPC, no react-query, no auth, no embeddings, no PDF ingestion. The
chat route is the only streaming endpoint; everything else is plain REST.

## Local setup

```bash
# 1. Install
npm install

# 2. Create .env.local at the repo root with two keys:
#    DATABASE_URL="postgresql://..."          # Neon pooled URL
#    ANTHROPIC_API_KEY="sk-ant-..."           # Anthropic key with spend cap

# 3. Push schema to Neon and seed the Maple Grove handbook
npm run db:generate
npm run db:push
npm run db:seed

# 4. Run
npm run dev
```

Open <http://localhost:3000> for the parent UI and <http://localhost:3000/admin>
for staff. There is no auth on the admin page; it is a prototype.

## Vercel deployment

1. Import the GitHub repo into Vercel.
2. Project Settings → Environment Variables — add `DATABASE_URL` and
   `ANTHROPIC_API_KEY` to **Production, Preview, and Development**.
3. Default Node runtime (do not select Edge). No build-time DB calls.
4. Deploy.

## Repo layout

```
src/
  app/
    page.tsx                    parent chat
    admin/page.tsx              admin console
    api/
      chat/route.ts             streaming chat pipeline
      sections/...              handbook CRUD
      sections/draft/route.ts   co-pilot draft (operator-side)
      analytics/route.ts        recent questions + counts
  lib/
    retrieve.ts                 lexical scorer (pure)
    guardrails.ts               regex intent classifier (pure)
    system-prompt.ts            prompt + per-request user context
    voice.ts                    single source of voice rules
    validators.ts               shared zod schemas
    api.ts                      typed client fetch wrapper
    constants.ts                MODEL_ID, thresholds
    center-config.ts            static center facts
  server/db/
    index.ts                    Drizzle + neon-http client
    schema.ts                   2 tables: handbook_sections, query_log
    seed.ts                     13-section Maple Grove handbook
  env.js                        zod-validated env

docs/
  implementation-plan.md        full design + build spec
  conventions.md                always-on coding rules
```

## What is intentionally out of scope

Auth, voice / TTS, a second-model review pass, vector retrieval, PDF
ingestion, real email/SMS escalation, multi-center support, rate limiting.
Each is a defensible next step but does not appear in the prototype.

See `docs/implementation-plan.md` for the full design and decisions.
