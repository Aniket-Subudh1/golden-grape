# PROGRESS

Update this file at the end of every task (`00-START-HERE.md` §2). The newest log entry goes at the top of §4.

## 1. Status

| ID | Sub-milestone | Payment | Target | Status | Accepted by APPLUX |
|---|---|---|---|---|---|
| M1.1 | Foundation | P1 $300 | Tue 3 Nov | Done (staging deploy: Blocked: DEP-02) | — |
| M1.2 | Design system + i18n shell | P1 | Wed 4 Nov | Done (agent checks; AC-03 side-by-side and the checklist are human) | — |
| M1.3 | CMS, pages, settings, roles | P1 | Thu 5 Nov | In progress (all ACs pass except AC-04's real e-mail delivery, which waits for SMTP) | — |
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
| P1 | $300 (funded) | Partly: local gate and CI pass; staging (DEP-02), real e-mail delivery and human checklists pending | — | — |
| P2 | $250 | — | — | — |
| P3 | $250 | — | — | — |
| P4 | $300 | — | — | — |

## 2. Open questions

Format: `Q-nn · question · owner · blocks: Mx.y · status`.

| ID | Question | Owner | Blocks | Status |
|---|---|---|---|---|
| Q-01 | Confirm D-01: MongoDB + Payload auth + S3 storage instead of Supabase PostgreSQL/Auth/Storage, to be written into the Rev 2.2 addendum | APPLUX | M1.1 (proceeding at risk) | Open |
| Q-02 | Original brand photos (DEP-01): the prototype only has Lovable CDN pointers. Missing files listed in the M1.2 T6 log entry | APPLUX / Ivo | M1.2 T6 (home covered by stand-ins) | Open |
| Q-03 | Staging host and MongoDB Atlas project (DEP-02). An Atlas cluster now exists in `.env`; use a dedicated `golden_grape` database (the cluster is shared with other projects) | APPLUX | M1.1 T5 (staging deploy only: `Blocked: DEP-02`) | Open |
| Q-04 | Promotions do not apply to B2B list prices (A-03)? | APPLUX | M3.2 T4 | Open |
| Q-05 | Loyalty points earned on `completed`, reversed on refund (A-08)? | APPLUX | M3.2 T3 | Open |
| Q-06 | Voucher VAT treatment and invoice legal mentions (DEP-07) | Golden Grape accountant | M3.2 T5 | Open |
| Q-07 | Sample CashMag daily sales export (CSV) | APPLUX | M3.3 T5 | Open |
| Q-08 | Rev 2.2 addendum text: written confirmation of the 4-payment schedule and Phase 2 trigger | APPLUX | — | Open |
| Q-09 | Which S3 bucket Golden Grape uses. The one in the local `.env` is shared with another project and is not private; the app expects a dedicated private bucket (`02` §7), preferably in an EU region for production | Aniket / APPLUX | M1.3 staging media | Open |

## 3. Assumptions in force

| ID | Assumption | Made in | Confirmed |
|---|---|---|---|
| A-03 | Promotions skip lines priced from a customer or group price list | `04-DATA-MODEL.md` §6 | — |
| A-05 | Until DEP-06: zones = Bissen + neighbouring postal codes, 5 € fee, 30 € minimum, free from 80 €; 30-min slots, capacity 6 | M2.3 | — |
| A-07 | Until DEP-07: LU VAT 17/14/8/3 %, invoice format `INV-{YYYY}-{00000}`, PDFs marked DRAFT on staging | M3.2 | — |
| A-08 | Loyalty points earned on order completion | M3.2 | — |
| A-10 | Until a real sample: CashMag CSV columns are mapped through configurable settings | M3.3 | — |
| A-11 | Catering packages have a minimum of 10 guests (the prototype set none) | M1.3 T7 seed | — |

## 4. Log

### 2026-11-03 · M1.1 AC-05 closed
- CI run on `6f89ff4` (push to main): completed, success (`check`, `test:int`, `build` with no env). AC-M1.1-05 passes, so M1.1 is Done. The e2e job runs on pull requests only and has not run in CI yet.

### 2026-11-03 · M1.3 · S3 upload check
- Real upload through the app (`POST /api/media`, admin token) with the `.env` S3 settings, records in a throwaway local database. Original + `thumb` and `card` WebP sizes landed in S3 (`hero` is correctly skipped: the image is narrower than 1920 px). `/api/media/file/…` 200 with 52903 bytes; `next/image` optimizer 200.
- For AWS S3: `S3_ENDPOINT` stays empty and `S3_REGION` must be the bucket's real region; `auto` only works on R2.
- The test bucket is not suitable as configured, see Q-09. Three test objects (`golden-grape-upload-test*`) remain in it until Aniket decides.

### 2026-11-03 · M1.3 report and P1 release gate
| AC | Result | How verified |
|---|---|---|
| AC-M1.3-01 [V-I18N] | Pass | `tests/e2e/locale.spec.ts` on desktop, Pixel 7 and iPhone 14 viewports (16 passed, 2 desktop-only skips): `/` → `/fr` with an English browser; the switcher keeps `/contact` and the cookie; on home/maison/events/catering/contact in each locale, no visible dictionary sample or localized CMS field (Maison subtitle) from another locale |
| AC-M1.3-02 [V-ADMIN] [R9] | Pass | Admin REST save of BusinessSettings with Saturday 09:00–13:00 → the next `/fr/contact` load shows it (not shown before); no redeploy (afterChange → `revalidateTag(…, { expire: 0 })`) |
| AC-M1.3-03 [V-CONT] | Pass | Admin REST edit of the Maison hero subtitle in EN → `/en/maison` shows it, `/fr/maison` unchanged |
| AC-M1.3-04 [V-NOTIF] [V-CONT] | **Partly** | Mesa Farta × 20 in the browser → stored estimate 110000 = 5500 × 20, REQ-2026-0001; `requestCatering` int tests (forged client estimate ignored). Staff and customer e-mails are rendered in the customer's locale and logged. **Real delivery not performed**: SMTP not configured yet (Aniket will add it) |
| AC-M1.3-05 [V-ADMIN] | Pass | A `stock` user in `/admin`: the menu offers only "log out" (the Stock group's collections arrive in M2.1); `/admin/globals/BusinessSettings` → Not Found; int: stock read and sales update of BusinessSettings forbidden, manager read allowed |
| AC-M1.3-06 [R9] | Pass | int: `isModuleOn('attendance')` false when unchecked, `reviews` true when checked |
| AC-M1.3-07 [V-DES] | Pass (agent), human to confirm | Playwright at 360/768/1280 on home/maison/events/catering/contact: 0 px horizontal overflow; inner-page headers solid bone with ink text |
| AC-M1.3-08 [V-CONT] | Pass | The bar shows on first visit at each width, hides after "Essentiels uniquement" and stays hidden on the next pages; **0 third-party requests** in the whole run |

**P1 release gate (`06` §5):**
1. Gate:
   - `npm run check` passes (28 unit) and `npm run test:int` passes (20: tx, rate limit, numbering, access, catering);
   - `env -i … next build` passes (exit 0);
   - `test:e2e` passes **locally** against `next dev` on a seeded throwaway database. `npm run gate` was not run in one go, because its `npm start` would boot against `.env`'s Atlas URL.
   - **CI: not run**: main is not pushed (AC-M1.1-05 also waits for this).
2. Traceability loop: all P1 IDs (V-DES, V-I18N, V-CONT, V-ADMIN, V-NOTIF, V-SEO, V-SEC, R9) are mapped.
3. `rebuild-stock`: n/a until P2.
4. ACs: M1.1 (AC-05 = CI pending), M1.2 (AC-03 side-by-side = human), M1.3 (AC-04 delivery = SMTP pending).
5. Staging: **Blocked: DEP-02**. Human checklists (roles, DE edits, PT forms in a real inbox, upload without ALT, phones) **not performed**.

**Not ready to request P1 yet.** Needed:
- push and green CI;
- `DATABASE_URL` pointing at the dedicated `golden_grape` database, then `npm run seed`;
- SMTP (and S3) values in `.env`, then re-check AC-04 in a real inbox;
- a staging deploy (DEP-02);
- the human checklists, sent to APPLUX as one list.

### 2026-11-03 · M1.3 T8 · Tests
- `tests/setup-int.ts` stubs `next/cache` (`cacheTag`, `cacheLife`, `revalidateTag`) and `next/server` (`connection`, `after`): they only exist inside a Next request. Payload, Mongo and access stay real. `tests/helpers.ts` gained `makeStaff(payload, roles)`.
- Integration:
  - `modules/settings/access.int.test.ts`: inactive login rejected (+ an active control); sales cannot update BusinessSettings; stock cannot read it, manager can; a non-admin cannot self-promote to admin; an admin cannot remove their own admin role; `isModuleOn`.
  - `lib/numbering.int.test.ts`: 1, 2, 3 per series and year; a failed transaction does not consume a number.
  - `modules/catering/service.int.test.ts`: server estimate (a forged client value is ignored), REQ-2026-0001/0002, minimum guests, the +2-days rule (boundary included), a failed validation consumes no number.
- E2E: `tests/e2e/locale.spec.ts` (journey #1). It reads `innerText` (visible only), so the hidden Activity copy of the previous page cannot cause false failures. CI now seeds before e2e, and `--pass-with-no-tests` is removed.
- Verified: `npm run test:int` 20/20; `npx playwright test` 16 passed / 2 skipped.

### 2026-11-03 · M1.3 T7 · Cookie consent and seed
- `components/site/cookie-consent.tsx`: a bottom bar on first visit, "Essentiels uniquement" / "Accepter la mesure d'audience", stored in the `gg_consent` cookie (1 year). The choice is read with `useSyncExternalStore` and nothing renders on the server, so returning visitors never see a flash. No third-party script in either case (Q§12); the spot for a future GA4 tag is documented in the component. New `cookies.*` keys in 4 languages.
- **Seed-only content moved out of the dictionaries** into `scripts/seed-content.json` (4 locales): Header/Footer labels, Happy Hour texts, `maisonPage`, `eventsPage.list`, `cateringPage.packages`. The dictionaries lost these, plus `eventsHome.items`, `store.addressValue/hoursValue`, `contactPage.hours`, `footer.legal/privacy` (now from the CMS). The seed does not depend on the gitignored prototype. (A first extraction attempt failed before writing; the dictionaries were restored from git, and the extraction now writes the JSON before stripping.)
- `scripts/seed.mts` (`npm run seed -- --email … --password … --name …`), idempotent:
  - Writes: first admin; 11 brand stand-in photos as `media` with alts in 4 languages; BusinessSettings (contact details, Mon–Fri 10–18, LU VAT); Header (Shop/Snack without href until M2.2); Footer; HappyHour (Wed–Fri 17:00–20:00); the `maison` page (published: hero, founder mediaText with quote, regions hairline grid, producers cards, values dark band, CTA "Write to us"; the prototype's Shop button returns in M2.2); 4 legal stubs (**draft**, DEP-05); 3 catering packages (28/55/95 €, min 10 guests = A-11); 4 events (**draft**, decision).
  - FR is written first; EN/DE/PT update the **same** array/block rows (row ids merged), so translations never duplicate structure.
  - `.mts` because the package is CommonJS; the config is loaded with a dynamic import (a static default import from ESM receives the CJS wrapper).
- `indexesReady(payload)` in `lib/tx.ts` (callers: seed, test helper): on a fresh database, the first transaction otherwise races mongoose's index builds ("Unable to acquire IX lock").
- **Database incident (handled with Aniket):** `.env` had been switched to an Atlas cluster shared with other projects, with no database name. My dev server and seed boots created 18 empty Golden Grape collections + 1 rate-limit doc in its `test` database. No content was written; the seed stopped at its admin check. With Aniket's OK, I dropped exactly those collections (each checked empty first). Nothing else on the cluster was touched. Aniket is changing the URL to `…/golden_grape`.
- Verified on a **throwaway local replica set** (port 27018; Atlas untouched):
  - seed run twice → 1 user, 11 media, 1 page, 4 legal (draft), 3 packages, 4 events (draft), 4 globals, no duplicates; localized rows shared (e.g. package `includes` ids identical across the 4 locales);
  - `next dev` on that DB: home/maison/events/catering/contact × 4 locales all 200; EN maison renders English blocks and alts; DE contact shows German weekdays + "Geschlossen";
  - catering in the browser: a too-soon date → "Choisissez une date au moins 2 jours à l'avance."; a valid Mesa Farta × 20 → "Merci Marie", stored **REQ-2026-0001, estimateCents 110000**, counter 1, both e-mails rendered (logged; SMTP unset).

### 2026-11-02 · M1.3 T5 + T6 · Contact and catering requests, e-mail
Committed together: the two actions send the e-mails, so neither task builds without the other.
- **Validation messages are localized.** zod schemas and `AppError` report dictionary keys (`required`, `email`, `tooShort`, `minGuests`, `dateTooSoon`, …). `ActionForm` translates them from the new `form.fields` block, toasts `form.RATE_LIMITED` / `form.error` for non-field errors, and gained `done` (the prototype's thank-you panel, `FormDone`). New `form.*`, `mail.*`, `cateringPage.request.email/emailPh` keys in 4 languages (my translations; review with DEP-05).
- `sendContact` (`modules/cms/actions.ts`): schema per the milestone; the subject chips post a hidden input. Honeypot `website`: if filled, it returns success and sends nothing (bots get no signal). `rateLimit('contact:'+ip, 5, 10 min)`; `clientIp()` added to `lib/action.ts`. Mails are sent in `after()`; failures are logged only. Nothing is stored.
- Catering module:
  - `cateringPackages` (localized name, tagline, includes; `pricePerGuestCents`, `minGuests`, `order`, image) and `cateringRequests` (API create closed). `04` updated: `number`, `contact.email`.
  - The `requestCatering` service checks the package, guests ≥ `minGuests` and date ≥ `today()` + 2 (Luxembourg; new `lib/time.ts addDays`). It computes `estimateCents = mulQty(pricePerGuestCents, guests)` on the server (the schema has no estimate field) and creates the request with `nextNumber('cateringRequest')` + `formatNumber(settings.numbering.cateringRequest)` in `withTx`.
  - The form gained an **e-mail** field (needed for the customer confirmation). The live estimate in the browser is display only.
- E-mail (`lib/mail.ts`): lazy nodemailer transport; no SMTP → the mail is logged. `render()` loads `react-dom/server` lazily and also produces a plain-text version. This works in server actions/`after()`, so the T6 risk is cleared.
  - Templates: shared `MailLayout` (logo, ink/bone/gold, business footer) + `Details` table; contact and catering staff/confirmation. Staff copy in French to `MAIL_STAFF_TO` (fallback: business e-mail, `replyTo` = customer); confirmation in the customer's language.
  - Payload's own e-mails (password reset) use `@payloadcms/email-nodemailer` with the same SMTP.
- Verified: `npm run check`, `npm run test:int`. Playwright on `/pt/contact`: an invalid submit shows "Endereço de e-mail inválido." / "Este texto é demasiado curto." and keeps the input; a valid submit shows "Obrigado Ana"; the dev log shows the PT confirmation rendered and not sent (SMTP unset). Catering is verified after the seed (T7) and in T8.

### 2026-11-02 · M1.3 T4 · Public pages from the CMS
- **Rendering strategy (Cache Components with no database at build):**
  - The static shell (dictionary content: hero, universes, craft, story, page headers) prerenders at build.
  - Every region that reads Payload (nav, footer, store hours, Happy Hour, events, maison, legal, event detail, contact info) is a server component behind `<Suspense>` that streams at request time. The service reads go through `atRequest()` (`lib/payload.ts`: `await connection()` + the module's `'use cache'` read), so they never run during `next build`, yet are cached between requests and expired by the afterChange tags.
  - `[slug]` pages pass the `params` promise into the suspended child (slug is request-time data).
  - Consequence: an unknown slug renders the not-found UI with status 200 (+ Next's `noindex`), because the response has already started streaming.
- New shared components with their first callers: `PageHero` (events, contact, legal, event detail), `MediaCard` + `MediaGrid` (events list, with a full-card link), `Blocks` + `Prose` (maison, legal), `Field size="lg"`, inline-SVG `InstagramIcon`/`FacebookIcon` (footer, contact). New `events` collection (content only: drafts, `startsAt` indexed, `priceCents`, `capacity`, read-only `booked`) + `modules/events/service.ts`.
- `lib/time.ts`: `weekHours`, `groupedHours`, `isOpenNow`, `eventDate` (Luxembourg time; checked by hand: FR/DE grouping, PT weekdays, closed dates, event time). `components/site/use-now.ts`: the shared request-safe clock (Happy Hour countdown and Store "open now").
- Pages:
  - Layout: nav from `Header` (empty href → text), footer from `Footer` + settings (socials, address, phone, e-mail) + published legal pages.
  - Home: Store (settings hours, open-now label, `mapsUrl` or a Google Maps search), HappyHour from the global (hidden when inactive or unset), Events from the next 3 published events (hidden when none).
  - `/maison`, `/events`, `/events/[slug]`, `/legal/[slug]`, `/contact` (settings info, 7-day hours, socials, map link block replacing the prototype's broken Mapbox placeholder).
  - Metadata: localized `meta.contact|events|catering` keys (4 languages, my translations; review with DEP-05) and CMS `seo`/title for maison, legal and events.
- New keys: `store.openNow/closedNow`, `contactPage.closed`, `eventsPage.empty/back`, `meta.*`.
- Verified: `npm run check`; **`env -i … next build` passes** (all locale routes ◐ partial prerender); fresh `next dev`: `/fr`, `/en/events`, `/de/contact`, `/pt/maison`, `/fr/legal/cgv` 200 with an **empty CMS** and no errors (guards for unsaved globals and settings). Content checks follow the seed (T7).

### 2026-11-02 · M1.3 T3 · Media, pages, legal, globals
- `modules/cms`:
  - `media`: localized required `alt`, `caption`; WebP sizes thumb/card/hero; focal point. `s3Storage` is enabled only when S3 env is set; the bucket stays private and files go through Payload (decision); otherwise local `./media` (gitignored).
  - `pages`: drafts; blocks hero, richText, mediaText, cardGrid (`variant` hairline | cards | dark: covers maison's regions, producers and values), cta. All text fields localized per field, so the block layout is shared and an EN edit never changes FR.
  - `legal` with drafts.
  - Globals `Header`, `Footer`, `HappyHour`. `04` §1 and `02` §7 updated (private bucket, no `S3_PUBLIC_URL`; Footer without a newsletter field and with automatic legal links; HappyHour title split A/B + `<gold>` support).
- `faq` block deferred: no page uses it (law 3, `05` §4 "no block type for a single use").
- `modules/cms/service.ts`: `getHeader/getFooter/getHappyHour/getPage/getLegal(locale)`, each `'use cache'` + tag. Pages and legal return **published** docs only. Revalidation per collection tag (`pages`, `legal`) instead of `page:<slug>`, simpler with a handful of pages.
- `lib/time.ts` now also holds `WEEKDAY_OPTIONS` and `validateHHmm` (BusinessSettings hours and HappyHour).
- Verified: `npm run check`, `npm run test:int` (Payload boots with all collections); admin import map regenerated; `/admin/collections/{media,pages}` and `/admin/globals/{BusinessSettings,HappyHour}` load. Upload checked in T7 through the seed (the local dev admin's password has changed since M1.1, so I did not use that account).

### 2026-11-02 · M1.3 T2 · Business settings, module switches, numbering
- `BusinessSettings` global (`modules/settings/globals.ts`) with the groups for M1.3: business, hours (day + HH:mm validated) + closedDates, vat, numbering, alerts, modules, paymentTerms. `loyalty`, `reviews`, `pos` and `payments` are added by their own milestones. API read and update: admin/manager. Changes vs `04` §1 (doc updated): `address` split into street/postalCode/city/country (needed for e-mails and the map link); social links named `instagram`/`facebook`; `mapsUrl`; `numbering.cateringRequest`.
- `getSettings()`: `'use cache'` + `cacheTag('settings')`, an allow-list of public fields (no IBAN/BIC/alerts/numbering). `getSettingsPrivate()` for documents and e-mails. `isModuleOn(name)`. Module gating in `admin.hidden` is not possible (it is synchronous and runs with the client user); the gated modules add their own checks.
- `counters` (hidden, unique `{series, year}`) + `lib/numbering.ts`: `nextNumber(tx, series, year)` (atomic `$inc` upsert in the caller's session) and pure `formatNumber()` with unit vectors.
- `lib/revalidate.ts`: `revalidateTagHook(tag)` with `revalidateTag(tag, { expire: 0 })`. The docs' choice for invalidations from outside a server action, and the next reload shows the edit (AC-02). Skipped when `req.context.skipRevalidate` is set (seed, tests).
- Verified: `npm run check` (28 unit), `npm run test:int` (6).

### 2026-11-02 · M1.3 T1 · Staff users and roles
- Packages (exact): @payloadcms/storage-s3 3.92.1, **@payloadcms/email-nodemailer 3.92.1** (added at Aniket's request for staff password-reset e-mails; not in the milestone list), nodemailer 10.3.1 (same major as the adapter's dependency, deduped), @types/nodemailer 8.0.2.
- Env: `S3_*`, `SMTP_*`, `MAIL_FROM`, `MAIL_STAFF_TO` in `.env.example` and `lib/env.ts`, all optional. Empty values count as unset. S3 unset → uploads in `./media`; SMTP unset → e-mails logged. Aniket fills in the real values. `S3_PUBLIC_URL` is dropped: media are served through the app (decision, see T3).
- `users`:
  - `locale` field;
  - `roles` and `active` can be set by an admin only (field access); no default role, so a new user never becomes admin by accident;
  - `beforeLogin` rejects `active: false`; `beforeChange` blocks an admin removing their own admin role.
  - Read: self, or everyone for admin/manager. Update: self or admin. Create/delete/unlock: admin. Note: the data model said update = admin only. Staff may edit their **own** profile (name, password, locale) because `roles`/`active` are field-protected.
- `hiddenUnless(...roles)` in `lib/access.ts` for `admin.hidden`; `hasRole` accepts Payload's loose `ClientUser`. Groups: users → People, auditLogs → Settings.
- Verified: `npm run check`. Login and role tests run in T8.

### 2026-11-02 · M1.2 change · French first, dropdown switcher (requested by Aniket)
- `proxy.ts`: an unprefixed URL now goes to the `NEXT_LOCALE` cookie's locale, otherwise **always `/fr`**. `Accept-Language` is no longer used. AC-M1.2-01, M1.2 T2, D-05 and `05` §3.2 updated.
- `LanguageSwitcher` is now a dropdown: a "FR ▾" button opens a bone panel listing FR Français / EN English / DE Deutsch / PT Português, with the current one in gold and ticked. It closes on outside click and Escape and has `aria-expanded`/`aria-controls`. `placement` is `below-end` in the desktop nav and `above-start` in the mobile menu (so it does not run off the bottom). New key `nav.language` in all four dictionaries. No new package.
- Verified: `npm run check`; curl redirects as above; Playwright with an English browser: `/` → `/fr`; dropdown opens (`aria-expanded=true`), Escape closes it, choosing Deutsch → `/de`, cookie `de`, `<html lang="de">`; at 360 px the panel stays on screen inside the mobile menu, 0 px overflow.

### 2026-11-02 · M1.2 report
| AC | Result | How verified |
|---|---|---|
| AC-M1.2-01 [V-I18N] | Pass (AC revised, see the change entry) | curl: `/` with `Accept-Language: en-US` → 307 `/fr`; `/contact` with `de` → `/fr/contact`; cookie `pt` → `/pt` |
| AC-M1.2-02 [V-I18N] | Pass | Playwright on `/pt`: click "English" → `/en`, cookie `NEXT_LOCALE=en`, `<html lang="en">`, visible `h1` English; key-parity unit test passes |
| AC-M1.2-03 [V-DES] | Partly verified, side-by-side is human | Port screenshots at 1280/768/360: Cormorant/Inter computed, palette, header transparent on the hero and solid after scroll, 0 px horizontal overflow. The prototype was **not** run side by side (it is a read-only TanStack/Lovable app); differences on purpose: SocialProof hidden, placeholder links hidden, 768 px overflow fixed |
| AC-M1.2-04 [V-SEO] | Pass | HTML of `/fr`: `<html lang="fr">`, canonical, 4 hreflang + x-default |
| AC-M1.2-05 [V-DES] | Pass | `grep -rn "rounded-full bg-ink text-bone" app components` → only `components/ui/button.tsx` |
| AC-M1.2-06 [V-DES] | Pass | Home HTML: no `href` to /shop or /snack; no search, account or cart controls |

Note for M1.3's locale e2e: with Cache Components, a soft navigation keeps the previous route mounted in a hidden React `<Activity>`. After switching PT → EN the Portuguese `h1` is still in the DOM, but not visible. The "no other-locale string" check must sample **visible** text (`filter({ visible: true })`).

Validation checklist: real phone and desktop in 4 languages **not performed** (human). Header readability: checked in screenshots, human to confirm. Reduced motion: **performed** (Playwright `reducedMotion: 'reduce'` → reveal opacity 1, no hero zoom). DEP-01 missing-photo list: in the T6 entry, to be sent to APPLUX (human).

### 2026-11-02 · M1.2 T7 · Tests
- `lib/i18n.test.ts` (added in T2): `06` §3.1 vectors, `interpolate`/`rich`, and key parity for en/de/pt against fr (no missing or empty leaf). No component tests (`06` §1). `npm run check` (24 unit) and `npm run test:int` (6) pass.

### 2026-11-02 · M1.2 T6 · Images (DEP-01)
- `public/brand/`: the 11 real jpgs from the prototype's `src/assets/` plus `logo-dark.png` and `logo-light.png`. `lib/brand.ts` exports the 11 slots the home page uses (`heroWine`, `universeShop|Snack|Catering|Events`, `craftCheese|Port|Pastel`, `happyHour`, `gourmetTable`, `storeInterior`). All images use `next/image` with `sizes`; the hero and the logos use `priority`.
- **Still missing (DEP-01, send to APPLUX):** the client's original photos behind the Lovable CDN pointers in `src/assets/brand/`:
  - home-store: Home_0, 2, 3, 4, 8, 9, 10, 11, 18, 21
  - owners-team: Owners_2, 3, 4, 5, 7, 8, 9
  - shop-wines-gourmet: Shop_5, 6, 8, 9, 14, 16, 37
  - snack-menu: Snack_1–7
  - catering-events: Catering_1, 4, 6–12
  - the logo jpg (`golden-grape-logo.asset.json`)

  In the prototype, the home slots pointed at these originals (e.g. hero = Home_9, store = Home_0). The stand-in jpgs are the older assets. The named slot groups (`home.*`, `owners.*`, …) are not exported until their files exist (maison/shop/snack/catering pages use them from M1.3).
- Dockerfile copies `public/` and takes `APP_URL` as a build arg.

### 2026-11-02 · M1.2 T5 · Home page
- `app/(site)/[locale]/page.tsx` with nine sections ported 1:1 in `components/site/home/`: hero, universes, marquee, hospitality, craft, store, happy-hour, story, events. Server components, except Store (parallax) and HappyHour (countdown). `generateMetadata`: new `meta.home.*` keys in all four dictionaries (the prototype's `head()` text was English-only; the FR/DE/PT translations are mine and should be reviewed with DEP-05), canonical + hreflang via `alternates`, OG and Twitter.
- Prototype placeholders replaced or hidden:
  - Store "directions" → Google Maps search for the address. "Tasting" → `/events`.
  - Happy Hour "reserve" hidden until M2.3.
  - Home events "reserve" line hidden until M2.3 (same rule as the events page in M1.3).
  - Universes Shop/Snack cards are unlinked and have no CTA until M2.2.
- **SocialProof is not rendered** (user decision): its "Google" reviews were hard-coded. It comes back with real reviews in M3.3.
- Happy Hour countdown: the prototype computed it in the browser's timezone. It now uses `nextWeekly()` (new in `lib/time.ts`, Luxembourg time) and a `useSyncExternalStore` clock that is `undefined` on the server, so the prerender never bakes a stale time (it shows `--` until hydration). Days and time (Wed–Fri 17:00) are constants until the HappyHour global (M1.3).
- Fixed two prototype layout bugs found at 768 px: Hospitality's 12-column grid with `md:gap-20` (11 × 80 px gaps) overflowed by 152 px, so it is now `lg:gap-20`; the footer email overflowed its column, so the list now uses `break-words`. 1280 px is unchanged.
- Brand images (T6 files) were added in this commit because the sections import them.
- Verified: `npm run check`; `env -i … next build` (the locale pages prerender); `/fr /en /de /pt` 200 with `<html lang>`, canonical, 4 hreflang + x-default. No `href` to /shop or /snack; no search, account or cart controls. Playwright at 1280/768/360: Cormorant on `h1`, Inter on body, header solid after scroll, **0 px horizontal overflow**, no console errors.

### 2026-11-02 · M1.2 T4 · Site components
- `Container`, `Reveal` (merged with its hook; reduced motion is handled in CSS with `motion-reduce:*`, so there is no hidden-then-shown flash), `LanguageSwitcher` (real links with `hrefLang`, sets the `NEXT_LOCALE` cookie; each language is labelled by its own name), `Nav`, `Footer`, and `NavLink` (a link, or plain text when the page does not exist yet; used by Nav and Footer).
- Nav: search, account and cart are hidden until M2.2, with a spacer so the mobile logo stays centred. The mobile menu is `inert` while closed. New keys `nav.openMenu`/`nav.closeMenu` in all four dictionaries (the prototype hard-coded English). The dictionaries were re-serialised with 2-space indentation by the script that added the keys.
- Footer: contact details are constants until M1.3 settings; the year comes from a `'use cache'` function (Cache Components forbids `new Date()` in a prerender). Hidden until real targets exist: the social icon row (no URLs; lucide 1.x has no brand icons) and the legal/privacy links (M1.3).
- Shop, Snack and Gift boxes render as text (user decision, until M2.2). Catering, Events, Maison and Contact link to pages that ship in M1.3.
- **Deferred to their first caller:** `PageHero`, `MediaCard`, `MediaGrid` (M1.3 events and catering pages) and `QtyStepper` (M2.2). The home page uses none of them (law 3).
- Verified: `npm run check` passes.

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
