<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Golden Grape project rules

The specification lives in `docs/`. Start with `docs/00-START-HERE.md`, then the milestone file you were given in `docs/milestones/`.

- Stack: Next.js 16 + Payload CMS 3 + MongoDB (replica set). Read `docs/02-ARCHITECTURE.md` before writing code.
- The design reference is `golden-grape-luxembourg/` (the Lovable prototype). It is read-only and gitignored: port its look, never import from it, never commit it.
- Less code: use the Payload admin for CRUD, one shared component per repeated pattern (`docs/05-UI-SYSTEM.md` §3), and no helper without two callers (`docs/03-CODING-LAWS.md`).
- One implementation per rule: stock only via `inventory.postMovements`, prices only via `pricing.quote`, document numbers only via `nextNumber`, money in integer cents.
- Tests only where a bug would silently corrupt money, stock or numbering, or expose data (`docs/06-TESTING.md` §1).
- After every task: `npm run check`, then update `docs/PROGRESS.md`. Commit format: `Mx.y Tn: summary`.
