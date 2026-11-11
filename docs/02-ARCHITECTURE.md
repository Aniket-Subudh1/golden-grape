# 02 · Architecture

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js **16.4.x** (App Router), React 19.3, TypeScript 5 strict | Read `node_modules/next/dist/docs/` before writing routing, proxy, caching or metadata code |
| Back office | **Payload CMS 3** running inside the same Next app (`@payloadcms/next`) | The admin UI covers every CRUD. Exact version is pinned in M1.1 T1 (D-02). |
| Database | **MongoDB** via `@payloadcms/db-mongodb` (D-01) | Must be a replica set for transactions: Atlas, or local `mongo --replSet rs0` |
| Auth | Payload auth: `users` (staff) and `customers` (shop accounts) are separate auth collections | Separate cookies, separate login pages |
| Media | Payload upload collection + S3-compatible storage adapter (`@payloadcms/storage-s3`) | MinIO locally; R2, S3 or Hetzner in production |
| Styling | Tailwind CSS 4 + tokens ported from the prototype (`05-UI-SYSTEM.md`) | No CSS-in-JS |
| UI primitives | shadcn/ui (Radix), **only** the ones used (`05-UI-SYSTEM.md` §3.1) | `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, `sonner` |
| Validation | `zod` | One schema per action input |
| E-mail | `nodemailer` (any SMTP) + templates written as plain TSX rendered to HTML with `react-dom/server` | Mailpit locally |
| PDF | `@react-pdf/renderer` | Invoices, delivery notes, quotations, credit notes (M3.2) |
| Scanning | `@zxing/browser` (camera); hardware scanners act as a keyboard | M3.1 |
| QR | `qrcode` | Review QR, attendance QR, gift cards, payment links |
| Motion | `gsap` 3.15.0 with ScrollTrigger (`lib/gsap.ts`): marquee, parallax, Story words. Scroll-linked only, always behind `prefers-reduced-motion` | Added at Aniket's request |
| Tests | Vitest, `mongodb-memory-server` (replica set), Playwright | `06-TESTING.md` |
| Runtime | Node `^22.23.4` or `>=24.22.1` (Payload engines), Docker image, any host (Hetzner, AWS, …) | Q§10 |

Add a package only when a milestone lists it under **Packages added**. Install it with `npm install --save-exact` and record the version here.

Pinned in M1.1 (D-02): `next` 16.4.3, `react`/`react-dom` 19.3.0, `payload`, `@payloadcms/next`, `@payloadcms/db-mongodb`, `@payloadcms/richtext-lexical` 3.92.1, `sharp` 0.35.5, `graphql` 16.14.2, `zod` 4.6.7. Added in M2.1: `papaparse` 5.7.0 (+ `@types/papaparse` 5.5.2, dev). Added for DEP-04 (7 Nov): `read-excel-file` 9.3.14 (reads .xlsx in `lib/table.ts`; MIT, no native code).

The Payload CLI is run as `node --import tsx ./node_modules/payload/bin.js <cmd> --disable-transpile` (the npm scripts do this). Its default `tsImport` loader loads `undici` twice and crashes with `TypeError: Illegal constructor`.

## 2. Folder layout

```
app/
  (site)/[locale]/              public website and shop (FR/EN/DE/PT)
    layout.tsx                  Nav + Footer + CartProvider + CartSheet + Toaster
    page.tsx                    home
    shop/, shop/[slug]/, snack/, catering/, events/, events/[slug]/, maison/, contact/,
    legal/[slug]/, account/, auth/, checkout/, order/[id]/
  (staff)/staff/                mobile back office (staff auth), see 05 §5
  (payload)/admin/[[...segments]]/   Payload admin (generated)
  (payload)/api/[...slug]/      Payload REST used by the admin (generated)
  api/health/route.ts           health check
  api/webhooks/[provider]/route.ts   payment / POS webhooks (M4)
  api/cron/[job]/route.ts       scheduled jobs, protected by CRON_SECRET (quotations-expire since 11 Nov 2026)
  api/documents/[id]/route.ts   stored PDFs (quotations): staff, the owning customer, or a link token
  sitemap.ts, robots.ts
components/
  ui/                           shadcn primitives actually used
  site/                         public-site components (ported from the prototype)
  staff/                        mobile staff components
lib/                            cross-cutting code with no business rules (see §3)
modules/<module>/               business modules (see §4)
payload.config.ts               composes every module's collections and globals
proxy.ts                        locale redirect and staff guard (Next 16 "proxy", formerly middleware)
dictionaries/{fr,en,de,pt}.json UI strings, copied from the prototype's src/locales/*.json
scripts/                        import, seed, backup, restore
tests/                          setup, helpers, e2e/
docs/                           this specification
```

## 3. `lib/`: shared, rule-free building blocks

| File | Purpose |
|---|---|
| `lib/env.ts` | zod-parsed `process.env`; the only reader of env vars |
| `lib/payload.ts` | `getPayloadClient()`, a cached `getPayload({ config })` |
| `lib/tx.ts` | `withTx(payload, fn)` opens a transaction, passes `req` (and the Mongo session for raw atomic ops), and commits or rolls back. When MongoDB aborts it with a `TransientTransactionError` (two transactions writing the same stock row), it runs `fn` again on a fresh transaction, like the driver's `withTransaction`. **The only file that touches Payload transaction internals.** Inside a transaction, run Payload calls one after the other: parallel operations on one session can fail. |
| `lib/errors.ts` | `AppError(code, message, field?)`, with codes `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OUT_OF_STOCK`, `RATE_LIMITED` |
| `lib/action.ts` | `action(schema, { roles }, fn)` and `publicAction(schema, fn)`: the only way to write a server action (03 §4) |
| `lib/access.ts` | Payload access functions: `isStaff(...roles)`, `isSelfCustomer`, `staffOrSelf`, `publicRead`, `published` |
| `lib/money.ts` | Integer-cent arithmetic, `vatFromGross`, `netToGross`, `formatMoney(cents, locale)` |
| `lib/time.ts` | `Europe/Luxembourg` helpers: `today()`, `toLocal()`, `startOfDay()`, `monthRange()` |
| `lib/i18n.ts` | `LOCALES`, `isLocale`, `getDictionary(locale)`, `alternates(path)` for hreflang |
| `lib/audit.ts` | `audit(req, action, target, before?, after?)` writes to `auditLogs` |
| `lib/mail.ts` | `sendMail({ to, subject, html, text })` + `render(template, locale, data)` |
| `lib/rate-limit.ts` | Fixed-window limiter stored in Mongo (`rateLimits` TTL collection); no Redis needed |
| `lib/numbering.ts` | `nextNumber(tx, series, year)`: gapless document numbers (§5.3) |
| `lib/cn.ts` | `cn()` = `twMerge(clsx())` |

## 4. Modules

Each business area is a folder. **Modules talk to each other only through the functions exported from `service.ts`.** No module imports another module's `collections.ts` or reads another module's collections directly with `payload.find`. Payload relationship fields between collections are allowed, because they are schema, not code coupling.

```
modules/<name>/
  collections.ts     Payload CollectionConfig[] / GlobalConfig[] for this module
  service.ts         the module's public functions (server-only)
  actions.ts         server actions for this module's UI (thin: validate → service)
  <pure>.ts          pure logic (no I/O), e.g. slots.ts, pricing.ts, packaging.ts
  <pure>.test.ts     unit tests next to the logic
  components/        UI used only by this module (optional)
```

| Module | Owns (collections/globals) | Public service functions (examples) | Built in |
|---|---|---|---|
| `settings` | `BusinessSettings` global, `counters` | `getSettings()`, `isModuleOn(name)` | M1.3 |
| `cms` | `pages`, `media`, `legal`, `Header`/`Footer`/`HappyHour` globals | `getPage(slug, locale)` | M1.3 |
| `catalogue` | `categories`, `brands`, `products`, `variants`, `packagingUnits` | `findSellable(ids)`, `findByBarcode(code)` | M2.1 |
| `inventory` | `stockMovements`, `stockLevels`, `stockCounts` | **`postMovements(tx, lines)`**, `onHand(ids)`, `lowStock()` | M2.1 |
| `customers` | `customers`, `customerGroups` | `getCustomer(id)`, `currentCustomer()` | M2.2 |
| `webshop` | none (the cart lives in the browser: `{ variant, unit?, qty }` only) | `shopPage`, `productPage`, `counterMenu`; `CartProvider`/`useCart`, `quoteCartAction` | M2.2 |
| `sales` | `orders`, `reservations`, `deliveryZones`, `slotRules` | `placeOrder(input)`, `transition(orderId, to)`, `slotCalendar(mode)`, `zoneFor(postalCode)`, `transitionReservation(id, to)` | M2.3 |
| `payments` | `payments` | `provider(name)` → `start`, `capture`, `void`, `refund` (in the caller's transaction) | M2.3 (manual), M4.1 (wallee) |
| `events` | `events`, `eventBookings` | `upcomingEvents(locale)`, `bookEvent(input)`, `seatsLeft(ids)` | M1.3 (content), M2.3 (booking) |
| `catering` | `cateringPackages`, `cateringRequests` | `requestCatering(input)` | M1.3 |
| `notifications` | none (e-mail templates only) | template components rendered by `lib/mail.ts` | M1.3 |
| `purchasing` | `suppliers`, `supplierProducts`, `purchaseOrders` | `receive(poId, lines)`, `reorderList()` | M3.1 |
| `promotions` | `priceLists`, `promotions`, `discountCodes`, `loyaltyLedger`, `giftCards`, `giftCardLedger` | **`quote(cart, customer, channel)`**, `redeem(tx, quote)` | M2.2 (v1), M3.2 (full) |
| `documents` | `quotations`, `invoices`, `deliveryNotes`, `creditNotes` | `issueInvoice(orderId)`, `pdf(docId)` | M3.2 |
| `reviews` | `ReviewsCache` global | `latestReviews()`, `refreshReviews()` | M3.3 |
| `attendance` | `attendance`, `attendanceCorrections` | `checkInOut(userId, token)`, `monthlyReport(month)` | M3.3 |
| `reporting` | none (read-only aggregations) | `salesSummary(range)` (totals; T4 adds `groupBy`), `salesOverview(now)` (the dashboard's comparisons) | M3.3 (totals built early, 9 Nov) |
| `pos` | `outbox`, `integrationLogs`, `posImports` | `enqueue(event)`, `importCsv(file)`, `connector()` | M3.3, M4.2 |

**Module switches:** `BusinessSettings.modules` (a checkbox per optional module: `b2b`, `purchasing`, `promotions`, `loyalty`, `giftCards`, `reviews`, `attendance`, `pos`). When a module is off, its staff routes return `notFound()`, its admin collections are hidden (`admin.hidden`), and its public UI is not rendered. Core modules (`settings`, `cms`, `catalogue`, `inventory`, `sales`) cannot be switched off.

## 5. The three invariants

### 5.1 Stock is never edited directly (R1, R2, R12)

- `stockMovements` is append-only: there is no update or delete access for anyone. Each row has `variant`, `qty` (signed, **base units**), `type` (`sale`, `return`, `adjustment`, `count`, `receipt`, `pos_import`, `cancel`), `reason`, `user`, `ref` (order, PO, count or import id), `channel` and `createdAt`.
- `stockLevels` holds one doc per variant with `onHand`, `lowStockThreshold` and `updatedAt`. It is a **denormalized cache** written only by `postMovements`.
- `inventory.postMovements(tx, lines)`:
  1. Converts each line from its packaging unit into base units with `qty × unit.factor` (`modules/catalogue/packaging.ts`, pure).
  2. Merges lines by variant.
  3. For each variant whose delta is negative and whose type is `sale`, runs an atomic conditional update `{ variant, onHand: { $gte: -delta } } → $inc onHand` in the transaction session. If nothing matches, it throws `AppError('OUT_OF_STOCK', …, variantId)` and the whole transaction rolls back.
  4. For the other types it runs an unconditional `$inc` (upsert). Adjustments and counts may take stock to any value ≥ 0, and POS imports are facts that are recorded even when the result is negative, flagged for review.
  5. Inserts the movement rows in the same transaction.
- `scripts/rebuild-stock.mts` (`npm run rebuild-stock -- --check`) recomputes `onHand = Σ qty` from the ledger and reports any difference. It runs in tests and before handover, which proves the cache and the ledger agree.

### 5.2 One pricing engine (R5, R7)

`modules/promotions/pricing.ts` exports a **pure** `quote(input) → Quote`, where `input = { lines, customer?, channel, code?, loyaltyPoints?, giftCards?, now, catalogue, rules }`. The I/O wrapper in `service.ts` loads `catalogue` and `rules`, then calls it. The webshop cart, checkout, mobile sale, quotation and invoice all call the same function, and nothing else computes a price. The order of operations is fixed and documented in `04-DATA-MODEL.md` §6. Money is integer cents with half-up rounding per line.

### 5.3 Gapless document numbers (R5)

`lib/numbering.ts`'s `nextNumber(tx, series, year)` runs `findOneAndUpdate({ series, year }, { $inc: { last: 1 } }, { upsert: true, returnDocument: 'after', session })` on `counters` **inside the same transaction that inserts the document**. If the insert fails, the increment rolls back with it, so numbers stay gapless and never repeat. The format comes from `BusinessSettings.numbering[series]` (for example `FAC-{YYYY}-{00000}`; the defaults are `NUMBERING` in `modules/settings/globals.ts`). An issued invoice or credit note has no update or delete access; corrections are made by credit note.

## 6. Request flows

**Webshop order (Phase 1):** the client cart (localStorage, as in the prototype) is submitted through the `placeOrder` action with an `idempotencyKey`. The action validates input with zod, then runs `withTx`:
1. Check the idempotency key. If it already exists, return the existing order.
2. Call `pricing.quote` with server prices (client prices are ignored).
3. Check the slot capacity.
4. Insert the order with status `pending`.
5. Call `payments.provider('manual').start()`, which returns `{ status: 'awaiting_payment' | 'confirmed' }`.
6. If the order is confirmed, call `postMovements(sale)` and enqueue the confirmation e-mail.

After commit, the outbox (M3.3/M4.2) mirrors the order to the POS when the POS module is on. On cancel or refund, `transition()` posts `cancel` movements with the opposite sign in a transaction.

**Reservation with pre-order:** created as `pending` with **no stock movement**. `accept` posts the sale movements (and, with wallee in M4.1, captures the payment). `reject` and `cancel` never post movements and, in M4.1, void the authorisation.

**Mobile sale (M3.1):** the same `placeOrder` with `channel: 'mobile'`, a staff user and a customer, priced by `quote` with the customer's list. Payment is `manual` (on site or invoiced) in Phase 1, or a wallee link in M4.1.

**Catalogue import / export (back office, 7 Nov):** `/admin/import-export` (`components/admin/import-export.tsx`, managers and stock staff). Products: upload `.xlsx`/`.csv` → `inspectImportFile` suggests a mapping (template names) → staff map each field to a column or to one value for every row → `checkCatalogueImport` runs every check, nothing written → `runCatalogueImport` writes 100 rows per call (the page loops; each call re-checks the whole file and writes one `catalogue.import` audit line). All of it is `modules/catalogue/import.ts`, the same code as the CLI and the seed. Export: `exportCatalogue` in the import's format (+ `stock_on_hand`), so export → Excel → import changes only what was edited (an unchanged description is not rewritten, so its formatting survives). Stock: a count from a file (`sku`|`barcode`, `counted`) becomes an **open** `stockCounts` document that staff post as usual (`postCount` → `postMovements`); the movement history exports as CSV. History is never imported: the ledger is append-only.

**POS sale import (M3.3):** CSV upload, parse, match by barcode or reference, show a preview with unmatched rows, then confirm. A transaction creates one `pos` order per receipt plus movements. The import's file hash is unique, so the same file cannot be imported twice.

**Outbox (M3.3/M4.2):** domain code calls `pos.enqueue(tx, event)` inside its transaction. A scheduled job (`scripts/outbox.ts`, run by cron or the Payload jobs queue) sends pending rows through `connector()`, using backoff of 1 min, 5 min, 30 min, 2 h, then 12 h. It records the result in `integrationLogs` and alerts by e-mail after the last retry. The admin has a "Retry now" button.

## 7. Environment variables

Every variable lives in `.env.example` and is parsed by `lib/env.ts`. The build must succeed with **no** env vars set, so env is read lazily at runtime.

| Variable | Added in | Example (local) |
|---|---|---|
| `DATABASE_URL` | M1.1 | `mongodb://localhost:27017/golden_grape?replicaSet=rs0&directConnection=true` |
| `PAYLOAD_SECRET` | M1.1 | 32+ random chars |
| `APP_URL` | M1.1 | `http://localhost:3000`. Also needed **at build time** for the real site (prerendered pages bake absolute canonical/hreflang URLs; the build falls back to localhost when unset) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` | M1.3 | Any S3-compatible bucket, kept **private**: media are served through the app at `/api/media/file/…` (no public URL). Unset → uploads stored in `./media` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`, `MAIL_STAFF_TO` | M1.3 | Any SMTP (Mailpit `localhost:1025` locally). Unset `SMTP_HOST` → e-mails are logged, not sent |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | M4.3 | Cloudflare test keys |
| `ATTENDANCE_SECRET` | M3.3 | 32+ random chars |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `GBP_ACCOUNT_ID`, `GBP_LOCATION_ID`, `GBP_OAUTH_*` | M3.3 | optional; the feature degrades without them |
| `WALLEE_SPACE_ID`, `WALLEE_USER_ID`, `WALLEE_API_SECRET`, `WALLEE_WEBHOOK_*` | M4.1 | test space |
| `CASHMAG_*` | M4.2 | from the CashMag docs |
| `CRON_SECRET` | Q-12 (11 Nov 2026) | protects scheduled-job routes (`Authorization: Bearer …`, at least 24 characters); unset → every job call is refused. Production: daily `quotations-expire` from `/etc/cron.d/golden-grape-jobs` |

## 8. Local stack (`compose.yaml`)

| Service | Image | Port | Purpose |
|---|---|---|---|
| `mongo` | `mongo:8` with `--replSet rs0` + an init healthcheck running `rs.initiate()` | 27017 | database with transactions |
| `mailpit` | `axllent/mailpit` | 1025 SMTP, 8025 UI | e-mail capture |
| `minio` | `minio/minio` | 9000 / 9001 | S3-compatible media |

`npm run dev` runs Next with Payload. `npm run seed` creates the first admin plus demo catalogue data from the prototype's hard-coded arrays (the products, menu, packages and events in `golden-grape-luxembourg/src/routes/*.tsx`).

## 9. Deployment

The site runs as one standalone Next process that serves the site, the admin and `/staff`. Scheduled jobs (low-stock digest, outbox, reviews refresh, backups) are HTTP routes protected by `CRON_SECRET` and called by the host's cron, so no extra worker process is needed. On the current server: `CRON_SECRET` in `/opt/golden-grape/.env` (then `pm2 reload /opt/golden-grape/ecosystem.config.cjs --update-env`), `scripts/server/gg-job.sh` as `/usr/local/bin/gg-job`, `scripts/server/golden-grape-jobs.cron` as `/etc/cron.d/golden-grape-jobs`; `gg-job quotations-expire` runs one by hand. Production deployment, DNS and live credentials belong to APPLUX (Q§12); the `Dockerfile` stays available for such a host.

**Current host: `goldengrape.devsomeware.com`.** A push to `main` deploys by itself once CI has passed.

- **Automatic:** `/etc/cron.d/golden-grape` runs `gg-deploy --auto` every minute. It compares GitHub's `main` with the running release, and when they differ and that commit's CI run succeeded, it deploys. Pushes that touch only `docs/**` or `*.md` have no CI run and deploy nothing. A failed commit is not retried until the next push. Log: `/var/log/gg-deploy.log`. This relies on the repo being public; a private repo needs a read token on the server.
- **By hand:** `npm run deploy` (asks for the server password), or `gg-deploy` on the server.
- **What it does** (`scripts/server/deploy.sh`): fetches `main`, builds on the server, packages the standalone release and hands it to `scripts/server/receive-release.sh`. That unpacks into `/opt/golden-grape/releases/<sha>`, points the `current` symlink at it and runs `pm2 reload` (cluster mode: the new process starts before the old one stops). It then checks that the running process is this release and that `/api/health` and `/fr` answer. If not, it **rolls back** to the previous release. It keeps 3 releases.

| Path on the server | What |
|---|---|
| `/opt/golden-grape/.env` | Secrets (mode 600); never in a release |
| `/opt/golden-grape/current` | Symlink to the active release |
| `/opt/golden-grape/releases/` | The last 3 releases |
| `/opt/golden-grape/shared/next-cache` | Optimised images, kept across deployments |
| `/opt/golden-grape/source` | Git checkout where releases are built, also used for the seed |
| `/opt/golden-grape/ecosystem.config.cjs`, `/etc/nginx/conf.d/goldengrape.conf` | Copies of `scripts/server/*`. Change them there and copy by hand: a push does not update server config |

Manual rollback: `ln -sfn /opt/golden-grape/releases/<sha> /opt/golden-grape/current && pm2 reload /opt/golden-grape/ecosystem.config.cjs`.

A push never changes the database. Content changes in the seed need `cd /opt/golden-grape/source && npm run seed`, which overwrites CMS edits to the seeded documents.
