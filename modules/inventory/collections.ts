import type { CollectionConfig } from 'payload';
import { hasRole, hiddenUnless, isStaff, none } from '@/lib/access';
import { createInDrawer, l } from '@/lib/admin';
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
  labels: { singular: l('Niveau de stock', 'Stock level', 'Lagerbestand', 'Nível de stock'), plural: l('Stock', 'Stock', 'Bestand', 'Stock') },
  admin: {
    defaultColumns: ['variant', 'onHand', 'lowStockThreshold', 'updatedAt'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Les quantités en stock, calculées à partir de l’historique. Pour corriger un stock, ouvrez le format et utilisez « Corriger le stock ».',
      'Quantities in stock, computed from the history. To correct stock, open the size and use “Correct stock”.',
      'Bestände, aus dem Verlauf berechnet. Zum Korrigieren öffnen Sie das Format und nutzen „Bestand korrigieren“.',
      'Quantidades em stock, calculadas a partir do histórico. Para corrigir, abra o formato e use «Corrigir stock».',
    ),
  },
  access: { read: isStaff(), create: none, update: none, delete: none },
  defaultSort: 'onHand',
  fields: [
    { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, unique: true, label: l('Format', 'Size', 'Format', 'Formato') },
    { name: 'onHand', type: 'number', required: true, defaultValue: 0, label: l('En stock', 'In stock', 'Auf Lager', 'Em stock') },
    {
      name: 'lowStockThreshold',
      type: 'number',
      min: 0,
      label: l('Alerte à partir de', 'Alert at', 'Warnung ab', 'Alerta a partir de'),
      admin: { description: l('Vide : la valeur par défaut des réglages.', 'Empty: the default from the settings.', 'Leer: Standardwert der Einstellungen.', 'Vazio: o valor padrão das definições.') },
    },
    { name: 'lowStock', type: 'checkbox', defaultValue: false, index: true, label: l('Stock bas', 'Low stock', 'Niedriger Bestand', 'Stock baixo') },
  ],
};

export const stockMovements: CollectionConfig = {
  slug: 'stockMovements',
  labels: { singular: l('Mouvement de stock', 'Stock movement', 'Lagerbewegung', 'Movimento de stock'), plural: l('Mouvements de stock', 'Stock movements', 'Lagerbewegungen', 'Movimentos de stock') },
  admin: {
    defaultColumns: ['createdAt', 'variant', 'type', 'qty', 'reason', 'user'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Chaque entrée et sortie de stock, avec qui et pourquoi. Rien ne peut y être modifié ni supprimé.',
      'Every stock movement in and out, with who and why. Nothing here can be changed or deleted.',
      'Jede Lagerbewegung mit wer und warum. Hier kann nichts geändert oder gelöscht werden.',
      'Cada entrada e saída de stock, com quem e porquê. Nada aqui pode ser alterado ou apagado.',
    ),
  },
  access: { read: stockRoles, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, index: true, label: l('Format', 'Size', 'Format', 'Formato') },
    { name: 'qty', type: 'number', required: true, label: l('Quantité (unités)', 'Quantity (units)', 'Menge (Einheiten)', 'Quantidade (unidades)') },
    { name: 'unit', type: 'relationship', relationTo: 'packagingUnits', label: l('Carton', 'Box', 'Karton', 'Caixa') },
    { name: 'unitQty', type: 'number', label: l('Nombre saisi', 'Number entered', 'Eingegebene Anzahl', 'Número introduzido') },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: l('Type', 'Type', 'Art', 'Tipo'),
      options: MOVEMENT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] })),
    },
    {
      name: 'reason',
      type: 'text',
      label: l('Raison', 'Reason', 'Grund', 'Motivo'),
      admin: { components: { Cell: '@/modules/inventory/admin/adjust-button#ReasonCell' } },
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
    defaultColumns: ['createdAt', 'note', 'status', 'user', 'postedAt'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Comptez les bouteilles en rayon, saisissez les quantités, puis validez : le stock prend les quantités comptées.',
      'Count the bottles on the shelf, enter the quantities, then post: stock takes the counted quantities.',
      'Zählen Sie die Flaschen im Regal, geben Sie die Mengen ein und buchen Sie: der Bestand übernimmt die gezählten Mengen.',
      'Conte as garrafas na prateleira, introduza as quantidades e valide: o stock passa a ser o contado.',
    ),
    components: createInDrawer('stockCounts', l('Nouvel inventaire', 'New stock count', 'Neue Inventur', 'Novo inventário')),
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
          admin: { width: '25%', readOnly: true },
        },
        {
          name: 'postedAt',
          type: 'date',
          label: l('Validé le', 'Posted on', 'Gebucht am', 'Validado em'),
          access: { create: () => false, update: () => false },
          admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      label: l('Articles comptés', 'Items counted', 'Gezählte Artikel', 'Artigos contados'),
      labels: { singular: l('Article', 'Item', 'Artikel', 'Artigo'), plural: l('Articles', 'Items', 'Artikel', 'Artigos') },
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
              admin: { width: '50%' },
            },
            { name: 'counted', type: 'number', required: true, min: 0, label: l('Compté', 'Counted', 'Gezählt', 'Contado'), admin: { width: '25%' } },
            {
              name: 'expected',
              type: 'number',
              label: l('Attendu', 'Expected', 'Erwartet', 'Esperado'),
              access: { create: () => false, update: () => false },
              admin: {
                width: '25%',
                readOnly: true,
                description: l('Le stock au moment de valider.', 'Stock at the moment of posting.', 'Bestand beim Buchen.', 'Stock no momento da validação.'),
              },
            },
          ],
        },
      ],
    },
    { name: 'user', type: 'relationship', relationTo: 'users', label: l('Créé par', 'Created by', 'Erstellt von', 'Criado por'), admin: { readOnly: true } },
  ],
};

export const inventoryCollections = [stockLevels, stockMovements, stockCounts];
