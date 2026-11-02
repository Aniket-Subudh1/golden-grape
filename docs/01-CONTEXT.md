# 01 · Project context

## 1. What is being built

One multilingual (FR default, EN, DE, PT) Next.js application for **Golden Grape Luxembourg** (25 Zac Klengbousbierg, 7795 Bissen), a Portuguese wine shop, gourmet grocery, snack counter, caterer and event venue. It contains:

- the **public website and webshop**, ported faithfully from the approved Lovable prototype
- a **CMS** for pages, events, catering, Happy Hour and legal texts
- an **autonomous back office**: inventory, purchasing, B2B, documents, promotions, loyalty, gift cards, reviews, staff attendance and reporting
- **mobile staff screens** that run in a phone browser
- **replaceable connectors** for payments (wallee) and POS (CashMag)

| Party | Role |
|---|---|
| APPLUX (Khaled) | Client, project management, acceptance, production deployment, code review |
| Golden Grape Luxembourg (Ivo) | End client and business owner |
| Aniket | Developer |

## 2. Contractual sources

| Source | Status |
|---|---|
| Quotation GG-V1-2026-01 **Rev. 2.1** (22 Oct 2026, 11 pages) | Base scope. Sections are cited as `Q§n`. |
| **Rev. 2.2 addendum** (Upwork contract text, accepted 2 Nov 2026) | Splits delivery into Phase 1 (standalone) and Phase 2 (deferred integrations), and sets 4 payments |
| Spec V1.0 (24-09-2026) and Rev. 1.1 | Superseded by Rev. 2.1. Their content is referenced only through Rev. 2.1. |

Neither PDF is committed. This file's requirement register (§5) carries their content. If the client revises scope, update §5 first, then the affected milestones. **No scope change and no extra charge without written APPLUX approval** (`Q§14` Change control).

## 3. Payments and phases (Rev. 2.2)

Fixed total: **USD 1,100**. A payment is released after APPLUX accepts the matching deliverables on staging.

| Payment | Amount | Content | Sub-milestones | Due |
|---|---|---|---|---|
| P1 | $300 | Project kickoff, foundation, multilingual website, CMS, modular architecture | M1.1 · M1.2 · M1.3 | **Thu 5 Nov 2026** |
| P2 | $250 | Public website, webshop, orders and reservations accepted | M2.1 · M2.2 · M2.3 | Tue 10 Nov 2026 |
| P3 | $250 | Back office, inventory and remaining standalone business modules accepted | M3.1 · M3.2 · M3.3 | Sun 15 Nov 2026 (Phase 1 target) |
| P4 | $300 | Deferred integrations, final testing, documentation, complete handover | M4.1 · M4.2 · M4.3 | Schedule agreed after APPLUX's written authorisation |

**Phase 1** (P1–P3): no live CashMag, wallee or other external payment or POS API connection is required. The platform must be fully usable on its own: orders are paid on site, by bank transfer or marked as invoiced, through the `manual` payment adapter.

**Phase 2** (P4): CashMag and wallee integrations as already described in Rev. 2.1, built only after APPLUX's written authorisation.

## 4. Out of scope (Q§13 and the milestone "Not included" columns)

Loyalty tiers, referrals, birthday rewards and physical loyalty cards · physical gift cards and CashMag-side redemption without an API · payroll, shift planning, leave · multi-location stock and transfers · lots, expiry dates, weight or volume units, automatic reorder proposals · live two-way CashMag sync and catalogue sync from the POS · Peppol/UBL e-invoicing, dunning, statements, credit limits, accounting-software integration · offline mode, native apps · margin and custom reporting · route planning, driver dispatch, live tracking · review request e-mail campaigns · supplier portals · geolocation in attendance.

If a request falls into this list, record it in `PROGRESS.md` as a change request. Do not build it.

## 5. Requirement register

IDs `V-*` come from the V1 spec rows in `Q§04`. IDs `R1`–`R12` are the APPLUX requirements in `Q§02`. Every ID must map to at least one acceptance criterion. The traceability check is in §8.

| ID | Requirement (included) | Sub-milestone |
|---|---|---|
| V-DES | Prototype design ported faithfully; readable header contrast; logo; complete footer; no placeholders at acceptance | M1.2, M1.3 |
| V-I18N | FR/EN/DE/PT across pages, forms, cart, checkout, e-mails, customer PDFs | M1.2 (shell), every UI milestone |
| V-SHOP | Categories, products, variants, brands, VAT, wine attributes, badges, search, filters; quick-add Snack menu | M2.1, M2.2 |
| V-CART | Side cart, VAT-inclusive totals, Takeaway, Delivery, Table Reservation + Pre-order on one slot engine; delivery zones | M2.2, M2.3 |
| V-PAY | wallee Payment Page, webhooks, refunds, deferred capture; payment links for mobile and B2B | M4.1 (Phase 1 uses `manual`, M2.3) |
| V-CONT | Catering packages and requests, events and bookings, Happy Hour, The House, Contact, legal pages, cookie consent | M1.3, M2.3 |
| V-ACC | Customer accounts: profile, addresses, history, guest checkout; business accounts with company and VAT number | M2.2 |
| V-ADMIN | Admin for all modules, extended roles (Admin, Manager, Sales, Stock, Attendance), business settings, module switches | M1.3, then every module |
| V-NOTIF | All customer and staff e-mails, plus low-stock, quotation and invoice e-mails | M1.3 (contact), M2.3, M3.1, M3.2 |
| V-SEO | Meta, OG, canonical, hreflang, Schema.org, sitemap, robots, optimised images | M1.2, M2.2 |
| V-SEC | Rate limiting, anti-spam, backups and restore test, security review | M1.1 (base), M4.3 |
| R1 | Inventory: stock ledger per product/variant, movements with reason and user, adjustments, counts, low-stock thresholds with dashboard and e-mail alerts, EAN/barcode, phone camera scanning | M2.1, M3.1 |
| R2 | Unified sales channels: one order model (`webshop`, `mobile`, `pos`); every confirmed sale writes stock movements in the same DB transaction | M2.1, M2.3 |
| R3 | POS: connector interface, CashMag first adapter, order outbox, logs, retry; daily POS CSV import as fallback; works with no POS | M3.3, M4.2 |
| R4 | Mobile back office: scan, stock, receive goods, quick sale, orders, customers | M3.1 |
| R5 | B2B: business accounts, price lists, per-customer prices, quotations → orders, PDF invoices and delivery notes with sequential numbering, payment terms, credit notes | M3.2 |
| R6 | Purchasing: suppliers, supplier prices and references, purchase records (draft, ordered, partly received, received), receive with scanner, reorder list | M3.1 |
| R7 | Promotions (percentage or fixed; product, category or brand; dates), discount codes (limits, minimum, per customer), loyalty points, gift cards | M3.2 |
| R8 | Dashboard: sales by date, product, brand, category, customer, channel; revenue, VAT, order count, average basket; charts; CSV export | M3.3 |
| R9 | Modular architecture with central business settings and module switches | M1.1, M1.3 |
| R10 | Google Reviews: review QR and short link, rating and latest reviews on the site, back-office overview, replies where Google grants API access | M3.3 |
| R11 | Employee QR attendance: check-in/out on own phone, history, manager corrections with audit, monthly report, CSV | M3.3 |
| R12 | Packaging units (bottle, box of 6, box of 12, any size) with own barcode, price and channel availability; stock in base units, converted on sale and receipt; purchases and B2B prices per box | M2.1, M3.1, M3.2 |

## 6. Client dependencies

If a dependency arrives late, the dependent date moves by the same number of days and the price does not change (`Q§05`).

| ID | Dependency | Owner | Needed by | Blocks |
|---|---|---|---|---|
| DEP-01 | **Original brand photos.** The prototype only holds Lovable CDN pointers (`src/assets/brand/**/*.asset.json`), not the files. Export them from Lovable or get them from Ivo. | APPLUX / Ivo | 3 Nov | M1.2 T6 |
| DEP-02 | MongoDB Atlas project (or hosting decision) and S3-compatible bucket for staging | APPLUX | 3 Nov | M1.1 staging deploy |
| DEP-03 | SMTP test account | APPLUX | 4 Nov | M1.3 T6 |
| DEP-04 | Catalogue spreadsheet: products, packaging, barcodes, brands, suppliers, purchase prices, opening stock (≤150 rows) | Golden Grape | 6 Nov | M2.1 T6 |
| DEP-05 | Legal texts, product and editorial translations | Golden Grape | 6 Nov | M1.3 content, M2.2 content |
| DEP-06 | Delivery zones (postal codes, fee, minimum, free threshold), opening hours, slot interval and capacity | Golden Grape | 8 Nov | M2.3 |
| DEP-07 | Invoice legal mentions, VAT rates per category, numbering format, voucher VAT treatment (accountant) | Golden Grape | 11 Nov | M3.2 |
| DEP-08 | B2B customer list and price lists (≤30 customers) | Golden Grape | 12 Nov | M3.2 import |
| DEP-09 | Google Business Profile manager access, Google Cloud billing account and Places API key | Golden Grape | 12 Nov | M3.3 T1–T2 |
| DEP-10 | wallee test-space credentials **and written authorisation** to start Phase 2 | APPLUX | Phase 2 | M4.1 |
| DEP-11 | CashMag documentation and test credentials (or middleware decision) | APPLUX | Phase 2 | M4.2 |

## 7. Decisions

| ID | Decision | Date | Status |
|---|---|---|---|
| D-01 | **MongoDB** (via `@payloadcms/db-mongodb`) replaces Supabase PostgreSQL. Payload auth handles staff and customers, and S3-compatible storage holds media. Reason: the developer's choice of stack. Transactions need a replica set (Atlas or local single-node `rs0`). **APPLUX must confirm this in writing in the Rev. 2.2 addendum.** | 2 Nov 2026 | Awaiting APPLUX |
| D-02 | Next.js version: **keep 16.4.3**. Payload 3.92.1 peers are `next >=16.3.3 <17` and `react ^19.2.1`, so Next 16.4.3 / React 19.3.0 are in range. Payload also supports `cacheComponents` (its `withPayload` sets `PAYLOAD_CACHE_COMPONENTS_ENABLED`), so Cache Components stay on; the admin page opts out of instant-navigation validation and awaits `connection()`. Payload needs Node `^22.23.4 \|\| >=24.22.1`. | 2 Nov 2026 | Decided (M1.1 T1) |
| D-03 | Phase 1 payment is the `manual` provider (pay on site, bank transfer, invoice). wallee becomes a second adapter in M4.1 behind the same interface. | 2 Nov 2026 | Decided |
| D-04 | Prices and amounts are stored as integer **cents**, VAT-inclusive for B2C and VAT-exclusive for B2B price lists, and converted only in `modules/promotions/pricing.ts` | 2 Nov 2026 | Decided |
| D-05 | French is the default locale. Every public URL is prefixed: `/fr/...`, `/en/...`, `/de/...`, `/pt/...`. | 2 Nov 2026 | Decided |
| D-06 | wallee client: official SDK or plain `fetch` (decided in M4.1 T1) | — | Open |
| D-07 | A card payment confirmed after stock ran out → order confirmed + staff alert, not failed (M4.1 T2) | — | Proposed |

## 8. Traceability check

Before requesting a payment, every requirement ID mapped to that payment's sub-milestones must appear in at least one `AC-` line:

```sh
for id in V-DES V-I18N V-SHOP V-CART V-PAY V-CONT V-ACC V-ADMIN V-NOTIF V-SEO V-SEC R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12; do
  grep -l "AC-.*\[$id\]" docs/milestones/*.md >/dev/null || echo "MISSING $id"
done
```

Acceptance criteria name their requirement in brackets, for example `AC-M2.1-02 [R12]`.
