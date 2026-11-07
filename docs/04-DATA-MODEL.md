# 04 · Data model

These are all Payload collections and globals on MongoDB. Rules that apply to every collection:

- Payload adds `id`, `createdAt` and `updatedAt`. Do not redeclare them.
- `L` marks a **localized** field (`localized: true`). Locales are `fr` (default), `en`, `de` and `pt`, with fallback to `fr`.
- Money fields are integers in cents and their names end in `Cents`. VAT rates are basis points.
- Access is written with the helpers in `lib/access.ts`. "Staff(x)" means the staff roles allowed. Admin is always allowed.
- Every list query used by the UI must be covered by an index listed here. Indexes are declared with `index: true` or `unique: true` on fields, or with collection-level `indexes`.
- Each section names the sub-milestone that creates the collection. A collection is created only when its milestone says so.

## 1. Settings, CMS, staff (M1.3)

### `users` (auth: staff)
| Field | Type | Notes |
|---|---|---|
| `name` | text, required | |
| `email` | (auth) | unique |
| `roles` | select many: `admin`, `manager`, `sales`, `stock`, `attendance` | required, at least 1; saved to JWT |
| `active` | checkbox, default true | an inactive user cannot log in (`beforeLogin` hook) |
| `locale` | select fr/en/de/pt | for staff e-mails |

Access: read is Staff(any) for itself and admin/manager for everyone; create, update and delete are admin only. Field `roles` can only be updated by an admin, and an admin cannot remove their own `admin` role.

### `media` (upload)
`alt` L (required, used for ALT text, V-SEO), `caption` L. Image sizes: `thumb` 400, `card` 800, `hero` 1920, all WebP. Storage is a private S3 bucket (02 §7); files are served through Payload, local `./media` when S3 is not configured. Access: public read; create and update by Staff(admin, manager).

### `pages`
`title` L, `slug` (unique, index), `layout` (blocks, see 05 §4: `hero`, `richText`, `mediaText`, `cardGrid`, `cta`, `faq`), `seo` group (`title` L, `description` L, `image`), `status` (draft/published, Payload drafts on). Access: published docs are public; Staff(admin, manager) otherwise.

### `legal`
`title` L, `slug` (unique), `body` L (rich text). Seeded with `mentions-legales`, `cgv`, `confidentialite` and `cookies`.

### `auditLogs`
`user` (rel users), `action` (text, index), `targetCollection` (named so because `collection` is a reserved mongoose path), `docId` (index), `before` (json), `after` (json). Access: create through the server only (`() => false` for the API, with writes using `overrideAccess`); read by admin and manager; no update or delete.

### `BusinessSettings` (global)
| Group | Fields |
|---|---|
| `business` | `name`, `legalName`, `street`, `postalCode`, `city`, `country`, `phone`, `email`, `vatNumber`, `rcs`, `iban`, `bic`, `mapsUrl`, `instagram`, `facebook`, `latitude`, `longitude` (optional, for the `LocalBusiness` geo in JSON-LD, M2.2) |
| `hours` | array `{ day 0–6, open "HH:mm", close "HH:mm" }` + `closedDates` array of dates |
| `vat` | array `{ key: 'standard' \| 'intermediate' \| 'reduced' \| 'superReduced', rateBp }`; default LU 1700/1400/800/300, confirmed by the accountant (DEP-07) |
| `numbering` | `{ invoice, creditNote, quotation, deliveryNote, order, cateringRequest }` format strings, e.g. `INV-{YYYY}-{00000}`, `REQ-{YYYY}-{0000}` |
| `alerts` | `defaultLowStock` (int), `lowStockEmail` (email), `outboxAlertEmail` |
| `modules` | checkbox per switchable module (02 §4) |
| `paymentTerms` | array `{ key, days, label L }` |
| `loyalty` | `pointsPerEuro`, `pointValueCents`, `expiryMonths`, `eligibleChannels` (M3.2) |
| `reviews` | `placeId`, `reviewUrl` (M3.3) |
| `pos` | `adapter` (`none` \| `csv` \| `cashmag`), `csvMapping` (column names), `vatMapping`, `modeMapping` (M3.3, M4.2) |
| `payments` | `cardEnabled` (M4.1) |

Access: read is public **only through `getSettings()`, which strips the bank and internal fields**; update by Staff(admin, manager).

### `Header`, `Footer`, `HappyHour` (globals)
`Header`: nav items (`label` L, `href` optional: empty = plain text until the page exists). `Footer`: `tagline` L, columns (title L, links); published `legal` pages are linked automatically (no newsletter field: there is no newsletter UI). `HappyHour`: `active`, `days`, `from`, `to`, `titleA` L, `titleB` L, `text` L (supports `<gold>…</gold>`), `image`. These drive the prototype's `Nav`, `Footer` and `HappyHour` sections.

### `counters`
`series` (text), `year` (int), `last` (int). Unique index `{ series, year }`. Hidden in the admin. Written only by `nextNumber`.

## 2. Catalogue and inventory (M2.1)

### `categories`
`name` L, `slug` (unique), `parent` (rel categories, optional), `kind` (`shop` \| `snack`), `order` (int), `image`. Index: `{ kind, order }`.

### `brands`
`name`, `slug` (unique), `origin` L (region text, e.g. "Douro").

### `products`
| Field | Type | Notes |
|---|---|---|
| `name` L, `slug` (unique) | text | |
| `kind` | `wine` \| `grocery` \| `snack` \| `gift` \| `other` | |
| `category` | rel categories, required, index | |
| `brand` | rel brands, index | |
| `description` L | richText | |
| `images` | array of rel media | first image is the card image |
| `badges` | select many: `signature`, `rare`, `dop`, `bestseller`, `homemade`, `new` | the prototype's tags |
| `wine` | group, shown when `kind = wine`: `region` L, `grape` L, `vintage` int, `colour` (`red`, `white`, `rose`, `sparkling`, `fortified`), `abv` (bp), `servingTemp` | |
| `snack` | group, shown when `kind = snack`: `ingredients` L, `allergens` (select many, 14 EU allergens) | |
| `vatClass` | select of `BusinessSettings.vat` keys | required |
| `status` | `draft` \| `active` \| `archived`, index | only `active` is sellable |
| `loyaltyExcluded` | checkbox | lines of this product earn no points (M3.2) |
| `giftCard` | checkbox | the variants are gift-card amounts; selling one issues a card (M3.2) |
| `seo` | group as pages | |

Text index: `{ 'name.fr': 'text', 'name.en': 'text', 'name.de': 'text', 'name.pt': 'text', 'wine.region.fr': 'text' }`. **Verified (M2.1 T1):** Payload stores a localized field as one object per field, `name: { fr, en, de, pt }`, so the paths are `name.fr` and `wine.region.fr` (asserted in `inventory.int.test.ts`). Payload's `indexes` cannot declare a text index, so it is declared in the collection's `custom.indexes` and created in `payload.config.ts` (`afterOpenConnection`), like the TTL indexes.

On the "Add" form only, a virtual group `firstVariant` { `priceCents` (required), `barcode`, `sku` } gives the default variant its price and barcode; it is not stored on the product. Delete: admin only, refused when any of its variants has a stock movement (archive instead); deleting a product deletes its variants, their packaging units and stock rows.

### `variants`
`product` (rel, required, index), `label` L (e.g. "75 cl · 2019"), `title` (hidden, French product name + label, for lists and pickers), `sku` (unique; generated from the product slug when empty), `barcode` (unique when set: a partial unique index on `{ barcode }` where it is a string, declared in `custom.indexes`, because a sparse index would still collide on `null`; the EAN of the **base unit**), `priceCents` (VAT-inclusive public price per base unit), `costCents` (latest purchase cost, optional), `channels` (select many: `webshop`, `mobile`, `pos`; default all), `trackStock` (checkbox; default true, false for `kind: snack` and gift cards: made-to-order items and vouchers never touch the ledger), `active`. A product with no options still has exactly one variant (created by an `afterChange` hook), so every sale line points at a variant.

### `packagingUnits` (R12)
`variant` (rel, required, index), `label` L ("Box of 6"), `factor` (int ≥ 2), `barcode` (unique when set, partial index as on variants; a barcode is also unique **across variants and packaging units together**, checked by the field validation), `priceCents` (VAT-incl., optional; defaults to `factor × variant.priceCents`), `channels`, `active`. Unique `{ variant, factor }`. The base unit itself is not a packaging row; it is the variant with factor 1.

### `stockLevels`
`variant` (rel, unique), `onHand` (int), `lowStockThreshold` (int, null = use the settings default), `lowStock` (checkbox, computed by `postMovements`, index). Access: read by Staff(any); **write: none**. Only `postMovements` writes `onHand`; `lowStockThreshold` is set through `inventory.setLowStockThreshold` (the variant's Stock tab, the catalogue import), never through a Payload form, because Payload writes the whole document and would overwrite a concurrent `$inc` of `onHand`. Both recompute `lowStock` in the same aggregation-pipeline update. A tracked variant gets its row at 0 when it is created. The public site reads availability through `catalogue`/`inventory` service functions, which return only `inStock: boolean` and `maxQty`, never raw `onHand`.

### `stockMovements` (append-only)
`variant` (rel, index), `qty` (signed int, base units), `unit` (rel packagingUnits, optional: what was physically moved), `unitQty` (int, optional), `type` (`sale`, `return`, `cancel`, `adjustment`, `count`, `receipt`, `pos_import`), `reason` (text; required for `adjustment`), `channel` (`webshop`, `mobile`, `pos`, `backoffice`), `ref` (`{ relationTo, value }` polymorphic: orders, purchaseOrders, stockCounts, posImports), `user` (rel users, optional for webshop). Indexes: `{ variant, createdAt: -1 }`, `{ 'ref.value': 1 }`. Access: read by Staff(admin, manager, stock); create, update and delete: **none** through the API.

### `stockCounts`
`status` (`open`, `posted`), `lines` array `{ variant, counted int, expected int (snapshot at post), }`, `note`, `user`, `postedAt`. Posting writes one `count` movement per line with `qty = counted − expected`, in one transaction. A posted count is read-only (update and delete access match `status = open` only). Access: read and create by Staff(manager, stock). The line's variant picker has no `filterOptions`: Payload validates each row's filter in parallel on the create's transaction session, which fails intermittently; untracked variants in a count are ignored by `postMovements`.

## 3. Customers (M2.2)

### `customers` (auth: shop accounts)
`name`, `email` (auth), `phone`, `locale`, `addresses` array `{ label, line1, line2, postalCode, city, country default LU, isDefault }`, `type` (`private` \| `business`), `company`, `vatNumber`, `group` (rel customerGroups), `priceList` (rel priceLists, M3.2), `paymentTerm` (key, M3.2), `loyaltyBalance` (int, cache, M3.2), `marketingConsent` (checkbox). Access: read and update by `staffOrSelf('id')`; create through the sign-up action (rate-limited, only the sign-up fields) or by Staff(sales): **the API's create is staff-only**, so nobody bypasses the rate limit or the business-account checks; delete by admin only. The fields `group`, `priceList`, `paymentTerm` and `loyaltyBalance` can only be updated by staff (field-level access; `loyaltyBalance` by no one through the API). A customer can never set their own price list. `priceList` is added in M3.2 with the `priceLists` collection it points to.

Session (M2.2): Payload's auth cookie name is shared by every auth collection, so the website keeps the customer's Payload token in its own httpOnly cookie `gg_customer` and verifies it with `payload.auth` (`Authorization: JWT …`). A staff session in the same browser is never replaced. Sign-out also ends the Payload session (`useSessions`), so a copied token stops working. Password reset uses Payload's `forgotPassword` with our e-mail template, in the customer's `locale`.

### `customerGroups`
`name`, `priceList` (rel, M3.2). Example: "Restaurants", "Companies".

## 4. Sales (M2.3)

### `orders`
| Field | Type | Notes |
|---|---|---|
| `number` | text, unique | `nextNumber('order')` |
| `idempotencyKey` | text, unique | sent by the client (UUID), stored by the server |
| `channel` | `webshop` \| `mobile` \| `pos`, index | R2 |
| `mode` | `pickup` \| `delivery` \| `table` \| `b2b` \| `instore` | |
| `status` | see 03 §4.6, index | |
| `customer` | rel customers, optional (guest), index | |
| `contact` | group `{ name, email, phone }` | for guests, and as a snapshot |
| `address` | group (delivery only) | snapshot |
| `slot` | `{ date, from, to }` | pickup, delivery, table |
| `lines` | array `{ variant, unit?, unitQty, baseQty, name (snapshot, in the customer's locale), unitPriceCents, discountCents, vatBp, totalCents }` | |
| `totals` | `{ subtotalCents, discountCents, deliveryCents, vatCents, totalCents, vatBreakdown: [{ rateBp, baseCents, vatCents }] }` | from `quote` |
| `pricing` | `{ promotions: [ids], code, loyaltyPointsUsed, giftCards: [{ code, amountCents }] }` | snapshot (M3.2) |
| `payment` | `{ provider: 'manual' \| 'wallee', method: 'onsite' \| 'transfer' \| 'invoice' \| 'card', status: 'none' \| 'pending' \| 'partial' \| 'authorized' \| 'paid' \| 'refund_pending' \| 'partially_refunded' \| 'refunded' \| 'voided', ref, paidCents, refundedCents, refundDueCents, refundReason }` | GG-003/004: `paidCents`/`refundedCents` = sums of the order's `payments` rows; `status` from `modules/payments/balance.ts`. Nothing is paid until a row records it; "refunded" (order) only after the refund is recorded sent in full |
| `locale` | fr/en/de/pt | used for e-mails and PDFs |
| `staff` | rel users | mobile and POS |
| `stockPosted` | checkbox | set in the same transaction as the sale movements; guards against posting twice |
| `notes` | text | |

Indexes: `{ status, createdAt: -1 }`, `{ customer, createdAt: -1 }`, `{ channel, createdAt: -1 }`, `{ 'slot.date': 1, mode: 1 }`. Access: read via `staffOrSelf('customer')`; create through actions only; update by Staff(admin, manager, sales) **through `transition()` only** (the `status` field is read-only in the admin, and status changes are custom admin buttons calling actions); delete by none.

### `reservations` (table bookings, with optional pre-order)
`number`, `idempotencyKey` (unique), `customer?`, `contact`, `date`, `time`, `guests`, `status` (`pending`, `accepted`, `rejected`, `cancelled`, `completed`), `preorder` (rel orders, optional), `notes`, `locale`. Index `{ date, status }`. A pre-order is an `orders` doc with `mode: 'table'` and status `pending`, linked here. Accepting the reservation confirms the order.

### `slotRules` (global-like collection, one doc per mode)
`mode` (unique: `pickup`, `delivery`, `table`), `intervalMin`, `capacityPerSlot` (orders, or guests for `table`), `leadTimeMin`, `days` (overrides `BusinessSettings.hours`, optional), `maxDaysAhead`.

### `deliveryZones`
`name`, `postalCodes` (text array, index), `feeCents`, `minOrderCents`, `freeFromCents` (optional), `active`.

### `events` (module `events`)
`title` L, `slug`, `startsAt`, `endsAt`, `image`, `description` L, `priceCents` (0 = free), `capacity`, `booked` (int cache, written only by the booking service), `status` (draft/published), `seo`.

### `eventBookings`
`event` (rel, index), `idempotencyKey` (unique), `customer?`, `contact`, `guests`, `status` (`pending`, `confirmed`, `cancelled`), `notes`, `locale`. Capacity check: `Σ guests of non-cancelled bookings + new ≤ capacity`, done inside a transaction that also `$inc`s `events.booked` with the condition `booked + guests ≤ capacity`. The same conditional-update pattern as stock is used, so two people cannot take the last seat.

**As built (M2.3):** `orders` and `reservations` also store `slotAt` (`YYYY-MM-DDTHH:mm`, indexed: the admin's "today and upcoming" filter and sort) and `history` (`at`, `from`, `to`, `user`, `reason`); an order line keeps `detail` (size or box label) beside its name. A reservation's date and time are the group `slot { date, from, to }`, like an order's. `slotRules` has a hidden `lockVersion` bumped inside every booking transaction (two bookings of one mode conflict, the later one recounts). `eventBookings` stores `amountCents` (price × guests). `payments` also stores `method` and `user`. All five are written only by their services (`create`, `update`, `delete`: none through the API); reads use `staffOrSelf('customer')`, `payments` is read by sales staff.

### `cateringPackages` and `cateringRequests`
Packages: `name` L, `tagline` L, `includes` L (array), `pricePerGuestCents`, `minGuests`, `image`, `order`. These are the prototype's `convivio`, `mesa` and `prestige`. Requests: `number` (unique, `REQ-{YYYY}-{0000}` via `nextNumber`), `package` (rel), `guests`, `date`, `time`, `location`, `contact` {`name`, `email`, `phone`}, `notes`, `estimateCents` (server-computed), `status` (`new`, `quoted`, `accepted`, `declined`, index), `locale`. API create is closed: only the `requestCatering` service writes requests.

### `payments` (module `payments`)
`order` (rel, index), `provider`, `kind` (`charge`, `refund`, `authorization`, `capture`, `void`), `amountCents` (refunds negative), `method`, `status`, `at` (the bank's actual date, GG-003), `reference` (bank reference), `reason` (refunds), `user`, `providerRef` (unique, sparse), `raw` (json, the webhook payload, M4.1). Append-only.

## 5. Back-office modules (M3.x)

### `suppliers`, `supplierProducts` (M3.1)
Suppliers: `name`, `contact`, `email`, `phone`, `vatNumber`, `paymentTerm`, `notes`. Supplier products: `supplier`, `variant`, `unit` (rel packagingUnits, optional: what the supplier sells), `supplierRef`, `costCents` (per supplier unit), `leadDays`. Unique `{ supplier, variant, unit }`.

### `purchaseOrders` (M3.1)
`number` (`nextNumber('purchase')`), `supplier`, `status` (`draft`, `ordered`, `partly_received`, `received`, `cancelled`), `lines` array `{ variant, unit?, unitQty, costCents, receivedUnitQty }`, `expectedAt`, `notes`. `receive(poId, lines)` posts `receipt` movements (converted to base units), increments `receivedUnitQty`, updates the status, and updates `variants.costCents`, all in one transaction. Over-receipt is allowed with a reason.

### `priceLists` (M3.2)
`name`, `currency` EUR, `pricesInclVat` (false for B2B), `lines` array `{ variant, unit?, priceCents }`, `validFrom`, `validTo`. Per-customer prices = a price list assigned directly to one customer.

### `promotions`, `discountCodes` (M3.2)
Promotions: `name` L, `type` (`percent` bp \| `fixed` cents), `value`, `target` (`all` \| `products` \| `categories` \| `brands`), `targets` (polymorphic rel), `channels`, `startsAt`, `endsAt`, `active`, `priority`. Discount codes: `code` (unique, upper-case), `type`, `value`, `minOrderCents`, `maxUses`, `maxUsesPerCustomer`, `uses` (int, `$inc` in the order transaction with condition `uses < maxUses`), `startsAt`, `endsAt`, `channels`, `customers` (optional restriction).

### `loyaltyLedger` (M3.2, append-only)
`customer` (index), `points` (signed), `type` (`earn`, `redeem`, `expire`, `adjust`), `order?`, `reason`, `user?`, `expiresAt` (for `earn`). `customers.loyaltyBalance` is the cache, updated in the same transaction. A redeem uses the conditional `$inc` (`balance ≥ points`).

### `giftCards`, `giftCardLedger` (M3.2)
Cards: `code` (unique, 16 chars from an alphabet with no ambiguous characters, generated server-side), `initialCents`, `balanceCents` (cache), `currency`, `expiresAt`, `status` (`active`, `void`), `purchaser?`, `recipientEmail?`, `order?` (when sold online). Ledger: `card`, `amountCents` (signed), `type` (`issue`, `redeem`, `refund`, `void`), `order?`, `user?`. A redeem is a conditional `$inc` on `balanceCents ≥ amount`.

### `quotations`, `invoices`, `deliveryNotes`, `creditNotes` (M3.2)
Common fields: `number` (unique, from `nextNumber`), `customer`, `billing` snapshot (company, VAT number, address), `lines` (same shape as order lines), `totals` (same shape), `locale`, `issuedAt`, `pdf` (rel `documentFiles`).

### `documentFiles` (upload, private, M3.2)
The PDF files. `customer` (rel, index), `kind`. Access: read by `staffOrSelf('customer')`, so Payload's file route enforces ownership. Create by the server only, and no update or delete. Not on public storage: a separate S3 prefix with no public URL; files are served through Payload's access-checked file route.

- Quotations: `status` (`draft`, `sent`, `accepted`, `expired`, `declined`), `validUntil`, `order` (set on accept).
- Invoices: `order`, `dueAt` (from the payment term), `status` (`issued`, `paid`, `credited`, `partly_credited`), `paidAt`, `payment` ref. **Immutable after issue**: update access only on `status`, `paidAt` and `payment`, and delete is none.
- Credit notes: `invoice`, `reason`, lines (≤ what remains creditable).
- Delivery notes: `order`, lines without prices, `deliveredAt`, `signature` (optional name).

## 6. Pricing engine order of operations (`pricing.quote`, M2.2 v1 → M3.2 full)

For each line:
1. **Base unit price.** Take the customer's price list price (variant + unit), if one exists and is valid at `now`. Otherwise take the group's price list price, otherwise the packaging unit `priceCents`, otherwise `factor × variant.priceCents`. If the price list is net, convert it to gross with the line's VAT rate at this point, so that everything after works in gross cents. Round half-up.
2. **Best automatic promotion.** Apply the single best promotion matching the line by product, category or brand, the channel and the date. Promotions do **not** stack, and the best one is the one giving the lowest line total. They do not apply to lines priced from a customer price list (B2B prices are already negotiated); this rule is listed in PROGRESS as assumption A-03 for APPLUX to confirm.

Then for the cart:

3. **Discount code.** Validate the dates, channel, minimum (against the step 2 subtotal), uses and customer restriction. A percentage code applies to the step 2 subtotal; a fixed code is capped at the subtotal. Spread the discount over the lines in proportion to their totals, putting the rounding remainder on the largest line, so that VAT per rate stays correct.
4. **Delivery fee** from the zone. It is free if the subtotal after step 3 ≥ `freeFromCents`. The fee uses the standard VAT rate.
5. **VAT breakdown.** Group by rate. `vat = round(gross × rate / (10000 + rate))` per rate group, not per line, so the breakdown matches the invoice.
6. **Loyalty points** (as a means of payment, after VAT): `min(points × pointValue, total)`.
7. **Gift cards** (as a means of payment): applied in the given order, each capped at the remaining amount.
8. `amountDueCents = total − loyalty − giftCards`, never below 0.

The vectors in M3.2 T4 pin every step. Steps 6–7 do not change VAT (Q§09: gift cards are a means of payment, pending the accountant's confirmation, DEP-07).

## 7. Back-office modules (M3.3, M4)

### `attendance`, `attendanceCorrections` (M3.3)
Attendance: `user` (index), `day` (date, Europe/Luxembourg), `checkIn`, `checkOut` (optional), `source` (`qr`, `manager`). Unique partial index: only one open record (`checkOut` null) per user. Corrections: `attendance`, `field`, `before`, `after`, `reason` (required), `by` (user). A correction updates the attendance row and writes the correction row in one transaction.

### `ReviewsCache` (global, M3.3)
`rating`, `total`, `reviews` array `{ author, rating, text, time, url, language }`, `fetchedAt`, `attributionHtml`.

### `posImports`, `outbox`, `integrationLogs` (M3.3, M4.2)
- POS imports: `file` (media, private), `hash` (unique), `status` (`preview`, `posted`, `failed`), `rows`, `matched`, `unmatched` (json), `user`.
- Outbox: `topic` (`order.created`, `order.cancelled`, …), `payload` (json), `target` (`cashmag`), `status` (`pending`, `sending`, `sent`, `failed`, `dead`), `attempts`, `nextAttemptAt` (index with `status`), `lastError`.
- Integration logs: `target`, `direction`, `outbox?`, `request`, `response`, `ok`, `ms`. TTL index of 90 days.

### `rateLimits` (M1.1)
`key` (unique), `count`, `expiresAt` (TTL index). Hidden in the admin.
