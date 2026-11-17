import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload';
import { hasRole, hiddenUnless, isStaff } from '@/lib/access';
import { addButton, badgeCell, emptyList, l, type Label, scaledNumber, say } from '@/lib/admin';
import { formatNumber, nextNumber } from '@/lib/numbering';
import { today } from '@/lib/time';
import { txOf } from '@/lib/tx';
import { NUMBERING } from '@/modules/settings/globals';

// Purchasing (04 §5, M3.1 T4): suppliers, what each sells at which cost, and purchase orders. Created and edited in
// the admin (law 1); goods come in only through `receive()` (service.ts), which posts the stock movements.

const roles = isStaff('manager', 'stock');
const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { id: string }).id : (v as string | null | undefined));

export const PO_STATUSES = ['draft', 'ordered', 'partly_received', 'received', 'cancelled'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_STATUS_LABELS: Record<PoStatus, Label> = {
  draft: l('Brouillon', 'Draft', 'Entwurf', 'Rascunho'),
  ordered: l('Commandé', 'Ordered', 'Bestellt', 'Encomendado'),
  partly_received: l('Reçu en partie', 'Partly received', 'Teilweise erhalten', 'Recebido em parte'),
  received: l('Reçu', 'Received', 'Erhalten', 'Recebido'),
  cancelled: l('Annulé', 'Cancelled', 'Storniert', 'Cancelado'),
};

/** What staff may set by hand in the admin; "partly received" and "received" come only from receiving goods. */
const BY_HAND: Record<PoStatus, PoStatus[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['cancelled'],
  partly_received: [],
  received: [],
  cancelled: [],
};

const supplierLabel = l('Fournisseur', 'Supplier', 'Lieferant', 'Fornecedor');
const sizeLabel = l('Format', 'Size', 'Format', 'Formato');
const boxLabel = l('Carton (facultatif)', 'Box (optional)', 'Karton (optional)', 'Caixa (opcional)');

export const suppliers: CollectionConfig = {
  slug: 'suppliers',
  labels: { singular: supplierLabel, plural: l('Fournisseurs', 'Suppliers', 'Lieferanten', 'Fornecedores') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'contact', 'email', 'phone'],
    listSearchableFields: ['name', 'contact', 'email'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Les maisons et grossistes chez qui la boutique achète, avec leurs prix par article.',
      'The houses and wholesalers the shop buys from, with their price per item.',
      'Die Häuser und Großhändler, bei denen der Laden einkauft, mit ihren Preisen pro Artikel.',
      'As casas e grossistas a quem a loja compra, com os preços por artigo.',
    ),
    components: addButton('suppliers', l('Ajouter un fournisseur', 'Add a supplier', 'Lieferant hinzufügen', 'Adicionar um fornecedor')),
  },
  access: { read: roles, create: roles, update: roles, delete: isStaff('manager') },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
        { name: 'contact', type: 'text', label: l('Contact', 'Contact', 'Kontakt', 'Contacto'), admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail'), admin: { width: '50%' } },
        { name: 'phone', type: 'text', label: l('Téléphone', 'Phone', 'Telefon', 'Telefone'), admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'vatNumber', type: 'text', label: l('N° TVA', 'VAT number', 'USt-IdNr.', 'N.º IVA'), admin: { width: '50%' } },
        { name: 'paymentTerm', type: 'text', label: l('Conditions de paiement', 'Payment terms', 'Zahlungsbedingungen', 'Condições de pagamento'), admin: { width: '50%', placeholder: '30 jours' } },
      ],
    },
    { name: 'notes', type: 'textarea', label: l('Notes', 'Notes', 'Notizen', 'Notas') },
    {
      name: 'products',
      type: 'join',
      collection: 'supplierProducts',
      on: 'supplier',
      label: l('Articles et prix d’achat', 'Items and purchase prices', 'Artikel und Einkaufspreise', 'Artigos e preços de compra'),
      admin: { defaultColumns: ['variant', 'unit', 'supplierRef', 'costCents', 'leadDays'] },
    },
  ],
};

export const supplierProducts: CollectionConfig = {
  slug: 'supplierProducts',
  labels: { singular: l('Prix d’achat', 'Purchase price', 'Einkaufspreis', 'Preço de compra'), plural: l('Prix d’achat', 'Purchase prices', 'Einkaufspreise', 'Preços de compra') },
  admin: {
    defaultColumns: ['variant', 'supplier', 'unit', 'supplierRef', 'costCents', 'leadDays'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Ce que coûte un article chez un fournisseur, à la bouteille ou au carton. La liste de réapprovisionnement choisit le moins cher.',
      'What an item costs at a supplier, per bottle or per box. The reorder list picks the cheapest.',
      'Was ein Artikel bei einem Lieferanten kostet, pro Flasche oder Karton. Die Nachbestellliste wählt den günstigsten.',
      'Quanto custa um artigo num fornecedor, à garrafa ou à caixa. A lista de reposição escolhe o mais barato.',
    ),
  },
  access: { read: roles, create: roles, update: roles, delete: roles },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const variant = idOf(data.variant ?? originalDoc?.variant);
        const unit = idOf(data.unit === undefined ? originalDoc?.unit : data.unit);
        if (unit) await assertUnitOf(req, variant, unit);
        return data;
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'supplier', type: 'relationship', relationTo: 'suppliers', required: true, index: true, label: supplierLabel, admin: { width: '50%' } },
        { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, index: true, label: sizeLabel, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'unit',
          type: 'relationship',
          relationTo: 'packagingUnits',
          label: boxLabel,
          admin: { width: '50%', description: l('Vide : vendu à la bouteille.', 'Empty: sold per bottle.', 'Leer: pro Flasche.', 'Vazio: vendido à garrafa.') },
        },
        { name: 'supplierRef', type: 'text', label: l('Référence fournisseur', 'Supplier reference', 'Lieferantenreferenz', 'Referência do fornecedor'), admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'costCents',
          type: 'number',
          required: true,
          min: 0,
          label: l('Prix d’achat HT (par bouteille ou carton)', 'Purchase price excl. VAT (per bottle or box)', 'Einkaufspreis netto (pro Flasche oder Karton)', 'Preço de compra s/ IVA (por garrafa ou caixa)'),
          admin: { width: '50%', components: scaledNumber('€') },
        },
        { name: 'leadDays', type: 'number', min: 0, label: l('Délai de livraison (jours)', 'Delivery time (days)', 'Lieferzeit (Tage)', 'Prazo de entrega (dias)'), admin: { width: '50%' } },
      ],
    },
  ],
  custom: { indexes: [{ fields: { supplier: 1, variant: 1, unit: 1 }, options: { unique: true } }] },
};

/** A box chosen for a size must be one of that size's boxes (no filterOptions: see stockCounts in inventory). */
async function assertUnitOf(req: Parameters<CollectionBeforeChangeHook>[0]['req'], variant: string | null | undefined, unit: string) {
  const doc = await req.payload.findByID({ collection: 'packagingUnits', id: unit, depth: 0, req, overrideAccess: true, disableErrors: true });
  if (!doc || idOf(doc.variant) !== variant) throw new APIError(say(req, l('Ce carton n’appartient pas à ce format.', 'This box does not belong to this size.', 'Dieser Karton gehört nicht zu diesem Format.', 'Esta caixa não pertence a este formato.')), 400, null, true);
}

type PoLine = { id?: string | null; variant?: unknown; unit?: unknown; unitQty?: number | null; costCents?: number | null; receivedUnitQty?: number | null };

/**
 * Saving a purchase order in the admin: only the moves of BY_HAND (receiving is the service's job, `context.byReceive`);
 * lines are frozen once goods came in; quantities already received are kept; a box must belong to its size; an empty
 * cost takes the supplier's price; the number is given (gapless, in the save's transaction) when it leaves draft.
 */
const beforePoChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  const before = (originalDoc?.status ?? 'draft') as PoStatus;
  const after = (data.status ?? before) as PoStatus;
  if (!context.byReceive) {
    if (operation === 'create' && after !== 'draft' && after !== 'ordered') throw new APIError(say(req, STATUS_REFUSED), 400, null, true);
    if (operation === 'update' && after !== before && !BY_HAND[before].includes(after)) throw new APIError(say(req, STATUS_REFUSED), 400, null, true);
    if (operation === 'update' && ['partly_received', 'received', 'cancelled'].includes(before) && data.lines) {
      const was = JSON.stringify((originalDoc?.lines ?? []).map((x: PoLine) => [idOf(x.variant), idOf(x.unit), x.unitQty, x.costCents]));
      const now = JSON.stringify((data.lines as PoLine[]).map((x) => [idOf(x.variant), idOf(x.unit), x.unitQty, x.costCents]));
      if (was !== now) throw new APIError(say(req, LINES_FROZEN), 400, null, true);
    }
    if (after === 'cancelled' && (originalDoc?.lines ?? []).some((x: PoLine) => (x.receivedUnitQty ?? 0) > 0)) throw new APIError(say(req, STATUS_REFUSED), 400, null, true);
    // Received quantities belong to the receipts, never to the form.
    const received = new Map<string, number>((originalDoc?.lines ?? []).map((x: PoLine) => [String(x.id), x.receivedUnitQty ?? 0]));
    if (data.lines) data.lines = (data.lines as PoLine[]).map((x) => ({ ...x, receivedUnitQty: x.id ? (received.get(String(x.id)) ?? 0) : 0 }));
  }

  const supplier = idOf(data.supplier ?? originalDoc?.supplier);
  for (const line of (data.lines ?? []) as PoLine[]) {
    const variant = idOf(line.variant);
    const unit = idOf(line.unit);
    if (unit) await assertUnitOf(req, variant, unit);
    if (line.costCents == null && supplier && variant) {
      const { docs } = await req.payload.find({ collection: 'supplierProducts', where: { supplier: { equals: supplier }, variant: { equals: variant }, unit: unit ? { equals: unit } : { exists: false } }, limit: 1, pagination: false, depth: 0, req, overrideAccess: true });
      if (docs[0]) line.costCents = docs[0].costCents;
    }
  }

  if (after !== 'draft' && !originalDoc?.number && !data.number) {
    const year = Number(today().slice(0, 4));
    const settings = await req.payload.findGlobal({ slug: 'BusinessSettings', depth: 0, req, overrideAccess: true });
    const n = await nextNumber(txOf(req), 'purchase', year);
    data.number = formatNumber(settings.numbering?.purchase ?? NUMBERING.purchase, year, n);
  }
  const name = supplier ? (await req.payload.findByID({ collection: 'suppliers', id: supplier, depth: 0, req, overrideAccess: true, disableErrors: true }))?.name : null;
  data.title = [data.number ?? originalDoc?.number ?? say(req, PO_STATUS_LABELS.draft), name].filter(Boolean).join(' · ');
  return data;
};

const STATUS_REFUSED = l(
  'Ce changement de statut n’est pas possible ici. « Reçu » se fait en réceptionnant la marchandise ; une commande déjà reçue en partie ne peut plus être annulée.',
  'This status change is not possible here. “Received” comes from receiving the goods; an order partly received can no longer be cancelled.',
  'Diese Statusänderung ist hier nicht möglich. „Erhalten“ entsteht beim Wareneingang; eine teilweise erhaltene Bestellung kann nicht mehr storniert werden.',
  'Esta mudança de estado não é possível aqui. «Recebido» resulta da receção da mercadoria; uma encomenda recebida em parte já não pode ser cancelada.',
);
const LINES_FROZEN = l(
  'Les lignes d’une commande reçue ou annulée ne peuvent plus être modifiées.',
  'The lines of a received or cancelled order can no longer be changed.',
  'Die Zeilen einer erhaltenen oder stornierten Bestellung können nicht mehr geändert werden.',
  'As linhas de uma encomenda recebida ou cancelada já não podem ser alteradas.',
);

export const purchaseOrders: CollectionConfig = {
  slug: 'purchaseOrders',
  labels: { singular: l('Commande fournisseur', 'Purchase order', 'Lieferantenbestellung', 'Encomenda a fornecedor'), plural: l('Commandes fournisseurs', 'Purchase orders', 'Lieferantenbestellungen', 'Encomendas a fornecedores') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'expectedAt', 'updatedAt'],
    listSearchableFields: ['title', 'number'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Ce qui est commandé aux fournisseurs. Passez-la en « Commandé » pour lui donner un numéro ; la réception se fait sur le téléphone (Équipe › Réception).',
      'What is ordered from suppliers. Set it to “Ordered” to give it a number; goods are received on the phone (Team › Receive).',
      'Was bei Lieferanten bestellt wird. Auf „Bestellt“ setzen, um eine Nummer zu vergeben; der Wareneingang erfolgt am Telefon (Team › Wareneingang).',
      'O que é encomendado aos fornecedores. Passe a «Encomendado» para lhe dar um número; a receção faz-se no telemóvel (Equipa › Receção).',
    ),
    components: {
      ...addButton('purchaseOrders', l('Nouvelle commande fournisseur', 'New purchase order', 'Neue Lieferantenbestellung', 'Nova encomenda a fornecedor')),
      ...emptyList({
        icon: 'orders',
        title: l('Aucune commande fournisseur', 'No purchase orders yet', 'Noch keine Lieferantenbestellungen', 'Ainda sem encomendas a fornecedores'),
        text: l(
          'Créez-en une ici, ou depuis la liste de réapprovisionnement, qui propose les quantités à commander.',
          'Create one here, or from the reorder list, which suggests the quantities to order.',
          'Legen Sie hier eine an, oder aus der Nachbestellliste, die die Mengen vorschlägt.',
          'Crie uma aqui, ou a partir da lista de reposição, que sugere as quantidades.',
        ),
        action: l('Nouvelle commande fournisseur', 'New purchase order', 'Neue Lieferantenbestellung', 'Nova encomenda a fornecedor'),
      }),
    },
  },
  access: {
    read: roles,
    create: roles,
    update: roles,
    delete: ({ req }) => hasRole(req.user, ['manager']) && { status: { equals: 'draft' } },
  },
  defaultSort: '-updatedAt',
  hooks: { beforeChange: [beforePoChange] },
  custom: {
    indexes: [
      { fields: { status: 1, expectedAt: 1 } },
      // Drafts have no number yet: uniqueness applies to the numbered ones only.
      { fields: { number: 1 }, options: { unique: true, partialFilterExpression: { number: { $type: 'string' } } } },
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: l('Commande', 'Order', 'Bestellung', 'Encomenda'), admin: { hidden: true } },
    { name: 'number', type: 'text', label: l('Numéro', 'Number', 'Nummer', 'Número'), access: { create: () => false, update: () => false }, admin: { readOnly: true, condition: (data) => Boolean(data?.number) } },
    {
      type: 'row',
      fields: [
        { name: 'supplier', type: 'relationship', relationTo: 'suppliers', required: true, index: true, label: supplierLabel, admin: { width: '50%' } },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          label: l('Statut', 'Status', 'Status', 'Estado'),
          options: PO_STATUSES.map((value) => ({ value, label: PO_STATUS_LABELS[value] })),
          admin: { width: '25%', isClearable: false, components: badgeCell({ draft: 'neutral', ordered: 'info', partly_received: 'warning', received: 'success', cancelled: 'danger' }) },
        },
        { name: 'expectedAt', type: 'date', label: l('Livraison prévue', 'Expected delivery', 'Erwartete Lieferung', 'Entrega prevista'), admin: { width: '25%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } } },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      label: l('Articles commandés', 'Items ordered', 'Bestellte Artikel', 'Artigos encomendados'),
      labels: { singular: l('Article', 'Item', 'Artikel', 'Artigo'), plural: l('Articles', 'Items', 'Artikel', 'Artigos') },
      admin: {
        description: l(
          'Quantité en cartons quand un carton est choisi, sinon en bouteilles. Prix vide : le prix du fournisseur.',
          'Quantity in boxes when a box is chosen, otherwise in bottles. Empty price: the supplier’s price.',
          'Menge in Kartons, wenn ein Karton gewählt ist, sonst in Flaschen. Leerer Preis: der Lieferantenpreis.',
          'Quantidade em caixas quando uma caixa é escolhida, senão em garrafas. Preço vazio: o preço do fornecedor.',
        ),
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, label: sizeLabel, admin: { width: '40%' } },
            { name: 'unit', type: 'relationship', relationTo: 'packagingUnits', label: boxLabel, admin: { width: '30%' } },
            { name: 'unitQty', type: 'number', required: true, min: 1, label: l('Quantité', 'Quantity', 'Menge', 'Quantidade'), admin: { width: '30%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'costCents', type: 'number', min: 0, label: l('Prix d’achat HT', 'Purchase price excl. VAT', 'Einkaufspreis netto', 'Preço de compra s/ IVA'), admin: { width: '50%', components: scaledNumber('€') } },
            {
              name: 'receivedUnitQty',
              type: 'number',
              defaultValue: 0,
              label: l('Déjà reçu', 'Already received', 'Bereits erhalten', 'Já recebido'),
              access: { create: () => false, update: () => false },
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
      ],
    },
    { name: 'notes', type: 'textarea', label: l('Notes', 'Notes', 'Notizen', 'Notas') },
  ],
};

export const purchasingCollections = [suppliers, supplierProducts, purchaseOrders];
