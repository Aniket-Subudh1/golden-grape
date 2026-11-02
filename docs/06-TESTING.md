# 06 · Testing and validation

## 1. Policy: test what can silently go wrong

Write a test only when a bug would **silently** produce wrong money, wrong stock, a duplicate, a gap in a document number, or one customer seeing another's data. Everything else is covered by types, lint, a build that succeeds, and the human validation checklist.

| Write tests for | Do **not** write tests for |
|---|---|
| Pure rules: money/VAT rounding, packaging conversion, pricing engine, slots, zones, order state machine, QR tokens, CSV parsing/matching, PDF totals | Payload CRUD, admin screens, field config |
| Transactions: stock guard under concurrency, gapless numbering under concurrency, idempotent create, conditional `$inc` (seats, codes, gift cards, loyalty) | Static CMS rendering, page markup, styling, snapshots |
| Access scoping: customer A cannot read B's orders, addresses, invoices, loyalty | Third-party library internals (Payload, zxing, react-pdf) |
| Webhooks: signature check, replay is a no-op (M4.1) | Getters, trivial wrappers, constants |
| The 5 critical user journeys end-to-end (§3.3) | Every page end-to-end |

A test that cannot fail for a realistic bug is deleted.

## 2. Tooling

| Layer | Tool | Location | Runs against |
|---|---|---|---|
| Unit | Vitest | `modules/**/<file>.test.ts`, `lib/**/*.test.ts` | pure functions only, no DB |
| Integration | Vitest + `mongodb-memory-server` **replica set** + Payload local API | `modules/**/*.int.test.ts` | a fresh in-memory replica set per file; `payload.config.ts` with test env |
| E2E | Playwright (Chromium desktop + Pixel 7 + iPhone 14 viewports) | `tests/e2e/*.spec.ts` | `npm run build && npm start` on the compose stack, seeded by `npm run seed:test` |

`tests/helpers.ts` holds the shared helpers: `getTestPayload()`, `makeStaff(role)`, `makeCustomer()`, `makeVariant({ onHand, price, packaging })`, `parallel(n, fn)`. No other helper files.

## 3. What each layer covers (cumulative)

### 3.1 Unit (by milestone)
| Milestone | File | Vectors (minimum) |
|---|---|---|
| M1.1 | `lib/money.test.ts` | 1999 × 3 = 5997; `vatFromGross(1170, 1700) = 170`; `vatFromGross(1000, 300) = 29`; half-up 0.5 cent; `formatMoney(123456, 'fr') = "1 234,56 €"` (check the exact space character produced by Intl) |
| M1.2 | `lib/i18n.test.ts` | `alternates('/shop')` gives 4 hreflang entries + x-default; `isLocale('es') = false` |
| M2.1 | `modules/catalogue/packaging.test.ts` | box6 × 2 → 12; box12 × 1 → 12; base × 5 → 5; factor < 2 is rejected |
| M2.3 | `modules/sales/slots.test.ts`, `zones.test.ts`, `order-states.test.ts` | see M2.3 T1–T3 |
| M3.2 | `modules/promotions/pricing.test.ts` | the vector table in M3.2 T4 (≥ 15 rows) |
| M3.3 | `modules/attendance/qr-token.test.ts`, `modules/pos/csv.test.ts`, `modules/reporting/summary.test.ts` | see M3.3 |
| M4.1 | `modules/payments/wallee-signature.test.ts` | valid, tampered, expired |

### 3.2 Integration
| Milestone | Test |
|---|---|
| M1.1 | `withTx` rolls back both writes when the second throws; `rateLimit` blocks the N+1th call in the window |
| M1.3 | an inactive staff user cannot log in; a `sales` user cannot update `BusinessSettings` |
| M2.1 | 20 parallel sales of 1 against `onHand = 5` → exactly 5 succeed, `onHand = 0`, 5 movements; `rebuild-stock` matches the cache; an adjustment records user and reason; a count posts variance = counted − expected |
| M2.2 | customer A's `find orders` / `find customers` return only A (REST and local API with `overrideAccess: false`) |
| M2.3 | the same `idempotencyKey` twice → one order, one movement set, one e-mail; cancelling a confirmed order returns stock exactly once; the last event seat cannot be taken twice in parallel |
| M3.1 | receiving a PO of 2 × box12 → +24 and status `received`; a partial receipt → `partly_received` |
| M3.2 | 20 parallel `issueInvoice` → numbers 1..20, no gaps, no duplicates; a failed issue does not consume a number; a gift card of 50 € used 30 + 20 → balance 0, a third use fails; a code with `maxUses = 1` used in parallel → one success |
| M3.3 | importing the same POS CSV twice → second rejected; a matched row posts a `pos_import` movement; only one open attendance record per user |
| M4.1 | a replayed `paid` webhook → one payment row, order confirmed once; a rejected reservation voids the authorisation and posts no stock |
| M4.2 | outbox: a connector throwing 5 times → `dead` + alert e-mail; with POS off, `placeOrder` still succeeds |

### 3.3 E2E (only these journeys)
1. `locale.spec.ts` (M1.3): `/` → `/fr`; switch to DE on `/de/contact` keeps the path; no FR string visible on the DE page (sampled keys).
2. `checkout.spec.ts` (M2.3): add a snack and a wine → pickup → slot → order confirmation page and Mailpit e-mail in the chosen language; repeat for delivery (zone fee shown) and table + pre-order (pending).
3. `staff-mobile.spec.ts` (M3.1, Pixel 7 viewport): staff login → receive PO by typed barcode → quick sale to a customer → stock reflects both.
4. `b2b.spec.ts` (M3.2): B2B customer sees list prices → staff creates a quotation → accept → order → invoice PDF downloads with the next number.
5. `attendance.spec.ts` (M3.3): open today's QR URL → check in → check out → the hours appear in the manager's monthly report.

## 4. Commands

| Script | Runs |
|---|---|
| `npm run check` | `eslint` + `tsc --noEmit` + `vitest run --project unit` |
| `npm run test:int` | `vitest run --project int` |
| `npm run test:e2e` | `playwright test` (starts the built app) |
| `npm run gate` | `check` + `test:int` + `next build` + `test:e2e` |

## 5. Release gate (before each payment request)

1. `npm run gate` passes locally and in CI.
2. The traceability check in `01-CONTEXT.md` §8 prints nothing for the payment's requirement IDs.
3. `scripts/rebuild-stock.ts --check` reports 0 differences on staging (from P2 onward).
4. Every acceptance criterion of the three sub-milestones is marked pass in `PROGRESS.md`, with how it was verified.
5. The staging URL is updated and the human validation checklists are sent to APPLUX as one list.

## 6. CI (`.github/workflows/ci.yml`)

On every push: `npm ci` → `npm run check` → `npm run test:int` → `npm run build` (no env vars, which proves the lazy env). E2E runs on pull requests to `main` against a Mongo service container started with `--replSet`.
