# 05 · UI system

The approved design is `golden-grape-luxembourg/` (Lovable, TanStack Start). **Its visual output is the specification. Its code is not.** Port the look exactly, and collapse the duplication listed in §3.2.

## 1. Tokens (copy verbatim)

Copy from `golden-grape-luxembourg/src/styles.css` into `app/globals.css`:

- the `@theme inline` block (fonts, colour mappings, radius 2/4/6 px)
- the `:root` palette in oklch: `--ink`, `--bone`, `--champagne`, `--gold`, `--gold-deep`, `--gold-soft`, `--muted`, `--muted-foreground`, `--border`, `--gradient-gold`, `--shadow-luxe`
- the base layer (border colour, smooth scroll, body font features `"ss01", "cv11"`, serif weight-400 headings)
- the utilities `eyebrow`, `hairline`, `text-gold-gradient`, `animate-slow-zoom`, `animate-fade-up`, and the keyframes `gg-slow-zoom`, `gg-fade-up`, `gg-shimmer`
- `@import "tw-animate-css"` (the prototype uses `animate-fade-in`)

Fonts: **Cormorant Garamond** (serif and display) and **Inter** (sans), loaded with `next/font/google` as CSS variables and mapped in `@theme`. The prototype names them in the CSS, but remove the Lovable `<link>` loader from `__root.tsx` and use `next/font` instead. Remove the create-next-app Geist fonts and its dark-mode block. The site has **no dark mode**.

Do not invent colours, sizes or shadows. The palette is: ink text on bone, gold-deep accents, champagne fills, border hairlines.

Brand motifs added for personality (Aniket's request): the azulejo tile (`bg-azulejo`, `public/brand/azulejo.svg`), always subtle, and the grape mark from the logo (`public/brand/mark.png`).

## 2. Recurring visual vocabulary (from the prototype)

| Pattern | Exact classes in the prototype | Where |
|---|---|---|
| Container | `mx-auto max-w-[1400px] px-6 md:px-10` (1200 for PageShell) | every page |
| Page header | eyebrow `eyebrow text-gold-deep mb-6`, h1 `font-serif text-5xl md:text-7xl leading-[0.95] tracking-tight max-w-4xl` with a second half in `<em className="italic text-gold-deep">`, subtitle `mt-6 max-w-xl text-ink/60 text-lg font-light` | shop, snack, events, catering |
| Pill button (solid) | `h-11 px-6 rounded-full bg-ink text-bone text-[11px] uppercase tracking-[0.3em] hover:bg-gold-deep transition` | snack, events, catering, cart |
| Pill button (outline) | `border border-ink text-ink … hover:bg-ink hover:text-bone` | snack |
| Pill button (gold outline) | `border border-gold-deep text-gold-deep … hover:bg-gold-deep hover:text-bone` | snack |
| Filter chip | `h-9 px-4 rounded-full text-[11px] uppercase tracking-[0.22em] border` + active `bg-ink text-bone border-ink` | shop |
| Underline field | label `eyebrow text-ink/60 mb-1.5 block`, input `w-full h-10 border-b border-border bg-transparent text-sm outline-none focus:border-gold-deep placeholder:text-ink/30` | events, catering, contact, cart |
| Media card | `group` article, image `aspect-[4/5]` (shop, events) or `aspect-[4/3]` (snack), `object-cover transition-transform duration-[1400ms] group-hover:scale-105`, tag `absolute top-3 left-3 eyebrow text-bone bg-ink/70 backdrop-blur px-2.5 py-1` | shop, snack, events |
| Hairline grid | `grid gap-px bg-border` with `bg-bone` children | snack, events |
| Qty stepper | rounded-full bordered row with −/+ circle buttons and a serif tabular number | snack, cart, events dialog |
| Section reveal | `<Reveal delay>`: opacity and translate-y-8 → 0 over 1200 ms with cubic-bezier(0.2,0.7,0.2,1) | home sections |

## 3. Shared component inventory

### 3.1 `components/ui/` (shadcn, port only these)

`button` (the base; our `Button` in §3.2 wraps or replaces it), `sheet` (cart, shop filters on phones; **built on the native `<dialog>`** in `components/ui/sheet.tsx`, since M2.2 adds no package: the browser traps focus, closes on Escape and draws the backdrop), `dialog` (event booking: the `Sheet` with `variant="center"`, M2.3), `sonner` (toasts), `input`, `textarea`, `select`, `label`, `checkbox`, `radio-group`, `calendar` + `popover` (not ported: the slot picker uses day chips, M2.3), `table` (staff lists), `tabs` (staff screens), `badge`, `skeleton`, `separator`. Add another primitive only when a milestone needs it. The prototype's other ~30 primitives are **not** ported.

### 3.2 Our components: each replaces repeated prototype markup

| Component | File | Replaces / ports | Props (keep them minimal) |
|---|---|---|---|
| `Button` | `components/ui/button.tsx` (cva) | 15+ pill class strings, plus the square translucent gold CTA of Hero, Store and Happy Hour | `variant`: `solid` \| `outline` \| `gold` \| `goldGlass` \| `ghost` \| `chip` \| `icon`; `size`: `sm` (h-9) \| `md` (h-11) \| `lg` (h-12); `active` (chip); `asChild` |
| `Field` | `components/ui/field.tsx` | `F` in events.tsx, `Field` in catering.tsx and contact.tsx, cart inputs | `label`, `name`, `error?`, `as?: 'input' \| 'textarea' \| 'select'`, plus native props. Shows `fieldErrors[name]` from `useActionState`. |
| `Container` | `components/site/container.tsx` | repeated `mx-auto max-w-[1400px] px-6 md:px-10` | `size?: 'md' \| 'lg'`, `as?` |
| `PageHero` | `components/site/page-hero.tsx` | page headers in shop/snack/events/catering + `PageShell` | `eyebrow`, `title: [string, string?]` (second half rendered italic gold-deep), `subtitle?`, `children?` (CTAs), `compact?` (listing pages: the shop, where the products are the priority) |
| `MediaCard` | `components/site/media-card.tsx` | ProductCard (shop), MenuCard (snack), event card | `image`, `alt`, `ratio: '4/5' \| '4/3' \| '16/9'`, `tag?`, `href?` (the whole card is a link, under its own `relative z-10` buttons: event cards, QA 12 Nov GG-13), `fit?: 'contain'` (the picture whole over a blurred copy of itself, `Poster`: event posters are never cropped, GG-12; also the event page), `children` (body), `action?` (corner button slot), `ribbon?` (the sold-out corner band, `Ribbon`, colour `burgundy`: the photo stays visible and the card has no add control) |
| `Prose`, `Markdown` | `components/site/blocks.tsx` | pages, legal texts; event descriptions | one typography: `Prose` renders Lexical rich text, `Markdown` the light Markdown typed in a plain text field (`## Titre`, `**gras**`, `*italique*`, `- liste`; react-markdown on the server, HTML stays text, no images; GG-14). `stripMarkdown` (`lib/rich-text.ts`) gives the words for previews and meta descriptions |
| `MediaGrid` | `components/site/media-grid.tsx` | grids in shop (gap-6/8) and hairline grids (snack/events) | `cols: 3 \| 4`, `hairline?: boolean` |
| `QtyStepper` | `components/site/qty-stepper.tsx` | snack MenuCard stepper, cart line stepper, events guests | `value`, `onChange`, `min?`, `max?`, `size?` |
| `PriceTag` | inline `formatMoney` call; **no component** | `fmtEUR` | use `formatMoney(cents, locale)` from `lib/money.ts` |
| `Reveal` | `components/site/reveal.tsx` (`'use client'`) | `Reveal.tsx` + `use-reveal.ts`, merged into one file | `delay?`, `as?`, `className?`. Respect `prefers-reduced-motion` (show immediately). |
| `Nav` | `components/site/nav.tsx` (`'use client'`) | `Nav.tsx` | transparent on home until `scrollY > 40`, otherwise solid dark (`ink`); **one logo everywhere: `logo-light.png`, the gold one** (Aniket's decision); links left and right of the logo from 768 px up, full-screen menu below; links from the `Header` global |
| `Footer` | `components/site/footer.tsx` (server) | `Footer.tsx` | tile band, "Bem-vindo." statement + reserve CTA, logo + tagline + socials, CMS columns, contact + directions, hours, legal + back to top; data from the `Footer` global and settings |
| `LanguageSwitcher` | `components/site/language-switcher.tsx` | `LanguageSwitcher.tsx` (inline FR · EN · DE · PT row, replaced by a dropdown) | dropdown: current language + menu of the four; swaps the `[locale]` segment and keeps the path; `tone: 'light' \| 'dark'`, `placement: 'below-end' \| 'above-start'` |
| `CartSheet`, `FloatingCart`, `CartProvider` | `components/site/cart-sheet.tsx`, `floating-cart.tsx`, `modules/webshop/cart.tsx` | `CartSheet.tsx`, `FloatingCart.tsx`, `lib/cart.tsx` | the cart stores `{ variant, unit?, qty }` + mode only (`gg_cart_v2`); names, prices, totals and VAT are displayed from the server `quote`, refreshed 300 ms after each change; lines above the stock are clamped with a notice. `useCart` gives each component an empty cart while it hydrates (the server never knows the saved cart), then the real one |
| `ProductCard`, `MenuCard`, `Filters`, `BuyBox`, `Gallery` | `modules/catalogue/components/*.tsx` | shop.tsx ProductCard, snack.tsx MenuCard, the shop filter bar | `ProductCard` = `MediaCard 4/5` + "+"/"✓"; `MenuCard` = `MediaCard 4/3` + add/stepper + allergens; `Filters` keeps every filter in the URL; `BuyBox` = bottle/box options + stepper capped at the stock |
| `JsonLd` | `components/site/json-ld.tsx` | — | one `<script type="application/ld+json">`, `<` escaped |
| `ActionForm` | `components/ui/action-form.tsx` | every mocked `submit()` with `setTimeout` | wraps `useActionState`, shows pending state, success toast, field errors |
| `Blocks` | `components/site/blocks.tsx` | renders `pages.layout` blocks | one switch over the block types in §4 |
| Home sections | `components/site/home/*.tsx` | `Hero`, `Universes`, `Craft`, `Story`, `Store`, `HappyHour`, `Events`, `SocialProof`, `Marquee`, `Hospitality` | ported 1:1, server components unless they animate; copy from CMS/dictionary |

Before adding a component, check this table. If an existing one is 80 % right, add a prop or variant to it.

### 3.3 Admin (Payload) theme

The admin follows the layout of the Ancora back office, with Golden Grape gold as the only accent and **one light theme** (`admin.theme: 'light'`, no switcher). The canvas is cool slate (`#eaeef5`); the sidebar sits one step darker (`#e1e7f0`); the header is a sticky, translucent 56 px bar with a thin gold hairline. Pages hold flat white cards (1 px border, 12 px corners); page titles carry a 3 px gold bar; tables have an 11 px uppercase head row and zebra rows; statuses are outline pills with a coloured dot; empty states are dashed cards. Gold marks only the active menu item, title bars, focus and selection. Everything goes through Payload's supported hooks, so nothing in Payload is forked:

| Piece | File | Payload option |
|---|---|---|
| Colours, frame, cards, lists, form cards, tabs, login layout | `app/(payload)/custom.css` (fonts loaded in `app/(payload)/layout.tsx`) | its CSS variables and BEM classes |
| Sidebar: brand block, uppercase section labels, links on an indented rail, the active link filled gold-deep with a white marker, account links; stays open on every desktop width | `components/admin/nav.tsx` (groups, filtered by the user's visible entities) + `nav-client.tsx` | `components.Nav` |
| Home (by role): greeting, quick actions; **waiting tiles** (sales staff: count, € total or guests, how long the oldest has waited, tinted when something waits) plus today's guests; **key figures** (managers: sales today vs yesterday, month so far vs the same days of last month, orders today, average basket, each with its % change); then needs attention, upcoming events, recent requests. One tile anatomy (Ancora's metric tile: uppercase label, figure, context line, icon box, left accent bar), 4 per row on desktop, 2 on tablets, 1 on phones; each tile opens the list its figure comes from. No navigation cards | `components/admin/dashboard.tsx`, figures from `modules/reporting` and `components/admin/alerts.ts` | `views.dashboard.Component` |
| "Add …" (list pages, empty lists, the home's quick actions) opens the full create page | `components/admin/create-button.tsx`, wired with `addButton()` in `lib/admin.ts` | `views.list.actions` |
| A click anywhere on a list row opens the document's page (controls and checkboxes keep their own click; Cmd/Ctrl-click opens a new tab). Join-table titles link to pages (`pageLinkCell`) | `components/admin/row-links.tsx` | `providers` |
| An eye button on every password field shows or hides what was typed | `components/admin/password-toggle.tsx` | `providers` |
| On an account or team member, Save sits in the same row as Cancel | `components/admin/save-button.tsx` | `users` `admin.components.edit.SaveButton` |
| Repeating rows titled by their content ("Boutique", "La Maison") | `components/admin/row-label.tsx` | array `admin.components.RowLabel` |
| Login: lockup top-left, heading and form, photo panel with notes | `components/admin/logo.tsx`, `login-brand.tsx` | `graphics.Logo`, `beforeLogin` |
| Header icon | `components/admin/icon.tsx` | `graphics.Icon` |
| Status as an outline pill with a coloured dot, signed quantities (+12 green, −3 red) in list columns | `components/admin/cells.tsx`, wired with `badgeCell()` / `signedCell` in `lib/admin.ts` | field `admin.components.Cell` |
| First-use state of a list: icon, what the list is for, the "Add …" dialog button. Shown only when nothing exists yet; a search or filter that matches nothing keeps Payload's message, restyled as a card | `components/admin/empty-list.tsx`, wired with `emptyList()` | `beforeListTable` |
| Product list: photo, category, price and stock at a glance (server cells, so every row renders at once) | `modules/catalogue/admin/product-cells.tsx` | field `admin.components.Cell`, `ui` field `offer` |
| Stock list cells (quantity with low/out badge, "Default" alert level, reason in words); stock-count lines titled by product | `modules/inventory/admin/cells.tsx`, `count-row-label.tsx` | `Cell`, array `RowLabel` |
| Payload's generic wording replaced: "Ajouter : Produit" instead of "Créer un(e) nouveau ou nouvelle", "—" instead of "<Pas de …>", plain "no results" text; dates `dd/MM/yyyy HH:mm` | `payload.config.ts` (`i18n.translations`, `admin.dateFormat`) | config |

Every add and edit screen (all collections, as Aniket asked) is a full page with the settings layout below: a sticky title row with Save on the right over a centred 960 px column. The columns picker is a card of chips: shown columns gold, others outlined; technical fields (ID, slug, SEO, create-only fields, hidden flags) are not offered (`disableListColumn`). Forms sit in a white card at a readable width; long globals (Business settings) are split into tabs and two-column rows. Payload's own dialogs (adding a size from a product, "+" beside a relationship) are restyled as centred, focus-trapped cards: 640 px for compact forms, 760 px normally and 960 px for block pages. It keeps visible margins on phones and short windows instead of becoming a full page. The title and save row stay in view; the fields scroll inside the card. Save and status wrap instead of overflowing. The page behind stays visible through blur only, without a dark overlay. Globals cannot use it (Payload supports collection documents only), so they stay pages, laid out as settings screens. From 1025 px there is one sticky header row (title and description on the left, Save on the right) over a centred 960 px column; the Edit/API tabs are hidden. Menu links are one row each (label | path), with the path help given once on the list.

Payload sets the admin's root font size to 13 px, so `custom.css` uses px, not rem. The CSS relies on Payload's class names, which is safe while Payload stays pinned. Re-check the admin after any Payload upgrade.

## 4. CMS blocks (`pages.layout`)

`hero` (eyebrow, title A/B, subtitle, image, CTA) · `richText` · `mediaText` (image left or right, text, CTA) · `cardGrid` (cards: image, title, text, link) · `cta` (title, button) · `faq` (q/a list). The House (`maison.tsx`) and the legal pages are built from these. Do not add a block type for a single use; build that section as a component and allow it as a block only when the client must edit it.

## 5. Staff (mobile back office) UI

Route group `app/(staff)/staff/`, protected by staff auth in `proxy.ts` plus a server check in the layout.

- Same palette and fonts as the public site. Layout is functional, not editorial (Q§12): `bg-bone`, a 56 px top bar with the title and a back link, content max-w-md centred, and a **bottom tab bar** with a maximum of 5 tabs, filtered by role.
- Touch targets ≥ 44 px (`Button size="md"`), one primary action per screen, sticky bottom action bar.
- Every screen starts with the **scan input**, `ScanField` (`components/staff/scan-field.tsx`). It is a text input that a hardware scanner types into (Enter submits), plus a camera button that opens `@zxing/browser` in a sheet. The same component is reused by stock lookup, count, receive, quick sale and attendance.

| Route | Roles | Screen |
|---|---|---|
| `/staff` | all staff | home tiles: today's orders, low stock, open reservations, check-in status |
| `/staff/scan` | stock, sales, manager | scan → product card (stock, price, packaging) → actions |
| `/staff/stock/[variant]` | stock, manager | movements list + adjust (qty ±, reason) |
| `/staff/count` | stock, manager | open count → scan/enter counts → post |
| `/staff/receive` | stock, manager | pick PO → scan lines → confirm receipt |
| `/staff/sale` | sales, manager | pick customer → scan/search lines → quote → mark paid on site / invoiced (M4.1: wallee link + QR) |
| `/staff/orders` | sales, manager | today/upcoming orders and reservations, status buttons |
| `/staff/customers` | sales, manager | search, view history, create |
| `/staff/attendance` | everyone with `attendance` | check-in/out (opened from the venue QR) |

## 6. Public route map

| Route | Prototype source | Data | Built in |
|---|---|---|---|
| `/[locale]` | `routes/index.tsx` + home sections | dictionary + globals + events + reviews (M3.3) | M1.3 |
| `/[locale]/maison` | `routes/maison.tsx` | `pages` (slug `maison`) | M1.3 |
| `/[locale]/catering` | `routes/catering.tsx` | `cateringPackages` + request action | M1.3 |
| `/[locale]/events`, `/events/[slug]` | `routes/events.tsx` | `events` + booking action | M1.3 (list), M2.3 (booking) |
| `/[locale]/contact` | `routes/contact.tsx` | settings + contact action | M1.3 |
| `/[locale]/legal/[slug]` | footer links | `legal` | M1.3 |
| `/[locale]/shop`, `/shop/[slug]` | `routes/shop.tsx` | catalogue | M2.2 |
| `/[locale]/snack` | `routes/snack.tsx` | catalogue (`kind: snack`) | M2.2 |
| `/[locale]/checkout`, `/order/[id]` | `CartSheet.tsx` form | sales | M2.3 |
| `/[locale]/auth`, `/account/*` | `routes/auth.tsx` | customers | M2.2 |
| `/[locale]/r` | — | redirect to the Google review URL (short link, M3.3) | M3.3 |

## 7. Accessibility and responsive checks (every UI task)

- Check at 360, 768 and 1280 px with no horizontal scroll.
- The header is readable on every page (V-DES "header contrast"). On non-home pages the header is always solid.
- Every image has `alt`, from `media.alt` (localized) or the product name.
- Visible focus ring: `focus-visible:outline-gold-deep`.
- Honour `prefers-reduced-motion` in `Reveal` and in `animate-slow-zoom`.
- Use `next/image` with `sizes` for every CMS and product image.

### Corrections of 12 Nov (APPLUX report 4)
- **Palette:** one colour added, `--burgundy` (`bg-burgundy`, `text-burgundy`), used only for "Épuisé".
- **Availability:** a sold-out product shows the diagonal `Ribbon` on its photo (shop, Comptoir, related products, the product page's gallery) and has no add control; the product page always says "En stock", "Plus que n" or "Épuisé".
- **Shop filters:** one compact bar; Region and Colour are offered only when the selected category has such values; prices are digit-only text fields (no spinner).
- **Checkout:** compact heading and steps; order of steps: mode, (guests), when, contact, (address), payment; the first 5 free times on one row then "Voir plus d’horaires"; a missing field is marked in red once left or after a try to confirm, and the confirm button takes the customer to the first one (`Field` takes an `error`); the payment method is repeated in the summary. The floating cart is hidden on the checkout.
- **Admin summaries:** `DocHead` takes labelled status pills (`DocBadge`: the document's status and its payment's), the money figures (`DocFigures`: total, received, still due) and a "next step" sentence; compact (GG-09). Lists get stage tabs: Orders (`order-tabs.tsx`), bookings of one event (`booking-tabs.tsx`), reservations and catering requests (`statusTabs()` → `components/admin/status-tabs.tsx`). A `StatusTab` is statuses, optionally a day on `slot.date` (`today` / `fromToday`), a sort, an empty message and `opens` (the tab the sidebar opens); its count is exactly the query its link opens, search included, and a URL filter that matches no tab shows "Filtre actif · Effacer le filtre" (GG-04). Reservations: Aujourd'hui, À venir (opened by the sidebar), À confirmer, Acceptées, Terminées, Refusées / annulées, Toutes (`RESERVATION_TABS`; the sidebar, dashboard and bell open them through `statusTabQuery`). An empty tab links to the tabs that have something (`EmptyList` `links`).
- **List cells (orders, reservations):** `SlotCell` marks "En retard" under an open slot whose time has passed; `ModeCell` an icon per mode; `PaymentCell` the payment's state badge and method; `AddressCell` the delivery address on one line; `AttendanceCell` "Client arrivé" / "Client absent" with a confirmation in place, on accepted reservations whose day has come (a reservation with a pre-order opens its page, where the amount paid is asked; GG-05). These lists size columns to their content so they fit 1280 px.
- **List columns and filters (GG-07, GG-18):** `payload.config.ts` (`listFields`) keeps out of every collection's column picker and filters: unnamed fields hidden in the admin, the fields inside a group or list marked `disableListFilter` (or hidden), every list's row id and `ui` panels without a cell. Named fields stay. Technical fields of a collection carry `{ disableListColumn: true, disableListFilter: true }` (`internal` in `modules/sales/collections.ts`).
- **Event reservations:** `/admin/event-bookings` (`modules/events/admin/events-board.tsx`) is the sidebar's entry: "À venir" / "Archives", one card per event (seats reserved, remaining, to confirm, money received) with "Voir les réservations".
- **Status colours, everywhere:** amber = waits for staff, blue = in progress, green = done or paid, red = refused or cancelled, grey = closed or neutral.

### Documents written by services (M2.3)
Orders, table reservations and event bookings are never edited field by field. Their admin page is one summary (`components/admin/doc-panel.tsx`): a header with the status badge and a one-line summary, three cards (customer, slot, payment), the items with totals and VAT, the customer's message and the history (when, what, who, why). Under the header, `components/admin/decision-bar.tsx` offers only the moves the state machine allows; each one first says what will happen (stock, e-mail), asks for an optional reason when it undoes something, then reloads the page.

