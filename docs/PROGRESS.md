# PROGRESS

Update this file at the end of every task (`00-START-HERE.md` §2). The newest log entry goes at the top of §4.

## 1. Status

| ID | Sub-milestone | Payment | Target | Status | Accepted by APPLUX |
|---|---|---|---|---|---|
| M1.1 | Foundation | P1 $300 | Tue 3 Nov | In progress | — |
| M1.2 | Design system + i18n shell | P1 | Wed 4 Nov | Not started | — |
| M1.3 | CMS, pages, settings, roles | P1 | Thu 5 Nov | Not started | — |
| M2.1 | Catalogue + inventory core | P2 $250 | Sat 7 Nov | Not started | — |
| M2.2 | Shop, cart, accounts, SEO | P2 | Mon 9 Nov | Not started | — |
| M2.3 | Checkout, orders, reservations | P2 | Tue 10 Nov | Not started | — |
| M3.1 | Mobile back office + purchasing | P3 $250 | Thu 12 Nov | Not started | — |
| M3.2 | B2B, documents, pricing, loyalty, gift cards | P3 | Sat 14 Nov | Not started | — |
| M3.3 | Reviews, attendance, dashboard, POS CSV | P3 | Sun 15 Nov | Not started | — |
| M4.1 | wallee | P4 $300 | after authorisation | Not started | — |
| M4.2 | CashMag + outbox | P4 | after DEP-11 | Not started | — |
| M4.3 | Hardening + handover | P4 | after M4.1/M4.2 | Not started | — |

| Payment | Amount | Release gate passed | Requested | Released |
|---|---|---|---|---|
| P1 | $300 (funded) | — | — | — |
| P2 | $250 | — | — | — |
| P3 | $250 | — | — | — |
| P4 | $300 | — | — | — |

## 2. Open questions

Format: `Q-nn · question · owner · blocks: Mx.y · status`.

| ID | Question | Owner | Blocks | Status |
|---|---|---|---|---|
| Q-01 | Confirm D-01: MongoDB + Payload auth + S3 storage instead of Supabase PostgreSQL/Auth/Storage, to be written into the Rev 2.2 addendum | APPLUX | M1.1 (proceeding at risk) | Open |
| Q-02 | Original brand photos (DEP-01): the prototype only has Lovable CDN pointers | APPLUX / Ivo | M1.2 T6 | Open |
| Q-03 | Staging host and MongoDB Atlas project (DEP-02) | APPLUX | M1.1 T5 | Open |
| Q-04 | Promotions do not apply to B2B list prices (A-03)? | APPLUX | M3.2 T4 | Open |
| Q-05 | Loyalty points earned on `completed`, reversed on refund (A-08)? | APPLUX | M3.2 T3 | Open |
| Q-06 | Voucher VAT treatment and invoice legal mentions (DEP-07) | Golden Grape accountant | M3.2 T5 | Open |
| Q-07 | Sample CashMag daily sales export (CSV) | APPLUX | M3.3 T5 | Open |
| Q-08 | Rev 2.2 addendum text: written confirmation of the 4-payment schedule and Phase 2 trigger | APPLUX | — | Open |

## 3. Assumptions in force

| ID | Assumption | Made in | Confirmed |
|---|---|---|---|
| A-03 | Promotions skip lines priced from a customer or group price list | `04-DATA-MODEL.md` §6 | — |
| A-05 | Until DEP-06: zones = Bissen + neighbouring postal codes, 5 € fee, 30 € minimum, free from 80 €; 30-min slots, capacity 6 | M2.3 | — |
| A-07 | Until DEP-07: LU VAT 17/14/8/3 %, invoice format `INV-{YYYY}-{00000}`, PDFs marked DRAFT on staging | M3.2 | — |
| A-08 | Loyalty points earned on order completion | M3.2 | — |
| A-10 | Until a real sample: CashMag CSV columns are mapped through configurable settings | M3.3 | — |

## 4. Log

### 2026-11-02 · M1.1 T1 · Payload + Next compatibility gate
- Installed Payload 3.92.1 (exact). D-02 decided: keep Next 16.4.3 / React 19.3.0 (in Payload's peer range); Cache Components stay on.
- `app/(payload)/` copied from `create-payload-app@3.92.1`'s template (GraphQL routes and the empty `custom.scss` left out; `graphQL.disable: true`). Admin page: `export const instant = false` + `await connection()` to silence two Cache Components dev errors caused by Payload's `RootPage`.
- `lib/env.ts` written now (the config needs it) with `isBuildPhase`: during `next build` the config uses `url: false` and a dummy secret, so the build never reads env (Payload evaluates the config while collecting page data).
- Scaffold removed (`app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/favicon.ico`, `public/*.svg`). The app now uses multiple root layouts; `(site)/[locale]/layout.tsx` arrives in M1.2.
- Verified: `env -i … next build` succeeds; `next dev` → `/admin` 200, first user registered, login OK, no dev errors.
- Notes: local Node is 24.21.0, below Payload's `>=24.22.1` engine (warning only; Docker/CI use a supported version). Payload CLI must run through `node --import tsx … --disable-transpile` (see `02-ARCHITECTURE.md` §1).

### 2026-11-02 · Specification written
- Contract accepted on Upwork (P1 $300 funded, due 5 Nov).
- Prototype reviewed: `golden-grape-luxembourg/` (TanStack Start, mocked data, 4 dictionaries with 400 keys each and full parity, photos as Lovable CDN pointers).
- Stack decision D-01 (MongoDB) recorded, pending APPLUX confirmation (Q-01).
- Docs `00`–`06` and the 12 sub-milestone files created. Prototype folder gitignored.
