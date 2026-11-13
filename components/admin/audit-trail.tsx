import type { Field, Payload, UIFieldServerProps } from 'payload';
import { type Label, yesNo } from '@/lib/admin';
import type { AuditAction } from '@/lib/audit';
import { formatMoney } from '@/lib/money';
import type { AuditLog } from '@/payload-types';
import { AUDIT_LABELS } from '@/modules/settings/collections';
import { DocCard, DocHistory } from './doc-panel';

// "History" on a document edited in the admin (GG-046): the activity log entries of this document, newest last, with
// who, when, what changed (in the collection's own field and option names) and the reason. A `ui` field: the
// catering requests and event bookings show it. The same change line is the activity log entry's own page (GG-18).

type Named = { label: string; options: Map<string, string> };

const say = (value: unknown, lang: string): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return (value as Label)[lang as keyof Label] ?? (value as Label).fr ?? '';
  return '';
};

/** Field paths ("status", "contact.email") → their label and option labels, through rows, tabs and groups. */
function namesOf(fields: Field[], lang: string, prefix = '', out = new Map<string, Named>()) {
  for (const f of fields) {
    if ('fields' in f && (f.type === 'row' || f.type === 'collapsible')) namesOf(f.fields, lang, prefix, out);
    else if (f.type === 'tabs') for (const tab of f.tabs) namesOf(tab.fields, lang, 'name' in tab && tab.name ? `${prefix}${tab.name}.` : prefix, out);
    // Rows of a list are named like a group's fields ("payments.amountCents": a booking's payment lines).
    else if ((f.type === 'group' || f.type === 'array') && 'name' in f) namesOf(f.fields, lang, `${prefix}${f.name}.`, out);
    else if ('name' in f) {
      const options = new Map<string, string>();
      if ('options' in f && Array.isArray(f.options)) for (const o of f.options) if (typeof o === 'object') options.set(String(o.value), say(o.label, lang));
      out.set(prefix + f.name, { label: say('label' in f ? f.label : '', lang) || f.name, options });
    }
  }
  return out;
}

/** The field and option names of a collection, in the admin's language. */
function namesFor(payload: Payload, slug: string | null | undefined, lang: string) {
  const config = slug ? (payload.collections as unknown as Record<string, { config: { fields: Field[] } } | undefined>)[slug]?.config : undefined;
  return config ? namesOf(config.fields, lang) : new Map<string, Named>();
}

/** "Statut : Nouvelle → Client contacté · Montant : 48,00 €": what an entry changed, in the collection's own words. */
function changesOf(entry: AuditLog, names: Map<string, Named>, lang: string) {
  // Amounts are kept in cents (`…Cents`): shown in euros, in the admin's language (§8); yes/no in words (GG-18).
  const show = (key: string, v: unknown) =>
    v == null || v === ''
      ? '—'
      : typeof v === 'boolean'
        ? yesNo(lang, v)
        : key.endsWith('Cents') && typeof v === 'number'
          ? formatMoney(v, lang)
          : (names.get(key)?.options.get(String(v)) ?? String(v));
  const after = (entry.after ?? {}) as Record<string, unknown>;
  const before = (entry.before ?? {}) as Record<string, unknown>;
  return Object.keys(after)
    .map((k) => `${names.get(k)?.label ?? k} : ${entry.action === 'doc.update' ? `${show(k, before[k])} → ` : ''}${show(k, after[k])}`)
    .join(' · ');
}

export default async function AuditTrail({ id, payload, i18n, collectionSlug }: UIFieldServerProps & { collectionSlug?: string }) {
  if (!id) return null;
  const lang = i18n.language;
  const { docs } = await payload.find({ collection: 'auditLogs', where: { docId: { equals: String(id) } }, sort: 'createdAt', limit: 100, depth: 1, overrideAccess: true });
  const names = namesFor(payload, collectionSlug ?? docs[0]?.targetCollection, lang);
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  const title = say({ fr: 'Historique', en: 'History', de: 'Verlauf', pt: 'Histórico' }, lang);
  const empty = say({ fr: 'Aucune action enregistrée pour l’instant.', en: 'Nothing recorded yet.', de: 'Noch nichts erfasst.', pt: 'Ainda nada registado.' }, lang);
  // Staff actions always carry their user; a line without one was written by the website (a customer's request).
  const website = say({ fr: 'Site web (client)', en: 'Website (customer)', de: 'Website (Kunde)', pt: 'Site (cliente)' }, lang);

  return (
    <DocCard title={title} wide>
      <DocHistory
        empty={empty}
        rows={docs.map((d) => {
          const changes = changesOf(d, names, lang);
          return {
            when: when.format(new Date(d.createdAt)),
            text: `${say(AUDIT_LABELS[d.action as AuditAction], lang)}${changes ? ` — ${changes}` : ''}`,
            by: typeof d.user === 'object' && d.user ? d.user.name : website,
            note: d.reason,
          };
        })}
      />
    </DocCard>
  );
}

/** An activity log entry's page: what it changed in words, instead of its raw before/after data (QA 12 Nov, GG-18). */
export async function AuditChanges({ id, payload, i18n }: UIFieldServerProps) {
  if (!id) return null;
  const entry = await payload.findByID({ collection: 'auditLogs', id, depth: 0, overrideAccess: true, disableErrors: true });
  if (!entry) return null;
  const lang = i18n.language;
  const title = say({ fr: 'Changements', en: 'Changes', de: 'Änderungen', pt: 'Alterações' }, lang);
  const where = (payload.collections as unknown as Record<string, { config: { labels?: { plural?: unknown } } } | undefined>)[entry.targetCollection]?.config.labels?.plural;
  return (
    <DocCard title={title} wide>
      <p className="gg-doc__note">
        <b>{say(where, lang) || entry.targetCollection}</b> — {changesOf(entry, namesFor(payload, entry.targetCollection, lang), lang) || '—'}
      </p>
    </DocCard>
  );
}
