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

`button` (the base; our `Button` in §3.2 wraps or replaces it), `sheet` (cart, mobile nav), `dialog` (event booking), `sonner` (toasts), `input`, `textarea`, `select`, `label`, `checkbox`, `radio-group`, `calendar` + `popover` (slot date picker), `table` (staff lists), `tabs` (staff screens), `badge`, `skeleton`, `separator`. Add another primitive only when a milestone needs it. The prototype's other ~30 primitives are **not** ported.

### 3.2 Our components: each replaces repeated prototype markup

| Component | File | Replaces / ports | Props (keep them minimal) |
|---|---|---|---|
| `Button` | `components/ui/button.tsx` (cva) | 15+ pill class strings, plus the square translucent gold CTA of Hero, Store and Happy Hour | `variant`: `solid` \| `outline` \| `gold` \| `goldGlass` \| `ghost` \| `chip` \| `icon`; `size`: `sm` (h-9) \| `md` (h-11) \| `lg` (h-12); `active` (chip); `asChild` |
| `Field` | `components/ui/field.tsx` | `F` in events.tsx, `Field` in catering.tsx and contact.tsx, cart inputs | `label`, `name`, `error?`, `as?: 'input' \| 'textarea' \| 'select'`, plus native props. Shows `fieldErrors[name]` from `useActionState`. |
| `Container` | `components/site/container.tsx` | repeated `mx-auto max-w-[1400px] px-6 md:px-10` | `size?: 'md' \| 'lg'`, `as?` |
| `PageHero` | `components/site/page-hero.tsx` | page headers in shop/snack/events/catering + `PageShell` | `eyebrow`, `title: [string, string?]` (second half rendered italic gold-deep), `subtitle?`, `children?` (CTAs) |
| `MediaCard` | `components/site/media-card.tsx` | ProductCard (shop), MenuCard (snack), event card | `image`, `alt`, `ratio: '4/5' \| '4/3'`, `tag?`, `overlay?` (event style: gradient + text over image), `children` (body), `action?` (corner button slot) |
| `MediaGrid` | `components/site/media-grid.tsx` | grids in shop (gap-6/8) and hairline grids (snack/events) | `cols: 3 \| 4`, `hairline?: boolean` |
| `QtyStepper` | `components/site/qty-stepper.tsx` | snack MenuCard stepper, cart line stepper, events guests | `value`, `onChange`, `min?`, `max?`, `size?` |
| `PriceTag` | inline `formatMoney` call; **no component** | `fmtEUR` | use `formatMoney(cents, locale)` from `lib/money.ts` |
| `Reveal` | `components/site/reveal.tsx` (`'use client'`) | `Reveal.tsx` + `use-reveal.ts`, merged into one file | `delay?`, `as?`, `className?`. Respect `prefers-reduced-motion` (show immediately). |
| `Nav` | `components/site/nav.tsx` (`'use client'`) | `Nav.tsx` | transparent on home until `scrollY > 40`, otherwise solid dark (`ink`); **one logo everywhere: `logo-light.png`, the gold one** (Aniket's decision); links left and right of the logo from 768 px up, full-screen menu below; links from the `Header` global |
| `Footer` | `components/site/footer.tsx` (server) | `Footer.tsx` | tile band, "Bem-vindo." statement + reserve CTA, logo + tagline + socials, CMS columns, contact + directions, hours, legal + back to top; data from the `Footer` global and settings |
| `LanguageSwitcher` | `components/site/language-switcher.tsx` | `LanguageSwitcher.tsx` (inline FR · EN · DE · PT row, replaced by a dropdown) | dropdown: current language + menu of the four; swaps the `[locale]` segment and keeps the path; `tone: 'light' \| 'dark'`, `placement: 'below-end' \| 'above-start'` |
| `CartSheet`, `FloatingCart`, `CartProvider` | `components/site/cart-*.tsx`, `modules/webshop/cart.tsx` | `CartSheet.tsx`, `FloatingCart.tsx`, `lib/cart.tsx` | the cart stores `{ variant, unit?, qty }` only; names and prices are displayed from the server `quote` |
| `ActionForm` | `components/ui/action-form.tsx` | every mocked `submit()` with `setTimeout` | wraps `useActionState`, shows pending state, success toast, field errors |
| `Blocks` | `components/site/blocks.tsx` | renders `pages.layout` blocks | one switch over the block types in §4 |
| Home sections | `components/site/home/*.tsx` | `Hero`, `Universes`, `Craft`, `Story`, `Store`, `HappyHour`, `Events`, `SocialProof`, `Marquee`, `Hospitality` | ported 1:1, server components unless they animate; copy from CMS/dictionary |

Before adding a component, check this table. If an existing one is 80 % right, add a prop or variant to it.

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
