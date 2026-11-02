# Modules

One folder per business area: `collections.ts` (Payload config), `service.ts` (public server-only functions), `actions.ts` (thin server actions: validate → service), pure `<rule>.ts` files with `<rule>.test.ts` next to them, and optional `components/`.
Modules call each other only through `service.ts`; never import another module's `collections.ts` or query its collections directly.
Relationship fields between collections are allowed (schema, not code coupling).
Create a module folder only when a milestone fills it.
See `docs/02-ARCHITECTURE.md` §4.
