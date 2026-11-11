import type { UIFieldServerProps } from 'payload';
import DecisionBar, { type DecisionText } from '@/components/admin/decision-bar';
import { DocCard } from '@/components/admin/doc-panel';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { createQuotationAction } from '../actions';
import { QUOTATION_STATUS, QUOTATION_TONES, type QuotationStatus } from '../collections';

// On a catering request (ui field `quotations`): its quotations, newest first, each opening its page, and "Créer un
// devis", which prepares a draft from the request and opens it (Q-12).

const TEXT = {
  fr: { title: 'Devis', none: 'Aucun devis pour cette demande.', create: 'Créer un devis', hint: 'un brouillon est préparé avec le client, la date, le lieu, les personnes et la formule choisie ; vous le complétez avant de l’envoyer.' },
  en: { title: 'Quotations', none: 'No quotation for this request yet.', create: 'Create a quotation', hint: 'a draft is prepared with the customer, date, place, guests and chosen menu; you complete it before sending.' },
  de: { title: 'Angebote', none: 'Noch kein Angebot für diese Anfrage.', create: 'Angebot erstellen', hint: 'ein Entwurf mit Kunde, Datum, Ort, Personen und gewähltem Menü wird vorbereitet; Sie ergänzen ihn vor dem Senden.' },
  pt: { title: 'Orçamentos', none: 'Ainda sem orçamento para este pedido.', create: 'Criar um orçamento', hint: 'é preparado um rascunho com o cliente, a data, o local, as pessoas e o menu escolhido; completa-o antes de o enviar.' },
};

const DECIDE: Record<keyof typeof TEXT, DecisionText> = {
  fr: { confirm: 'Créer', back: 'Retour', reason: '', reasonPh: '', done: 'Brouillon créé.', error: 'Impossible de créer le devis. Réessayez.', errors: {} },
  en: { confirm: 'Create', back: 'Back', reason: '', reasonPh: '', done: 'Draft created.', error: 'Could not create the quotation.', errors: {} },
  de: { confirm: 'Erstellen', back: 'Zurück', reason: '', reasonPh: '', done: 'Entwurf erstellt.', error: 'Angebot konnte nicht erstellt werden.', errors: {} },
  pt: { confirm: 'Criar', back: 'Voltar', reason: '', reasonPh: '', done: 'Rascunho criado.', error: 'Não foi possível criar o orçamento.', errors: {} },
};

export default async function RequestQuotations({ id, payload, i18n, user }: UIFieldServerProps) {
  if (!id) return null;
  const lang = (i18n.language in TEXT ? i18n.language : 'fr') as keyof typeof TEXT;
  const t = TEXT[lang];
  const { docs } = await payload.find({ collection: 'quotations', where: { cateringRequest: { equals: id } }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true });
  const day = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Europe/Luxembourg' });
  return (
    <DocCard title={t.title} wide>
      {docs.length === 0 ? (
        <p className="gg-doc__muted">{t.none}</p>
      ) : (
        <ul className="gg-doc__list">
          {docs.map((q) => {
            const status = (q.status ?? 'draft') as QuotationStatus;
            return (
              <li key={q.id}>
                <a href={`/admin/collections/quotations/${q.id}`}>{q.number ?? q.title}</a>
                <span className={`gg-badge gg-badge--${QUOTATION_TONES[status]}`}>{QUOTATION_STATUS[status][lang]}</span>
                <span>{formatMoney(q.totals?.totalCents ?? 0, lang)}</span>
                <span className="gg-doc__muted">{day.format(new Date(q.sentAt ?? q.createdAt))}</span>
              </li>
            );
          })}
        </ul>
      )}
      {hasRole(user, ['sales']) && (
        <DecisionBar action={createQuotationAction} target={{ request: String(id) }} decisions={[{ to: 'create', label: t.create, hint: t.hint, tone: 'primary' }]} text={DECIDE[lang]} />
      )}
    </DocCard>
  );
}
