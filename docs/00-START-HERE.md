# 00 · Start here

This folder is the build specification for the **Golden Grape Luxembourg** webshop and modular business platform V1. It is written for a developer or an AI coding agent who has never seen the project. Follow it literally. Where it says nothing, ask (record an open question in `PROGRESS.md`). Do not fill the gap with a guess.

## 1. Reading order

| # | Document | Answers | Read when |
|---|---|---|---|
| 1 | `AGENTS.md` (repo root) | Non-negotiable rules, Next.js 16 warning | Always, first |
| 2 | `01-CONTEXT.md` | Contract, scope, requirement IDs, payment map, exclusions, client dependencies, decisions | Always |
| 3 | `02-ARCHITECTURE.md` | Stack, folders, modules, the three invariants, request flows, adapters | Always |
| 4 | `03-CODING-LAWS.md` | How code is written; canonical patterns to copy | Always |
| 5 | `04-DATA-MODEL.md` | Every Payload collection and global, fields, indexes, invariants | Before touching a collection or query |
| 6 | `05-UI-SYSTEM.md` | Design tokens, shared components, route map, staff screen rules | Before writing anything in `app/` or `components/` |
| 7 | `06-TESTING.md` | What is tested, what is not, commands, release gates | Before writing tests; before requesting payment |
| 8 | `milestones/Mx.y-*.md` | Your assignment | Your task |
| 9 | `PROGRESS.md` | Status, open questions, assumptions, log | Before starting and when finishing |

The approved design is the Lovable prototype in `golden-grape-luxembourg/`. It is gitignored and read-only, and it is a reference only: never import from it. Milestones name the exact prototype file to port, for example `golden-grape-luxembourg/src/routes/snack.tsx`.

Next.js 16.4 differs from older versions. Before you write routing, caching, proxy or metadata code, read the matching guide in `node_modules/next/dist/docs/01-app/`, for example `01-getting-started/16-proxy.md`, `02-guides/internationalization.md` and `01-getting-started/08-caching.md`.

## 2. How to execute a milestone

1. Open `PROGRESS.md`. Check that every milestone under **Depends on** is `Done`, and that no open question marked `blocks: Mx.y` is unanswered for the tasks you plan to do.
2. Read the milestone file from top to bottom, then every section it links to.
3. Work the tasks **in the order written**. Each task runs data → server → UI → tests.
4. After each task, run `npm run check` (lint + typecheck + unit tests) plus the task's own verification.
5. When all the acceptance criteria pass, walk the validation checklist as far as an agent can. List anything that needs a human (a real phone, a real inbox, a printer) as *not performed*.
6. Add the report to `PROGRESS.md` and set the status.

Never start a later task because an earlier one is "almost done". Never mark a criterion passed that you did not run.

## 3. Milestone map

The contract has **4 payment milestones** (`01-CONTEXT.md` §3). Each one is split into **3 sub-milestones**. A payment is requested only when all three of its sub-milestones are `Done` and the release gate in `06-TESTING.md` §5 passes.

| ID | Sub-milestone | Depends on | Payment | Target |
|---|---|---|---|---|
| M1.1 | Foundation: Next + Payload + MongoDB, tooling, core lib, CI | — | P1 · $300 | Tue 3 Nov |
| M1.2 | Design system port, shared components, i18n shell | M1.1 | P1 | Wed 4 Nov |
| M1.3 | CMS, public pages, business settings, staff roles | M1.2 | P1 | Thu 5 Nov |
| M2.1 | Catalogue, packaging, inventory ledger core, import | M1.3 | P2 · $250 | Sat 7 Nov |
| M2.2 | Shop, Counter, cart, customer accounts, SEO | M2.1 | P2 | Mon 9 Nov |
| M2.3 | Checkout, order modes, reservations, events, catering, e-mails | M2.2 | P2 | Tue 10 Nov |
| M3.1 | Mobile back office, scanning, purchasing, mobile sales | M2.3 | P3 · $250 | Thu 12 Nov |
| M3.2 | B2B, documents, full pricing engine, promotions, loyalty, gift cards | M3.1 | P3 | Sat 14 Nov |
| M3.3 | Google Reviews, attendance, dashboard, POS CSV import | M3.1 (M3.2 for dashboard money) | P3 | Sun 15 Nov |
| M4.1 | wallee integration | M3.3 + APPLUX written authorisation | P4 · $300 | Agreed schedule |
| M4.2 | CashMag adapter + outbox worker | M3.3 + CashMag docs/credentials | P4 | Agreed schedule |
| M4.3 | Hardening, backups, documentation, handover | M4.1, M4.2 | P4 | Agreed schedule |

M3.3's reviews and attendance tasks can run in parallel with M3.2 because they touch different modules. Everything else is sequential.

## 4. Definition of done (every task)

- [ ] The code does exactly what the task specifies, no less and no more.
- [ ] `npm run check` passes.
- [ ] `npm run test:int` passes for any task that touches stock, money, numbering, orders or access.
- [ ] Every new pure calculation has the test vectors named in its milestone.
- [ ] Every new read path for customer data is scoped (`lib/access.ts`) and has a test proving another customer's record is not returned.
- [ ] Every new list is paginated and its query is covered by an index in `04-DATA-MODEL.md`.
- [ ] Every new env var is in `.env.example` and `02-ARCHITECTURE.md` §7.
- [ ] Every new UI string exists in all four dictionaries (`fr`, `en`, `de`, `pt`).
- [ ] No duplicated component or class string that `05-UI-SYSTEM.md` §3 already covers.
- [ ] Docs changed in the same commit as any contract or model change.
- [ ] `PROGRESS.md` has an entry for the task.

## 5. Status vocabulary

| Status | Meaning |
|---|---|
| `Not started` | Nothing committed |
| `In progress` | Some tasks committed |
| `Blocked` | Waiting on an open question or a client dependency, named by ID |
| `Done` | All acceptance criteria pass and the report is written |
| `Accepted` | APPLUX has tested it on staging and signed it in `PROGRESS.md` |

## 6. When the docs and the code disagree

The docs win until someone changes them. If the doc is clearly wrong (a typo or an impossible instruction), fix the doc and the code in one commit and say so in the report. If it is a design question, record it as an open question tagged `@dev` and carry on with the work it does not block.
