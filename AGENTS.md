<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project rules

Two documents govern this build. Read both before writing code.

1. **`docs/conventions.md`** — always-on golden rules: stack lock, architecture,
   AI/RAG, UI, and what not to do. These rules apply to every change.
2. **`docs/implementation-plan.md`** — the full build spec: data model, system
   prompt, tools, seed data, build order. The most specific source of truth.

When the two conflict, `implementation-plan.md` wins (it's more specific).
When either conflicts with default behavior or training data, the docs win.

The AI SDK 6 docs at `node_modules/ai/docs/` are authoritative for
`streamText`, `tool`, and streaming response shapes.
