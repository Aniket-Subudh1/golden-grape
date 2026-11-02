# PROGRESS

Update this file at the end of every task (`00-START-HERE.md` §2). The newest log entry goes at the top of §4.

## 1. Status

| ID | Sub-milestone | Payment | Target | Status | Accepted by APPLUX |
|---|---|---|---|---|---|
| M1.1 | Foundation | P1 $300 | Tue 3 Nov | In progress (all ACs pass locally; AC-05 waits for the first push) | — |
| M1.2 | Design system + i18n shell | P1 | Wed 4 Nov | In progress (started at risk: AC-M1.1-05 waits for a push) | — |
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
| Q-03 | Staging host and MongoDB Atlas project (DEP-02) | APPLUX | M1.1 T5 (staging deploy only: `Blocked: DEP-02`) | Open |
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

### 2026-11-02 · M1.2 T3 · Primitive components
- Packages (exact): class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, lucide-react 1.66.0, sonner 2.0.8, @radix-ui/react-slot 1.5.0. Note: lucide 1.x has no brand icons (Instagram/Facebook); the footer social icons need a solution when they come back in M1.3.
- `lib/cn.ts` (deferred from M1.1). `Button`: variants from `05` §3.2 plus `goldGlass` for the square translucent CTA repeated in Hero, Store and Happy Hour (`05` §3.2 updated). `Field` (input/textarea/select, error under the input via `aria-describedby`). `ActionForm` + `SubmitButton`: `useActionState`, pending label via `useFormStatus`, success/error toasts. It submits with `startTransition` instead of `action=`, so React's automatic form reset doesn't wipe the inputs on a validation error; the form resets on success only. `Toaster` ported.
- **Deferred, on purpose:** the shadcn `sheet`, `dialog`, `input`, `textarea`, `select`, `label`. The prototype itself only imports `dialog` (events booking, M2.3), `sheet` (cart, M2.2) and `sonner`, and nothing in M1.2 would call the others. Porting them now means unused exports (law 3, law 11; `05` §3.1 "add a primitive when a milestone needs it"). Each is ported with its first caller.
- Verified: `npm run check` passes.

### 2026-11-02 · M1.2 T2 · i18n routing and dictionaries
- `dictionaries/*.json` copied verbatim from the prototype. `lib/i18n.ts` covers the milestone API, plus `interpolate()` (`{{year}}` and later cart strings) and `rich()` (the `<gold>` tags in `story.quote` and `happyHour.subtitle`). `alternates(path, locale)` takes the locale so it can return the canonical too.
- `proxy.ts`: 307 to the NEXT_LOCALE cookie, else Accept-Language ranked by q, else `fr`. The matcher skips `admin`, `api`, `staff`, `_next` and files with an extension.
- `app/(site)/[locale]/layout.tsx` is the site's root layout: `<html lang={locale}>`, next/font Cormorant Garamond + Inter, `generateStaticParams`, unknown locale → `notFound()`. `metadataBase` comes from `appUrl()` (new in `lib/env.ts`): APP_URL is needed at build time for correct absolute URLs; `02` §7 updated.
- `typecheck` now runs `next typegen` first, so `LayoutProps`/`PageProps` exist when CI runs `tsc` before `build`.
- Verified: `npm run check` (24 unit tests, including key parity over all 441 leaves in en/de/pt). curl: `/` → `/fr`; `Accept-Language: de-DE…` → `/de`; `es,pt;q=0.5,en;q=0.7` → `/en/contact`; cookie `pt` beats header `de`; `/api/health` and `/admin/login` 200 (not redirected).

### 2026-11-02 · M1.2 T1 · Tokens
- `tw-animate-css` 1.4.0. `app/globals.css` ported from the prototype's `styles.css`. Dropped: the `dark` custom variant (no dark mode) and `source(none)` + `@source "../src"` (Tailwind's default detection already skips the gitignored prototype). Added a visible gold focus colour and a reduced-motion rule for `animate-slow-zoom`/`animate-fade-up` (`05` §7). Font variables point to the `next/font` variables wired in T2's layout.
- Found: `animate-marquee` (used by `Marquee.tsx`) is defined neither in the prototype CSS nor in `tw-animate-css`, so the prototype marquee is static. It is ported static.
- Verification (Cormorant/Inter, colours) is done with the home page in T5.

### 2026-11-02 · M1.1 report
| AC | Result | How verified |
|---|---|---|
| AC-M1.1-01 [R9] | Pass (local `mongod` rs0 instead of compose) | `npm run dev` → `/admin` 200, first user via `/api/users/first-register`, login OK, `/api/health` 200 |
| AC-M1.1-02 [V-SEC] | Pass | `env -i PATH=… npx next build` with `.env` moved away |
| AC-M1.1-03 [R9] | Pass | `lib/tx.int.test.ts` (Payload writes and raw session writes both rolled back; mutation check: committing instead of rolling back fails the test) |
| AC-M1.1-04 [V-SEC] | Pass | `lib/rate-limit.int.test.ts` (3 allowed, 4th `RATE_LIMITED`, next window allowed; 10 parallel → exactly 3) |
| AC-M1.1-05 | **Not performed** | Needs the first push to GitHub (commits are local only) |

Validation checklist: `docker compose up` **not performed** (no Docker locally). Mongo stop → 503 in 2.0 s, start → 200: **performed** on the standalone build with a throwaway replica set. Staging: **Blocked: DEP-02**. Repository sharing with APPLUX: human.

### 2026-11-02 · M1.1 T6 · Tests
- `tests/setup-int.ts` (vitest `setupFiles` of the `int` project) starts a fresh `MongoMemoryReplSet` per file and sets env before anything imports `payload.config.ts`. `tests/helpers.ts` `getTestPayload()` waits for the models' index builds (a transaction racing one fails with "Unable to acquire IX lock").
- `lib/money.test.ts` (12 vectors), `lib/tx.int.test.ts` (3), `lib/rate-limit.int.test.ts` (3).
- `auditLogs.collection` renamed `targetCollection`: `collection` is a reserved mongoose path (warning at boot). `04-DATA-MODEL.md` updated.
- Verified: `npm run check` and `npm run test:int` pass.

### 2026-11-02 · M1.1 T5 · Health, CI, Docker, staging
- `app/api/health/route.ts`: `await connection()` makes it request-time (build output shows `ƒ /api/health`). The 2 s timeout covers the ping only; Payload's one-time init is not counted (a cold dev start takes > 2 s and would report 503). The ping lives in `lib/tx.ts` (`ping()`), the only file that touches adapter internals.
- `next.config.ts`: `output: 'standalone'`, `poweredByHeader: false`. `images.remotePatterns` is added with S3 in M1.3 (no S3 URL exists yet).
- `Dockerfile` (node:24-alpine, standalone, non-root, HEALTHCHECK), `.dockerignore`. `public/` is copied once M1.2 creates it.
- `.github/workflows/ci.yml`: push → `npm ci`, `check`, `test:int`, `build` with no env; PRs to main → e2e against a `mongo:8 --replSet rs0` container. E2E runs with `--pass-with-no-tests` until the first spec lands (M1.3 T8, then remove the flag).
- Verified on the standalone build against a throwaway replica set (port 27018): `/api/health` 200, `/admin` 200, no `X-Powered-By`, TTL index on `rateLimits.expiresAt`; Mongo killed → **503 in 2.0 s**; Mongo restarted → 200 within ~1 s.
- **Not performed:** `docker build` (no Docker on the dev machine). Staging deploy: **Blocked: DEP-02** (Q-03).

### 2026-11-02 · M1.1 T4 · Module skeleton and staff users
- `modules/settings/collections.ts`: `users` (auth; `name`, `roles` select-many saved to the JWT, `active`; title = `name`), `auditLogs`, `rateLimits`. Field access and the `beforeLogin` active check stay in M1.3 T1.
- `modules/README.md` with the folder convention. No other module folders created.
- Verified: `npm run check` passes.

### 2026-11-02 · M1.1 T3 · Core library
- `lib/`: `env`, `payload`, `tx`, `errors`, `action`, `access`, `money` (+ test), `time`, `audit`, `rate-limit`. `lib/cn.ts` is **deferred to M1.2 T3**: it needs `clsx` + `tailwind-merge`, which M1.2 adds, and it has no caller before then.
- `tx.ts`: verified API comment in the file. It throws if no session exists (the adapter silently disables transactions when the URL is not a replica set). It also exports `model(payload, slug)` for raw atomic ops outside a transaction (second caller: `rate-limit.ts`).
- `access.ts` holds `ROLES` and `hasRole()` (callers: `isStaff` and `action()`). `isSelfCustomer` waits for `customers` (M2.2).
- `action()`/`publicAction()` return `(prevState, input)` for `useActionState`; input may be `FormData` or an object.
- `money.ts` rounds half away from zero with integer arithmetic. `formatMoney(123456, 'fr')` = `1\u202f234,56\u00a0€` (narrow no-break space, then no-break space).
- `auditLogs` and `rateLimits` collections created here because `audit.ts`/`rate-limit.ts` need their types. TTL: Payload has no TTL index option, so collections declare `custom.ttl` and `payload.config.ts` creates the index in `afterOpenConnection`.
- Verified: `npm run check` passes (12 unit vectors); `time.ts` checked by hand across the March DST change.

### 2026-11-02 · M1.1 T2 · Tooling
- Dev deps (exact): vitest 5.0.5, mongodb-memory-server 11.3.0, @playwright/test 1.64.1, prettier 3.9.10, prettier-plugin-tailwindcss 0.8.1. `@types/node` moved from `^20` to 24.19.2 (vitest 5 peer; matches the Node 24 runtime).
- Scripts per the milestone, plus `generate:importmap` and `payload` (CLI through tsx, see D-02 note). `engines.node` set to Payload's range.
- `vitest.config.ts` (projects `unit`, `int`), `playwright.config.ts` (desktop, Pixel 7, iPhone 14 viewport on Chromium), `compose.yaml` (mongo 8 `rs0` + init healthcheck, mailpit, minio), `.prettierrc.json`, README. Prototype folder excluded from tsc, eslint and vitest.
- Verified: `npm run lint`, `npm run typecheck` pass; `payload-types.ts` generated. `docker compose up` **not performed** (no Docker on the dev machine; local `mongod` rs0 used instead).

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
