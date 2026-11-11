import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload';
import { hasRole, hiddenUnless, isStaff, none, staffOrSelf } from '@/lib/access';
import { badgeCell, l, type Label, say, scaledNumber } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { type DocumentDiscount, priceDocument, type VatClass } from '@/modules/promotions/pricing';

// Catering quotations (Q-12, built 11 Nov 2026) and the PDF files of documents. A quotation is prepared by staff from
// a catering request, then sent, viewed, signed or declined by the customer through a link (service.ts). The B2B
// product quotations of M3.2 will use the same collection, numbering and PDF.

export const QUOTATION_STATUS: Record<string, Label> = {
  draft: l('Brouillon', 'Draft', 'Entwurf', 'Rascunho'),
  sent: l('Envoyé', 'Sent', 'Gesendet', 'Enviado'),
  viewed: l('Consulté par le client', 'Viewed by the customer', 'Vom Kunden angesehen', 'Visto pelo cliente'),
  accepted: l('Accepté et signé', 'Accepted and signed', 'Angenommen und unterschrieben', 'Aceite e assinado'),
  declined: l('Refusé', 'Declined', 'Abgelehnt', 'Recusado'),
  expired: l('Expiré', 'Expired', 'Abgelaufen', 'Expirado'),
};
export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
export const QUOTATION_TONES = { draft: 'neutral', sent: 'info', viewed: 'info', accepted: 'success', declined: 'danger', expired: 'warning' } as const;

/** VAT of a line, by class: its rate comes from Shop details (A-07 until the accountant answers, DEP-07). */
export const VAT_CLASS_LABELS: Record<VatClass, Label> = {
  standard: l('TVA normale (17 %)', 'Standard VAT (17 %)', 'Normaler Satz (17 %)', 'IVA normal (17 %)'),
  intermediate: l('TVA intermédiaire (14 %)', 'Intermediate VAT (14 %)', 'Zwischensatz (14 %)', 'IVA intermédia (14 %)'),
  reduced: l('TVA réduite (8 %)', 'Reduced VAT (8 %)', 'Ermäßigter Satz (8 %)', 'IVA reduzida (8 %)'),
  superReduced: l('TVA super-réduite (3 %)', 'Super-reduced VAT (3 %)', 'Stark ermäßigt (3 %)', 'IVA super-reduzida (3 %)'),
};

const options = (labels: Record<string, Label>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * While a quotation is a draft, its totals are computed again on every save from its lines and discount, in the one
 * place that prices documents (`priceDocument`). Once sent it never changes: the customer signs what was sent.
 */
const priceDraft: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const status = data.status ?? originalDoc?.status ?? 'draft';
  if (status !== 'draft') return data;
  // Loaded when needed: the services import the Payload config, which imports this file.
  const rates = await (await import('@/modules/promotions/service')).vatRates();
  const lines = (data.lines ?? []) as { qty?: number; unitPriceCents?: number; vat?: VatClass }[];
  const discount: DocumentDiscount =
    data.discount?.kind === 'percent'
      ? { kind: 'percent', value: data.discount.percentBp ?? 0 }
      : data.discount?.kind === 'amount'
        ? { kind: 'amount', value: data.discount.amountCents ?? 0 }
        : { kind: 'none' };
  try {
    const priced = priceDocument(
      lines.map((line) => ({ qty: line.qty ?? 0, unitPriceCents: line.unitPriceCents ?? 0, vatBp: rates[line.vat ?? 'standard'] })),
      discount,
    );
    data.lines = lines.map((line, i) => ({ ...line, vatBp: rates[line.vat ?? 'standard'], totalCents: priced.lines[i].totalCents }));
    data.totals = {
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      vatCents: priced.vatCents,
      totalCents: priced.totalCents,
      vatBreakdown: priced.vatBreakdown,
    };
  } catch (error) {
    // A discount above the total, a quantity of 0: said in the language of the person saving.
    throw new Error(
      say(
        req,
        (error as Error).message === 'discount'
          ? l('La remise dépasse le total du devis.', 'The discount is larger than the total.', 'Der Rabatt ist höher als die Summe.', 'O desconto é maior do que o total.')
          : l('Chaque ligne a besoin d’une quantité et d’un prix.', 'Each line needs a quantity and a price.', 'Jede Zeile braucht eine Menge und einen Preis.', 'Cada linha precisa de uma quantidade e de um preço.'),
      ),
    );
  }
  return data;
};

const readOnly = { readOnly: true };
const hidden = { hidden: true };

const lineFields: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'description', type: 'text', required: true, label: l('Désignation', 'Description', 'Bezeichnung', 'Designação'), admin: { width: '40%' } },
      { name: 'qty', type: 'number', required: true, min: 0.01, defaultValue: 1, label: l('Quantité', 'Quantity', 'Menge', 'Quantidade'), admin: { width: '15%', step: 0.5 } },
      {
        name: 'unitPriceCents',
        type: 'number',
        required: true,
        min: 0,
        label: l('Prix unitaire TTC', 'Unit price incl. VAT', 'Einzelpreis inkl. MwSt.', 'Preço unitário c/ IVA'),
        admin: { width: '20%', components: scaledNumber('€') },
      },
      {
        name: 'vat',
        type: 'select',
        required: true,
        defaultValue: 'standard',
        label: l('TVA', 'VAT', 'MwSt.', 'IVA'),
        options: options(VAT_CLASS_LABELS),
        admin: { width: '25%', isClearable: false },
      },
    ],
  },
  { name: 'detail', type: 'textarea', label: l('Détail (facultatif)', 'Details (optional)', 'Details (optional)', 'Detalhe (opcional)'), admin: { rows: 2 } },
  { name: 'vatBp', type: 'number', admin: hidden },
  { name: 'totalCents', type: 'number', admin: hidden },
];

export const quotations: CollectionConfig = {
  slug: 'quotations',
  labels: { singular: l('Devis', 'Quotation', 'Angebot', 'Orçamento'), plural: l('Devis', 'Quotations', 'Angebote', 'Orçamentos') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'totals', 'validUntil', 'updatedAt'],
    hidden: hiddenUnless('sales'),
    listSearchableFields: ['title', 'number', 'contact.name', 'contact.email'],
    description: l(
      'Les devis traiteur : créés depuis une demande traiteur, envoyés au client par e-mail, signés en ligne.',
      'Catering quotations: created from a catering request, e-mailed to the customer, signed online.',
      'Catering-Angebote: aus einer Catering-Anfrage erstellt, per E-Mail gesendet, online unterschrieben.',
      'Orçamentos de catering: criados a partir de um pedido, enviados por e-mail, assinados online.',
    ),
  },
  access: {
    read: staffOrSelf('customer'),
    // Staff edit a draft only: once sent, the customer signs exactly what was sent (services use overrideAccess).
    update: ({ req: { user } }) => (hasRole(user, ['sales']) ? { status: { equals: 'draft' } } : false),
    create: none,
    delete: ({ req: { user } }) => (hasRole(user, ['manager']) ? { status: { equals: 'draft' } } : false),
  },
  defaultSort: '-updatedAt',
  hooks: { beforeChange: [priceDraft] },
  custom: {
    // Numbers are given when a quotation is sent: drafts have none, so uniqueness applies to the numbered ones only.
    indexes: [{ fields: { number: 1 }, options: { unique: true, partialFilterExpression: { number: { $type: 'string' } } } }],
  },
  fields: [
    { name: 'panel', type: 'ui', admin: { disableListColumn: true, components: { Field: '@/modules/documents/admin/quotation-panel' } } },
    // "DEV-2026-0001 · Roby Test", or "Brouillon · Roby Test" before sending: set by the services.
    { name: 'title', type: 'text', label: l('Devis', 'Quotation', 'Angebot', 'Orçamento'), admin: hidden },
    // Indexed by the partial unique index above (drafts have no number).
    { name: 'number', type: 'text', label: l('Numéro', 'Number', 'Nummer', 'Número'), admin: hidden },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      label: l('Statut', 'Status', 'Status', 'Estado'),
      options: options(QUOTATION_STATUS),
      admin: { ...hidden, components: badgeCell(QUOTATION_TONES) },
    },
    { name: 'cateringRequest', type: 'relationship', relationTo: 'cateringRequests', index: true, label: l('Demande traiteur', 'Catering request', 'Catering-Anfrage', 'Pedido de catering'), admin: readOnly },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Compte client', 'Customer account', 'Kundenkonto', 'Conta de cliente'), admin: readOnly },
    {
      name: 'contact',
      type: 'group',
      label: l('Client', 'Customer', 'Kunde', 'Cliente'),
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '34%' } },
            { name: 'email', type: 'email', required: true, label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail'), admin: { width: '33%' } },
            { name: 'phone', type: 'text', label: l('Téléphone', 'Phone', 'Telefon', 'Telefone'), admin: { width: '33%' } },
          ],
        },
        { name: 'company', type: 'text', label: l('Société (facultatif)', 'Company (optional)', 'Firma (optional)', 'Empresa (opcional)') },
      ],
    },
    {
      name: 'event',
      type: 'group',
      label: l('Prestation', 'Event', 'Veranstaltung', 'Evento'),
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'date', type: 'date', label: l('Date', 'Date', 'Datum', 'Data'), admin: { width: '25%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } } },
            { name: 'time', type: 'text', label: l('Heure', 'Time', 'Uhrzeit', 'Hora'), admin: { width: '15%' } },
            { name: 'guests', type: 'number', min: 1, label: l('Personnes', 'Guests', 'Personen', 'Pessoas'), admin: { width: '15%' } },
            { name: 'location', type: 'text', label: l('Lieu', 'Place', 'Ort', 'Local'), admin: { width: '45%' } },
          ],
        },
      ],
    },
    { name: 'customerMessage', type: 'textarea', label: l('Message du client', 'Customer’s message', 'Nachricht des Kunden', 'Mensagem do cliente'), admin: readOnly },
    {
      name: 'lines',
      type: 'array',
      minRows: 1,
      label: l('Lignes du devis', 'Quotation lines', 'Angebotszeilen', 'Linhas do orçamento'),
      labels: { singular: l('Ligne', 'Line', 'Zeile', 'Linha'), plural: l('Lignes', 'Lines', 'Zeilen', 'Linhas') },
      admin: {
        components: { RowLabel: '@/components/admin/row-label' },
        description: l(
          'Menu par personne, service, location de matériel… Prix TTC. Les totaux sont recalculés à chaque enregistrement.',
          'Menu per guest, service, equipment hire… Prices include VAT. Totals are worked out again on each save.',
          'Menü pro Person, Service, Mietmaterial… Preise inkl. MwSt. Die Summen werden bei jedem Speichern neu berechnet.',
          'Menu por pessoa, serviço, aluguer de material… Preços com IVA. Os totais são recalculados a cada gravação.',
        ),
      },
      fields: lineFields,
    },
    {
      name: 'discount',
      type: 'group',
      label: l('Remise', 'Discount', 'Rabatt', 'Desconto'),
      // Edited on a draft; once sent, the panel's "Montants" card shows it.
      admin: { condition: (data) => (data?.status ?? 'draft') === 'draft' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'kind',
              type: 'select',
              defaultValue: 'none',
              label: l('Type de remise', 'Discount type', 'Rabattart', 'Tipo de desconto'),
              options: [
                { value: 'none', label: l('Aucune', 'None', 'Keiner', 'Nenhum') },
                { value: 'percent', label: l('Pourcentage', 'Percentage', 'Prozent', 'Percentagem') },
                { value: 'amount', label: l('Montant TTC', 'Amount incl. VAT', 'Betrag inkl. MwSt.', 'Montante c/ IVA') },
              ],
              admin: { width: '34%', isClearable: false },
            },
            {
              name: 'percentBp',
              type: 'number',
              min: 0,
              max: 10000,
              label: l('Remise (%)', 'Discount (%)', 'Rabatt (%)', 'Desconto (%)'),
              admin: { width: '33%', components: scaledNumber('%'), condition: (_, sibling) => sibling?.kind === 'percent' },
            },
            {
              name: 'amountCents',
              type: 'number',
              min: 0,
              label: l('Remise (€)', 'Discount (€)', 'Rabatt (€)', 'Desconto (€)'),
              admin: { width: '33%', components: scaledNumber('€'), condition: (_, sibling) => sibling?.kind === 'amount' },
            },
          ],
        },
      ],
    },
    {
      name: 'totals',
      type: 'group',
      label: l('Total TTC', 'Total incl. VAT', 'Summe inkl. MwSt.', 'Total c/ IVA'),
      admin: { ...hidden, components: { Cell: '@/modules/documents/admin/cells#TotalCell' } },
      fields: [
        { name: 'subtotalCents', type: 'number' },
        { name: 'discountCents', type: 'number' },
        { name: 'vatCents', type: 'number' },
        { name: 'totalCents', type: 'number' },
        { name: 'vatBreakdown', type: 'array', fields: [{ name: 'rateBp', type: 'number' }, { name: 'baseCents', type: 'number' }, { name: 'vatCents', type: 'number' }] },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'validUntil',
          type: 'date',
          required: true,
          label: l('Valable jusqu’au', 'Valid until', 'Gültig bis', 'Válido até'),
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          defaultValue: 'fr',
          label: l('Langue du devis', 'Language of the quotation', 'Sprache des Angebots', 'Língua do orçamento'),
          options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
          admin: { width: '50%', isClearable: false },
        },
      ],
    },
    { name: 'conditions', type: 'textarea', label: l('Conditions', 'Conditions', 'Bedingungen', 'Condições'), admin: { rows: 5 } },
    // Written by the services only (sending, the customer's page, signature).
    { name: 'sentAt', type: 'date', admin: hidden },
    { name: 'viewedAt', type: 'date', admin: hidden },
    { name: 'acceptedAt', type: 'date', admin: hidden },
    { name: 'declinedAt', type: 'date', admin: hidden },
    { name: 'declineReason', type: 'text', admin: hidden },
    { name: 'expiredAt', type: 'date', admin: hidden },
    {
      name: 'signature',
      type: 'group',
      admin: hidden,
      fields: [
        { name: 'name', type: 'text' },
        { name: 'at', type: 'date' },
        { name: 'ip', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
    },
    { name: 'pdf', type: 'relationship', relationTo: 'documentFiles', admin: hidden },
    { name: 'signedPdf', type: 'relationship', relationTo: 'documentFiles', admin: hidden },
  ],
};

/**
 * The PDF files of documents (a quotation as sent, as signed). Kept in the database, not in the media bucket: that
 * bucket is shared and not private (Q-09), and these are customers' signed documents (D-08). The bytes (`data`,
 * base64) are never returned by the API; they are served only by `app/api/documents/[id]` to staff, the owner, or a
 * link token. Written by the server only, never changed or deleted.
 */
export const documentFiles: CollectionConfig = {
  slug: 'documentFiles',
  labels: { singular: l('Document PDF', 'PDF document', 'PDF-Dokument', 'Documento PDF'), plural: l('Documents PDF', 'PDF documents', 'PDF-Dokumente', 'Documentos PDF') },
  admin: { hidden: true, useAsTitle: 'filename' },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  fields: [
    { name: 'kind', type: 'select', required: true, options: ['quotation', 'quotation_signed'] },
    { name: 'filename', type: 'text', required: true },
    { name: 'quotation', type: 'relationship', relationTo: 'quotations', index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true },
    { name: 'sizeBytes', type: 'number' },
    { name: 'sha256', type: 'text' },
    // Base64 of the PDF (about 110 KB for a quotation with the logo); 12 MB keeps a document under MongoDB's 16 MB.
    { name: 'data', type: 'text', required: true, maxLength: 12 * 1024 * 1024, access: { read: () => false } },
  ],
};

export const documentCollections = [quotations, documentFiles];

/** Staff who may open a quotation's PDF before it is sent (preview). */
export const canPreview = isStaff('sales');
