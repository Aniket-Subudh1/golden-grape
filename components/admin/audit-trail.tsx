import type { Field, UIFieldServerProps } from 'payload';
import type { Label } from '@/lib/admin';
import type { AuditAction } from '@/lib/audit';
import { formatMoney } from '@/lib/money';
import { AUDIT_LABELS } from '@/modules/settings/collections';
import { DocCard, DocHistory } from './doc-panel';

// "History" on a document edited in the admin (GG-046): the activity log entries of this document, newest last, with
// who, when, what changed (in the collection's own field and option names) and the reason. A `ui` field: the
// catering requests and event bookings show it.

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
    else if (f.type === 'group' && 'name' in f) namesOf(f.fields, lang, `${prefix}${f.name}.`, out);
    else if ('name' in f) {
      const options = new Map<string, string>();
      if ('options' in f && Array.isArray(f.options)) for (const o of f.options) if (typeof o === 'object') options.set(String(o.value), say(o.label, lang));
      out.set(prefix + f.name, { label: say('label' in f ? f.label : '', lang) || f.name, options });
    }
  }
  return out;
}

export default async function AuditTrail({ id, payload, i18n, collectionSlug }: UIFieldServerProps & { collectionSlug?: string }) {
  if (!id) return null;
  const lang = i18n.language;
  const { docs } = await payload.find({ collection: 'auditLogs', where: { docId: { equals: String(id) } }, sort: 'createdAt', limit: 100, depth: 1, overrideAccess: true });
  const slug = collectionSlug ?? docs[0]?.targetCollection;
  const config = slug ? (payload.collections as unknown as Record<string, { config: { fields: Field[] } } | undefined>)[slug]?.config : undefined;
  const names = config ? namesOf(config.fields, lang) : new Map<string, Named>();
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Luxembourg' });
  // Amounts are kept in cents (`…Cents`): shown in euros, in the admin's language (§8).
  const show = (key: string, v: unknown) =>
    v == null || v === '' ? '—' : key.endsWith('Cents') && typeof v === 'number' ? formatMoney(v, lang) : (names.get(key)?.options.get(String(v)) ?? String(v));
  const title = say({ fr: 'Historique', en: 'History', de: 'Verlauf', pt: 'Histórico' }, lang);
  const empty = say({ fr: 'Aucune action enregistrée pour l’instant.', en: 'Nothing recorded yet.', de: 'Noch nichts erfasst.', pt: 'Ainda nada registado.' }, lang);
  // Staff actions always carry their user; a line without one was written by the website (a customer's request).
  const website = say({ fr: 'Site web (client)', en: 'Website (customer)', de: 'Website (Kunde)', pt: 'Site (cliente)' }, lang);

  return (
    <DocCard title={title} wide>
      <DocHistory
        empty={empty}
        rows={docs.map((d) => {
          const after = (d.after ?? {}) as Record<string, unknown>;
          const before = (d.before ?? {}) as Record<string, unknown>;
          const changes = Object.keys(after)
            .map((k) => `${names.get(k)?.label ?? k} : ${d.action === 'doc.update' ? `${show(k, before[k])} → ` : ''}${show(k, after[k])}`)
            .join(' · ');
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
