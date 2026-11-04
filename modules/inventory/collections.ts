import type { CollectionConfig } from 'payload';
import { hasRole, hiddenUnless, isStaff, none } from '@/lib/access';
import { badgeCell, createInDrawer, emptyList, l, openAsPage, signedCell } from '@/lib/admin';
import { TYPE_LABELS } from './labels';

// The stock ledger (02 §5.1). Levels and movements have no write access through the API: only postMovements
// (service.ts) writes them, inside a transaction.

export const MOVEMENT_TYPES = ['sale', 'return', 'cancel', 'adjustment', 'count', 'receipt', 'pos_import'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_CHANNELS = ['webshop', 'mobile', 'pos', 'backoffice'] as const;
export type MovementChannel = (typeof MOVEMENT_CHANNELS)[number];

const stockRoles = isStaff('manager', 'stock');

export const stockLevels: CollectionConfig = {
  slug: 'stockLevels',
  labels: { singular: l('Niveau de stock', 'Stock level', 'Lagerbestand', 'Nível de stock'), plural: l('État du stock', 'Stock levels', 'Lagerbestand', 'Níveis de stock') },
  admin: {
    defaultColumns: ['variant', 'onHand', 'lowStockThreshold', 'updatedAt'],
    custom: openAsPage,
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Les quantités en stock, calculées à partir de l’historique. Pour corriger un stock, ouvrez le format et utilisez « Corriger le stock ».',
      'Quantities in stock, computed from the history. To correct stock, open the size and use “Correct stock”.',
      'Bestände, aus dem Verlauf berechnet. Zum Korrigieren öffnen Sie das Format und nutzen „Bestand korrigieren“.',
      'Quantidades em stock, calculadas a partir do histórico. Para corrigir, abra o formato e use «Corrigir stock».',
    ),
    components: emptyList({
      icon: 'lowStock',
      evenFiltered: true,
      title: l('Rien en stock bas', 'Nothing is low on stock', 'Nichts mit niedrigem Bestand', 'Nada com stock baixo'),
      text: l(
        'Aucun article n’a atteint son seuil d’alerte. Les articles y apparaîtront dès qu’il faudra recommander.',
        'No item has reached its alert level. Items appear here as soon as it is time to reorder.',
        'Kein Artikel hat seine Warnschwelle erreicht. Artikel erscheinen hier, sobald nachbestellt werden muss.',
        'Nenhum artigo atingiu o nível de alerta. Os artigos aparecem aqui assim que for preciso encomendar.',
      ),
    }),
  },
  access: { read: isStaff(), create: none, update: none, delete: none },
  defaultSort: 'onHand',
  fields: [
    { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, unique: true, label: l('Format', 'Size', 'Format', 'Formato') },
    {
      name: 'onHand',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: l('En stock', 'In stock', 'Auf Lager', 'Em stock'),
      admin: { components: { Cell: '@/modules/inventory/admin/cells#StockCell' } },
    },
    {
      name: 'lowStockThreshold',
      type: 'number',
      min: 0,
      label: l('Alerte à partir de', 'Alert at', 'Warnung ab', 'Alerta a partir de'),
      admin: {
        description: l('Vide : la valeur par défaut des réglages.', 'Empty: the default from the settings.', 'Leer: Standardwert der Einstellungen.', 'Vazio: o valor padrão das definições.'),
        components: { Cell: '@/modules/inventory/admin/cells#ThresholdCell' },
      },
    },
    { name: 'lowStock', type: 'checkbox', defaultValue: false, index: true, label: l('Stock bas', 'Low stock', 'Niedriger Bestand', 'Stock baixo') },
  ],
};

export const stockMovements: CollectionConfig = {
  slug: 'stockMovements',
  labels: { singular: l('Mouvement de stock', 'Stock movement', 'Lagerbewegung', 'Movimento de stock'), plural: l('Mouvements de stock', 'Stock movements', 'Lagerbewegungen', 'Movimentos de stock') },
  admin: {
    defaultColumns: ['createdAt', 'variant', 'type', 'qty', 'reason', 'user'],
    custom: openAsPage,
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Chaque entrée et sortie de stock, avec qui et pourquoi. Rien ne peut y être modifié ni supprimé.',
      'Every stock movement in and out, with who and why. Nothing here can be changed or deleted.',
      'Jede Lagerbewegung mit wer und warum. Hier kann nichts geändert oder gelöscht werden.',
      'Cada entrada e saída de stock, com quem e porquê. Nada aqui pode ser alterado ou apagado.',
    ),
    components: emptyList({
      icon: 'movements',
      title: l('Aucun mouvement pour l’instant', 'No movements yet', 'Noch keine Bewegungen', 'Ainda sem movimentos'),
      text: l(
        'Chaque vente, réception, correction ou inventaire s’inscrira ici, avec la date, la quantité, qui et pourquoi.',
        'Every sale, delivery, correction or count is recorded here, with the date, quantity, who and why.',
        'Jeder Verkauf, Wareneingang, jede Korrektur oder Inventur erscheint hier, mit Datum, Menge, wer und warum.',
        'Cada venda, receção, correção ou inventário fica registado aqui, com a data, a quantidade, quem e porquê.',
      ),
    }),
  },
  access: { read: stockRoles, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, index: true, label: l('Format', 'Size', 'Format', 'Formato') },
    { name: 'qty', type: 'number', required: true, label: l('Quantité (unités)', 'Quantity (units)', 'Menge (Einheiten)', 'Quantidade (unidades)'), admin: { components: signedCell } },
    { name: 'unit', type: 'relationship', relationTo: 'packagingUnits', label: l('Carton', 'Box', 'Karton', 'Caixa') },
    { name: 'unitQty', type: 'number', label: l('Nombre saisi', 'Number entered', 'Eingegebene Anzahl', 'Número introduzido') },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: l('Type', 'Type', 'Art', 'Tipo'),
      options: MOVEMENT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] })),
      admin: {
        components: badgeCell({ sale: 'info', pos_import: 'info', receipt: 'success', return: 'success', cancel: 'success', adjustment: 'warning', count: 'neutral' }),
      },
    },
    {
      name: 'reason',
      type: 'text',
      label: l('Raison', 'Reason', 'Grund', 'Motivo'),
      admin: { components: { Cell: '@/modules/inventory/admin/cells#ReasonCell' } },
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      label: l('Où', 'Where', 'Wo', 'Onde'),
      options: [
        { value: 'webshop', label: l('Boutique en ligne', 'Online shop', 'Onlineshop', 'Loja online') },
        { value: 'mobile', label: l('Vente mobile', 'Mobile sale', 'Mobiler Verkauf', 'Venda móvel') },
        { value: 'pos', label: l('Caisse', 'Till', 'Kasse', 'Caixa') },
        { value: 'backoffice', label: l('Espace gestion', 'Back office', 'Verwaltung', 'Gestão') },
      ],
    },
    // Orders, purchase orders and POS imports join this list when their milestones create them.
    { name: 'ref', type: 'relationship', relationTo: ['stockCounts'], label: l('Origine', 'Source', 'Ursprung', 'Origem') },
    { name: 'user', type: 'relationship', relationTo: 'users', label: l('Par', 'By', 'Von', 'Por') },
  ],
  custom: { indexes: [{ fields: { variant: 1, createdAt: -1 } }, { fields: { 'ref.value': 1 } }] },
};

export const stockCounts: CollectionConfig = {
  slug: 'stockCounts',
  labels: { singular: l('Inventaire', 'Stock count', 'Inventur', 'Inventário'), plural: l('Inventaires', 'Stock counts', 'Inventuren', 'Inventários') },
  admin: {
    useAsTitle: 'note',
    custom: openAsPage,
    defaultColumns: ['note', 'createdAt', 'lines', 'status', 'user', 'postedAt'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Comptez les bouteilles en rayon, saisissez les quantités, puis validez : le stock prend les quantités comptées.',
      'Count the bottles on the shelf, enter the quantities, then post: stock takes the counted quantities.',
      'Zählen Sie die Flaschen im Regal, geben Sie die Mengen ein und buchen Sie: der Bestand übernimmt die gezählten Mengen.',
      'Conte as garrafas na prateleira, introduza as quantidades e valide: o stock passa a ser o contado.',
    ),
    components: {
      ...createInDrawer('stockCounts', l('Nouvel inventaire', 'New stock count', 'Neue Inventur', 'Novo inventário')),
      ...emptyList({
        icon: 'counts',
        title: l('Aucun inventaire pour l’instant', 'No stock counts yet', 'Noch keine Inventuren', 'Ainda sem inventários'),
        text: l(
          'Comptez un rayon ou toute la cave : saisissez les quantités, validez, et le stock s’aligne sur ce que vous avez compté.',
          'Count a shelf or the whole cellar: enter the quantities, post, and stock matches what you counted.',
          'Zählen Sie ein Regal oder den ganzen Keller: Mengen eingeben, buchen, und der Bestand entspricht der Zählung.',
          'Conte uma prateleira ou a garrafeira inteira: introduza as quantidades, valide, e o stock fica igual ao contado.',
        ),
        action: l('Nouvel inventaire', 'New stock count', 'Neue Inventur', 'Novo inventário'),
      }),
    },
  },
  // A posted count is read-only: update and delete only match open counts.
  access: {
    read: stockRoles,
    create: stockRoles,
    update: ({ req }) => hasRole(req.user, ['manager', 'stock']) && { status: { equals: 'open' } },
    delete: ({ req }) => hasRole(req.user, ['manager', 'stock']) && { status: { equals: 'open' } },
  },
  defaultSort: '-createdAt',
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user?.collection === 'users') data.user = req.user.id;
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'postPanel',
      type: 'ui',
      admin: { condition: (_, __, { operation }) => operation === 'update', components: { Field: '@/modules/inventory/admin/post-count-button' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'note', type: 'text', label: l('Nom de l’inventaire', 'Name of the count', 'Name der Inventur', 'Nome do inventário'), admin: { width: '50%', placeholder: 'Cave, rayon Porto…' } },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'open',
          index: true,
          label: l('Statut', 'Status', 'Status', 'Estado'),
          options: [
            { value: 'open', label: l('En cours', 'In progress', 'Offen', 'Em curso') },
            { value: 'posted', label: l('Validé', 'Posted', 'Gebucht', 'Validado') },
          ],
          access: { create: () => false, update: () => false },
          admin: { width: '25%', readOnly: true, components: badgeCell({ open: 'warning', posted: 'success' }) },
        },
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          label: l('Créé par', 'Created by', 'Erstellt von', 'Criado por'),
          access: { update: () => false },
          // Filled when the count is saved: nothing to show on the "new count" page.
          admin: { width: '25%', readOnly: true, condition: (_, __, { operation }) => operation === 'update' },
        },
      ],
    },
    // Set when posting; shown in the posted banner and the list, not as a field to fill.
    {
      name: 'postedAt',
      type: 'date',
      label: l('Validé le', 'Posted on', 'Gebucht am', 'Validado em'),
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, condition: () => false },
    },
    {
      name: 'lines',
      type: 'array',
      label: l('Articles comptés', 'Items counted', 'Gezählte Artikel', 'Artigos contados'),
      labels: { singular: l('Article', 'Item', 'Artikel', 'Artigo'), plural: l('Articles', 'Items', 'Artikel', 'Artigos') },
      admin: {
        components: { RowLabel: '@/modules/inventory/admin/count-row-label' },
        description: l(
          'Un article par format compté. « Attendu » est rempli à la validation : le stock à ce moment-là.',
          'One line per size counted. “Expected” is filled in when posting: the stock at that moment.',
          'Eine Zeile pro gezähltem Format. „Erwartet“ wird beim Buchen ausgefüllt: der Bestand in diesem Moment.',
          'Uma linha por formato contado. «Esperado» é preenchido ao validar: o stock nesse momento.',
        ),
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'variant',
              type: 'relationship',
              relationTo: 'variants',
              required: true,
              label: l('Format', 'Size', 'Format', 'Formato'),
              // No filterOptions: Payload validates each row's filter in parallel on the create's transaction session,
              // which intermittently fails. Untracked sizes in a count are simply ignored by postMovements.
              admin: { width: '60%' },
            },
            { name: 'counted', type: 'number', required: true, min: 0, label: l('Compté', 'Counted', 'Gezählt', 'Contado'), admin: { width: '20%' } },
            {
              name: 'expected',
              type: 'number',
              label: l('Attendu', 'Expected', 'Erwartet', 'Esperado'),
              access: { create: () => false, update: () => false },
              admin: { width: '20%', readOnly: true, condition: (data) => data?.status === 'posted' },
            },
          ],
        },
      ],
    },
  ],
};

export const inventoryCollections = [stockLevels, stockMovements, stockCounts];
