# 03 · Coding laws

The goal is **the smallest correct codebase**: less code, reused components, logic that is right the first time, and tests only where a mistake would silently cost money, stock or privacy.

## 1. The laws

1. **Use the Payload admin for CRUD.** Never hand-build a list, edit or delete screen that Payload already gives you. Write custom UI only for: the public site, the mobile staff screens (`05-UI-SYSTEM.md` §5), the dashboard, and admin actions that Payload cannot express (custom buttons as `admin.components`).
2. **One implementation per rule.** Stock goes only through `inventory.postMovements`, prices only through `pricing.quote`, document numbers only through `nextNumber`, money formatting only through `formatMoney`, and the Luxembourg timezone only through `lib/time.ts`. If you need a variation, extend the function. Never copy it.
3. **Deletion test.** A helper, component or abstraction exists only when it has **two real callers**, or when it holds one of the rules in law 2. Write it inline first, and extract it when the second caller appears.
4. **Reuse before you write.** Check `05-UI-SYSTEM.md` §3 before writing JSX. Never repeat a class string that a variant already covers (for example the pill button). Add a variant to the component instead.
5. **Server first.** Pages and layouts are Server Components. `'use client'` is only for interactivity: cart, dialogs, scanner, steppers, the language switcher, `Reveal`. Pass data down; do not fetch on the client.
6. **Mutations are server actions** wrapped in `action()` or `publicAction()` (§4). The only route handlers are `api/health`, `api/webhooks/[provider]`, `api/cron/[job]` and Payload's generated routes.
7. **Validate at the edge, trust inside.** zod parses action input once. Services take typed input and do not validate again.
8. **Money is integer cents.** Never use a float for an amount. Percentages are basis points (`2100` = 21.00 %). VAT rates come from `BusinessSettings`.
9. **Every write that touches two documents runs in `withTx`.** If a write touches stock, money, a document number or an idempotency key, it is in a transaction.
10. **Every customer-facing string is in the four dictionaries**, or it is a localized Payload field. No hard-coded French or English in JSX.
11. **No barrel files** (`index.ts` re-exports). No `any`. No `// @ts-ignore`. No unused exports. No commented-out code.
12. **No placeholder UI.** Do not ship a page, section or button for a feature that does not exist yet (V-DES "no placeholders at acceptance").
13. **Errors:** throw `AppError` for expected failures. Let everything else crash to `error.tsx` and the log. Never swallow an error with an empty `catch`. The prototype's `catch {}` around localStorage is the only allowed exception, and it carries a comment.
14. **Keep the prototype's look; fix its code.** Pixel output must match the prototype, but replace mocked behaviour (`setTimeout` + toast) with real actions, and collapse its duplicated markup into the shared components.

## 2. Do not generate filler

Do not write: generic README boilerplate, JSDoc that restates the signature, tests of Payload CRUD, snapshot tests, tests of styling, "utils" folders full of single-use helpers, wrapper components that only forward props, config options set to their default value, or empty `loading.tsx` and `error.tsx` files in every route. One `error.tsx` per route group is enough.

## 3. Naming

- Files are `kebab-case.ts`; React components are `PascalCase` exports inside kebab-case files (`components/site/page-hero.tsx` → `PageHero`).
- Collection slugs are `camelCase` plural (`stockMovements`). Global slugs are `PascalCase` (`BusinessSettings`).
- Server actions are verbs (`placeOrder`, `adjustStock`, `issueInvoice`).
- Every money field name ends in `Cents` (`unitPriceCents`, `totalCents`).

## 4. Canonical patterns

### 4.1 Server action

```ts
// modules/inventory/actions.ts
'use server';
import { z } from 'zod';
import { action } from '@/lib/action';
import { adjust } from './service';

export const adjustStock = action(
  z.object({ variant: z.string(), qty: z.coerce.number().int().refine((n) => n !== 0), reason: z.string().min(3) }),
  { roles: ['admin', 'manager', 'stock'] },
  (input, { payload, user }) => adjust(payload, { ...input, user: user.id }),
);
```

`action()` resolves the staff user from the Payload cookie (`payload.auth({ headers })`) and checks the role. It parses with zod and maps `AppError` and zod issues to `{ ok: false, error, fieldErrors }`. On success it returns `{ ok: true, data }`. Client forms read this with `useActionState`. `publicAction()` does the same with an optional customer instead of a required staff user.

### 4.2 Transaction

```ts
import { withTx } from '@/lib/tx';
await withTx(payload, async (tx) => {
  const order = await payload.create({ collection: 'orders', data, req: tx.req });
  await postMovements(tx, saleLines(order));
  return order;
});
```

### 4.3 Payload access (one file, reused everywhere)

```ts
// in a collection config
access: { read: staffOrSelf('customer'), create: isStaff('admin', 'manager', 'sales'), update: isStaff('admin', 'manager'), delete: () => false }
```

`staffOrSelf(field)` returns `true` for staff and a `where` filter `{ [field]: { equals: user.id } }` for customers, so Payload itself enforces the scoping on every query, including REST and the admin.

### 4.4 Page with dictionary and localized content

```tsx
// app/(site)/[locale]/snack/page.tsx
export default async function SnackPage({ params }: PageProps<'/[locale]/snack'>) {
  const { locale } = await params;
  const [t, items] = await Promise.all([getDictionary(locale), listMenu(locale)]);
  return (
    <>
      <PageHero eyebrow={t.snackPage.eyebrow} title={[t.snackPage.titleA, t.snackPage.titleB]} subtitle={t.snackPage.subtitle} />
      <MediaGrid cols={3}>{items.map((i) => <MenuCard key={i.id} item={i} t={t} />)}</MediaGrid>
    </>
  );
}
```

Check the exact `PageProps` and `params` typing against `node_modules/next/dist/docs/01-app/03-api-reference/` before you copy this.

### 4.5 Pure logic + test vectors

Every pure rule file (`slots.ts`, `pricing.ts`, `packaging.ts`, `zones.ts`, `order-states.ts`, `qr-token.ts`, `pos-csv.ts`) exports pure functions with no Payload import, and has a `*.test.ts` file with a **table of vectors** (`it.each`). The vectors in the milestone file are the minimum.

### 4.6 Order and booking state machine

Transitions are declared as data and checked in one place:

```ts
export const ORDER_FLOW = {
  pending: ['confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded'],
  ready: ['completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [], refunded: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;
```

`transition(id, to)` rejects any move that is not listed and runs the side effects (stock, e-mail, outbox) for the target state.

## 5. Git

- Commit format: `Mx.y Tn: <imperative summary>` (for example `M2.1 T3: add postMovements with negative-stock guard`).
- One task is one or more commits. Never leave a commit with a broken build.
- Never commit `.env*` (except `.env.example`) or anything from `golden-grape-luxembourg/`.
