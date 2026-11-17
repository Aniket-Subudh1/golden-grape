import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload';
import { hasRole, hiddenUnless, isStaff, none, staffOrSelf } from '@/lib/access';
import { badgeCell, l, type Label, say, scaledNumber } from '@/lib/admin';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { type DocumentDiscount, priceDocument, type VatClass } from '@/modules/promotions/pricing';

// Quotations (catering, Q-12; B2B product quotations, M3.2), invoices, delivery notes, credit notes and the PDF files
// of documents (04 §5). A quotation is sent, viewed, signed or declined by the customer through a link (service.ts);
// invoices and credit notes never change once issued, except their status and payment (immutable below).

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
  // A B2B quotation is priced by `quote` when it is made (M3.2) and kept as priced: never re-priced here.
  if (status !== 'draft' || (data.kind ?? originalDoc?.kind) === 'b2b') return data;
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
  // B2B quotations (M3.2): the size and box quoted, and the line's discount (promotion), for the order made from it.
  { name: 'variant', type: 'relationship', relationTo: 'variants', admin: hidden },
  { name: 'unit', type: 'relationship', relationTo: 'packagingUnits', admin: hidden },
  { name: 'discountCents', type: 'number', admin: hidden },
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
      'Les devis catering : créés depuis une demande de catering, envoyés au client par e-mail, signés en ligne.',
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
    {
      // A catering quotation (typed lines) or a B2B one (catalogue lines priced by quote, M3.2).
      name: 'kind',
      type: 'select',
      defaultValue: 'catering',
      options: [
        { value: 'catering', label: l('Services Catering', 'Catering Services', 'Catering-Services', 'Serviços de Catering') },
        { value: 'b2b', label: l('Professionnel', 'Business', 'Geschäftskunde', 'Profissional') },
      ],
      admin: hidden,
    },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda'), admin: readOnly },
    { name: 'cateringRequest', type: 'relationship', relationTo: 'cateringRequests', index: true, label: l('Demande de catering', 'Catering request', 'Catering-Anfrage', 'Pedido de catering'), admin: readOnly },
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
    { name: 'kind', type: 'select', required: true, options: ['quotation', 'quotation_signed', 'invoice', 'credit_note', 'delivery_note'] },
    { name: 'filename', type: 'text', required: true },
    { name: 'quotation', type: 'relationship', relationTo: 'quotations', index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Client', 'Customer', 'Kunde', 'Cliente') },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda') },
    { name: 'sizeBytes', type: 'number' },
    { name: 'sha256', type: 'text' },
    // Base64 of the PDF (about 110 KB for a quotation with the logo); 12 MB keeps a document under MongoDB's 16 MB.
    { name: 'data', type: 'text', required: true, maxLength: 12 * 1024 * 1024, access: { read: () => false } },
  ],
};


/** Staff who may open a quotation's PDF before it is sent (preview). */
export const canPreview = isStaff('sales');

// ---- Invoices, credit notes, delivery notes (M3.2 T5) -----------------------------------------------------------

export const INVOICE_STATUS: Record<string, Label> = {
  issued: l('Émise', 'Issued', 'Ausgestellt', 'Emitida'),
  paid: l('Payée', 'Paid', 'Bezahlt', 'Paga'),
  partly_credited: l('Avoir partiel', 'Partly credited', 'Teilweise gutgeschrieben', 'Creditada em parte'),
  credited: l('Annulée par avoir', 'Credited', 'Gutgeschrieben', 'Creditada'),
};
export const INVOICE_TONES = { issued: 'info', paid: 'success', partly_credited: 'warning', credited: 'neutral' } as const;

const billing = (): Field => ({
  name: 'billing',
  type: 'group',
  label: l('Client', 'Customer', 'Kunde', 'Cliente'),
  fields: [
    { name: 'name', type: 'text', label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
    { name: 'company', type: 'text', label: l('Société', 'Company', 'Firma', 'Empresa'), admin: { width: '50%' } },
    { name: 'vatNumber', type: 'text', label: l('N° TVA', 'VAT number', 'USt-IdNr.', 'N.º IVA'), admin: { width: '50%' } },
    { name: 'email', type: 'text', label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail'), admin: { width: '50%' } },
    { name: 'phone', type: 'text', label: l('Téléphone', 'Phone', 'Telefon', 'Telefone'), admin: { width: '50%' } },
    { name: 'address', type: 'textarea', label: l('Adresse', 'Address', 'Adresse', 'Morada') },
  ],
});
const eur = (width: string) => ({ width, components: scaledNumber('€') });
const docLines = (): Field => ({
  name: 'lines',
  type: 'array',
  label: l('Lignes', 'Lines', 'Zeilen', 'Linhas'),
  fields: [
    { name: 'name', type: 'text', required: true, label: l('Désignation', 'Description', 'Bezeichnung', 'Designação'), admin: { width: '40%' } },
    { name: 'qty', type: 'number', required: true, label: l('Quantité', 'Quantity', 'Menge', 'Quantidade'), admin: { width: '12%' } },
    { name: 'unitPriceCents', type: 'number', label: l('Prix unitaire', 'Unit price', 'Stückpreis', 'Preço unitário'), admin: eur('16%') },
    { name: 'vatBp', type: 'number', label: l('TVA', 'VAT', 'MwSt.', 'IVA'), admin: { width: '12%', components: scaledNumber('%') } },
    { name: 'totalCents', type: 'number', label: l('Total', 'Total', 'Summe', 'Total'), admin: eur('20%') },
    { name: 'detail', type: 'text', label: l('Détail', 'Details', 'Details', 'Detalhe') },
    { name: 'discountCents', type: 'number', defaultValue: 0, admin: hidden },
    { name: 'variant', type: 'relationship', relationTo: 'variants', admin: hidden },
    { name: 'unit', type: 'relationship', relationTo: 'packagingUnits', admin: hidden },
  ],
});
const docTotals = (): Field => ({
  name: 'totals',
  type: 'group',
  label: l('Total TTC', 'Total incl. VAT', 'Summe inkl. MwSt.', 'Total c/ IVA'),
  admin: { components: { Cell: '@/modules/documents/admin/cells#TotalCell' } },
  fields: [
    { name: 'subtotalCents', type: 'number', label: l('Sous-total', 'Subtotal', 'Zwischensumme', 'Subtotal'), admin: eur('25%') },
    { name: 'discountCents', type: 'number', label: l('Remises', 'Discounts', 'Rabatte', 'Descontos'), admin: eur('25%') },
    { name: 'deliveryCents', type: 'number', label: l('Livraison', 'Delivery', 'Lieferung', 'Entrega'), admin: eur('25%') },
    { name: 'totalCents', type: 'number', label: l('Total TTC', 'Total incl. VAT', 'Summe inkl. MwSt.', 'Total c/ IVA'), admin: eur('25%') },
    { name: 'vatCents', type: 'number', label: l('Dont TVA', 'Of which VAT', 'Davon MwSt.', 'Dos quais IVA'), admin: eur('25%') },
    {
      name: 'vatBreakdown',
      type: 'array',
      label: l('TVA par taux', 'VAT per rate', 'MwSt. je Satz', 'IVA por taxa'),
      fields: [
        { name: 'rateBp', type: 'number', label: l('Taux', 'Rate', 'Satz', 'Taxa'), admin: { width: '33%', components: scaledNumber('%') } },
        { name: 'baseCents', type: 'number', label: l('Base HT', 'Net', 'Netto', 'Base s/ IVA'), admin: eur('33%') },
        { name: 'vatCents', type: 'number', label: l('TVA', 'VAT', 'MwSt.', 'IVA'), admin: eur('33%') },
      ],
    },
  ],
});

/** Once issued, only these move (the payment, a credit note): every other field stays as printed, for every role. */
const frozen =
  (allowed: string[]): CollectionBeforeChangeHook =>
  ({ data, originalDoc, operation, req }) => {
    if (operation !== 'update' || !originalDoc) return data;
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key) || ['updatedAt', 'createdAt', 'id', '_id'].includes(key)) continue;
      if (JSON.stringify(value) !== JSON.stringify((originalDoc as Record<string, unknown>)[key])) {
        throw new Error(say(req, l('Un document émis ne se modifie pas : faites un avoir.', 'An issued document cannot be changed: issue a credit note.', 'Ein ausgestelltes Dokument wird nicht geändert: erstellen Sie eine Gutschrift.', 'Um documento emitido não se altera: emita uma nota de crédito.')));
      }
    }
    return data;
  };

const docAdmin = (description: Label) => ({
  useAsTitle: 'title',
  hidden: hiddenUnless('sales', 'manager'),
  listSearchableFields: ['number', 'title', 'billing.name', 'billing.company'],
  description,
});
const number = (): Field => ({ name: 'number', type: 'text', required: true, unique: true, index: true, label: l('Numéro', 'Number', 'Nummer', 'Número') });
const title = (): Field => ({ name: 'title', type: 'text', label: l('Titre', 'Title', 'Titel', 'Título'), admin: hidden });
const locale = (): Field => ({ name: 'locale', type: 'text', defaultValue: 'fr', admin: hidden });
const pdf = (): Field => ({ name: 'pdf', type: 'relationship', relationTo: 'documentFiles', admin: hidden });

/** Invoices (R5): numbered without gaps at issue (service.ts), from the order as sold; immutable but for the payment. */
export const invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: l('Facture', 'Invoice', 'Rechnung', 'Fatura'), plural: l('Factures', 'Invoices', 'Rechnungen', 'Faturas') },
  admin: {
    ...docAdmin(l('Émises depuis une commande (bouton « Émettre la facture »). Une facture ne se modifie pas : pour corriger, faites un avoir.', 'Issued from an order (“Issue invoice”). An invoice is never edited: to correct one, issue a credit note.', 'Aus einer Bestellung ausgestellt („Rechnung ausstellen“). Eine Rechnung wird nie geändert: zur Korrektur eine Gutschrift.', 'Emitidas a partir de uma encomenda («Emitir fatura»). Uma fatura não se altera: para corrigir, emita uma nota de crédito.')),
    defaultColumns: ['number', 'customer', 'issuedAt', 'dueAt', 'totals', 'status'],
    components: { beforeList: ['@/modules/documents/admin/document-actions#AccountingExport'], edit: { beforeDocumentControls: ['@/modules/documents/admin/document-actions#InvoiceActions'] } },
  },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  hooks: { beforeChange: [frozen(['status', 'paidAt', 'creditedCents'])] },
  defaultSort: '-issuedAt',
  fields: [
    number(),
    title(),
    { name: 'status', type: 'select', required: true, defaultValue: 'issued', index: true, options: options(INVOICE_STATUS), label: l('Statut', 'Status', 'Status', 'Estado'), admin: { components: badgeCell(INVOICE_TONES) } },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda') },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Client', 'Customer', 'Kunde', 'Cliente') },
    billing(),
    docLines(),
    docTotals(),
    { name: 'paidBeforeCents', type: 'number', defaultValue: 0, admin: hidden },
    { name: 'amountDueCents', type: 'number', admin: hidden },
    { name: 'creditedCents', type: 'number', defaultValue: 0, admin: hidden },
    { name: 'issuedAt', type: 'date', required: true, index: true, label: l('Émise le', 'Issued on', 'Ausgestellt am', 'Emitida a') },
    { name: 'dueAt', type: 'date', label: l('Échéance', 'Due', 'Fällig', 'Vencimento') },
    { name: 'paidAt', type: 'date', label: l('Payée le', 'Paid on', 'Bezahlt am', 'Paga a') },
    locale(),
    pdf(),
  ],
};

/** Credit notes (R5): their own series (AV), against one invoice, never more than it still holds. */
export const creditNotes: CollectionConfig = {
  slug: 'creditNotes',
  labels: { singular: l('Avoir', 'Credit note', 'Gutschrift', 'Nota de crédito'), plural: l('Avoirs', 'Credit notes', 'Gutschriften', 'Notas de crédito') },
  admin: { ...docAdmin(l('Un avoir annule tout ou partie d’une facture (remboursement, retour). Il se fait depuis la facture.', 'A credit note cancels all or part of an invoice (refund, return). It is made from the invoice.', 'Eine Gutschrift storniert eine Rechnung ganz oder teilweise. Sie wird aus der Rechnung erstellt.', 'Uma nota de crédito anula toda ou parte de uma fatura. Faz-se a partir da fatura.')), defaultColumns: ['number', 'customer', 'issuedAt', 'totals', 'reason'] },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  hooks: { beforeChange: [frozen([])] },
  defaultSort: '-issuedAt',
  fields: [
    number(),
    title(),
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true, label: l('Facture', 'Invoice', 'Rechnung', 'Fatura') },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda') },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Client', 'Customer', 'Kunde', 'Cliente') },
    { name: 'reason', type: 'text', required: true, label: l('Raison', 'Reason', 'Grund', 'Motivo') },
    billing(),
    docLines(),
    docTotals(),
    { name: 'issuedAt', type: 'date', required: true, label: l('Émis le', 'Issued on', 'Ausgestellt am', 'Emitida a') },
    locale(),
    pdf(),
  ],
};

/** Delivery notes (R5): what leaves with the customer or the driver, without prices, numbered (BL). */
export const deliveryNotes: CollectionConfig = {
  slug: 'deliveryNotes',
  labels: { singular: l('Bon de livraison', 'Delivery note', 'Lieferschein', 'Guia de remessa'), plural: l('Bons de livraison', 'Delivery notes', 'Lieferscheine', 'Guias de remessa') },
  admin: { ...docAdmin(l('Émis depuis une commande (bouton « Bon de livraison »). Sans prix.', 'Issued from an order (“Delivery note”). No prices.', 'Aus einer Bestellung ausgestellt („Lieferschein“). Ohne Preise.', 'Emitida a partir de uma encomenda («Guia de remessa»). Sem preços.')), defaultColumns: ['number', 'customer', 'issuedAt'] },
  access: { read: staffOrSelf('customer'), create: none, update: none, delete: none },
  hooks: { beforeChange: [frozen(['deliveredAt', 'signature'])] },
  defaultSort: '-issuedAt',
  fields: [
    number(),
    title(),
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda') },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: l('Client', 'Customer', 'Kunde', 'Cliente') },
    billing(),
    docLines(),
    { name: 'issuedAt', type: 'date', required: true, label: l('Émis le', 'Issued on', 'Ausgestellt am', 'Emitida a') },
    { name: 'deliveredAt', type: 'date', label: l('Livré le', 'Delivered on', 'Geliefert am', 'Entregue em') },
    { name: 'signature', type: 'text', label: l('Reçu par', 'Received by', 'Empfangen von', 'Recebido por') },
    locale(),
    pdf(),
  ],
};

export const documentCollections = [quotations, documentFiles, invoices, creditNotes, deliveryNotes];
