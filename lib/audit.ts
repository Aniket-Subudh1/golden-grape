import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, Payload, PayloadRequest } from 'payload';

// The activity log (GG-046): who did what, when, on which document, and why. One writer for every entry:
// - staff decisions made through the services (order and reservation moves, payments, refunds, returns, bookings,
//   stock adjustments and counts) call `audit()` from their action once the change is committed;
// - edits made in the admin forms are recorded by `auditHooks` with the fields that changed.
// Writes made by the website or the services themselves carry no staff user and are not logged here (orders and
// reservations keep their own history, payments and stock movements their own rows). One exception: a catering
// request sent from the website logs its arrival with no user, so its history starts with it.

export const AUDIT_ACTIONS = [
  'order.status',
  'order.payment',
  'order.refundRequest',
  'order.refund',
  'order.return',
  'reservation.status',
  'booking.status',
  'booking.payment',
  'stock.adjust',
  'stock.count',
  'catalogue.import',
  'doc.create',
  'doc.update',
  'doc.delete',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type Json = Record<string, unknown>;
export type AuditEntry = {
  user?: string | null;
  action: AuditAction;
  collection: string;
  id: string;
  /** What staff call the document: "CMD-2026-00001", "DEM-2026-0004", a product's name… */
  ref?: string | null;
  reason?: string | null;
  before?: Json;
  after?: Json;
};

/** Never lets a failed log line undo or block the action itself: the error is reported and the work stands. */
export async function audit(payload: Payload, entry: AuditEntry, req?: PayloadRequest) {
  try {
    await payload.create({
      collection: 'auditLogs',
      overrideAccess: true,
      depth: 0,
      ...(req ? { req } : {}),
      data: {
        user: entry.user ?? undefined,
        action: entry.action,
        targetCollection: entry.collection,
        docId: entry.id,
        ref: entry.ref ?? undefined,
        reason: entry.reason ?? undefined,
        before: entry.before,
        after: entry.after,
      },
    });
  } catch (error) {
    console.error('[audit]', entry.action, entry.collection, entry.id, error);
  }
}

// ---- Edits in the admin forms ----------------------------------------------------------------------------

// Technical fields: timestamps, sign-in bookkeeping (a login is not an edit), secrets (never logged).
const IGNORED = new Set(['id', 'createdAt', 'updatedAt', 'history', 'globalType', '_status', 'lockVersion', 'sessions', 'loginAttempts', 'lockUntil', 'resetPasswordToken', 'resetPasswordExpiration', 'salt', 'hash', 'password', '_verified', '_verificationToken']);

/** Long or nested values are summarised: the log says that a text or a list changed, not its whole content. */
const short = (value: unknown) => (typeof value === 'string' && value.length <= 120) || typeof value === 'number' || typeof value === 'boolean' || value == null ? value : '…';

const isGroup = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The fields that differ, as small before/after objects; inside a group, by its own fields ("business.iban"). */
/** A related document compares by its id: after a save Payload may return it populated, before it was only the id. */
const asRef = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(asRef);
  return value && typeof value === 'object' && 'id' in value && 'updatedAt' in value ? (value as Json).id : value;
};

export function changedFields(before: Json | undefined, after: Json, prefix = ''): { before: Json; after: Json; changed: boolean } {
  const b: Json = {};
  const a: Json = {};
  for (const key of Object.keys({ ...before, ...after })) {
    if (IGNORED.has(key)) continue;
    const was = asRef(before?.[key]);
    const now = asRef(after[key]);
    if (JSON.stringify(was ?? null) === JSON.stringify(now ?? null)) continue;
    if (!prefix && (isGroup(was) || isGroup(now)) && !(was as Json)?.id && !(now as Json)?.id) {
      const inner = changedFields(isGroup(was) ? was : undefined, isGroup(now) ? now : {}, `${key}.`);
      Object.assign(b, inner.before);
      Object.assign(a, inner.after);
      continue;
    }
    b[prefix + key] = short(was);
    a[prefix + key] = short(now);
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

const staffOf = (req: PayloadRequest) => (req.user?.collection === 'users' ? req.user.id : null);
const refOf = (doc: Json) => String(doc.number ?? doc.name ?? doc.title ?? doc.label ?? doc.email ?? doc.filename ?? '').slice(0, 120) || null;

/** afterChange / afterDelete hooks for an admin-edited collection: one entry per create, change (with the diff) or delete. */
export const auditHooks = (): { afterChange: CollectionAfterChangeHook[]; afterDelete: CollectionAfterDeleteHook[] } => ({
  afterChange: [
    async ({ doc, previousDoc, operation, req, collection }) => {
      const user = staffOf(req);
      if (!user) return doc;
      const diff = changedFields(operation === 'create' ? undefined : previousDoc, doc);
      if (operation === 'update' && !diff.changed) return doc;
      await audit(req.payload, { user, action: operation === 'create' ? 'doc.create' : 'doc.update', collection: collection.slug, id: String(doc.id), ref: refOf(doc), before: operation === 'create' ? undefined : diff.before, after: diff.after }, req);
      return doc;
    },
  ],
  afterDelete: [
    async ({ doc, req, collection }) => {
      const user = staffOf(req);
      if (user) await audit(req.payload, { user, action: 'doc.delete', collection: collection.slug, id: String(doc.id), ref: refOf(doc) }, req);
      return doc;
    },
  ],
});

/** The same for a global (Shop details, home page…): one entry per save that changed something. */
export const auditGlobalHook =
  (): GlobalAfterChangeHook =>
  async ({ doc, previousDoc, req, global }) => {
    const user = staffOf(req);
    if (!user) return doc;
    const diff = changedFields(previousDoc, doc);
    if (diff.changed) await audit(req.payload, { user, action: 'doc.update', collection: global.slug, id: global.slug, ref: null, before: diff.before, after: diff.after }, req);
    return doc;
  };
