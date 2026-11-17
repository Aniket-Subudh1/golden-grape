import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type Field,
  type PayloadRequest,
} from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { addButton, boolCell, emptyList, l, type Label, scaledNumber, say } from '@/lib/admin';

// Prices beyond the catalogue (04 §5, M3.2 T1–T2): price lists for business customers (per bottle or per box), automatic
// promotions and discount codes. Edited in the admin (law 1); applied only by `quote` (pricing.ts), counted only by
// `redeem` in the order transaction.

const roles = isStaff('manager', 'sales');
const idOf = (v: unknown) =>
  typeof v === 'object' && v !== null ? (v as { id: string }).id : (v as string | null | undefined);

export const CHANNEL_LABELS: Record<'webshop' | 'mobile' | 'pos', Label> = {
  webshop: l('Site', 'Website', 'Website', 'Site'),
  mobile: l('Vente équipe (téléphone)', 'Staff sale (phone)', 'Teamverkauf (Handy)', 'Venda equipa (telemóvel)'),
  pos: l('Caisse', 'Till', 'Kasse', 'Caixa'),
};
const channels = (defaults: string[]): Field => ({
  name: 'channels',
  type: 'select',
  hasMany: true,
  required: true,
  defaultValue: defaults,
  options: (['webshop', 'mobile', 'pos'] as const).map((value) => ({ value, label: CHANNEL_LABELS[value] })),
  label: l('Où', 'Where', 'Wo', 'Onde'),
  admin: { width: '50%' },
});
const dates: Field = {
  type: 'row',
  fields: [
    {
      name: 'startsAt',
      type: 'date',
      label: l('Du', 'From', 'Von', 'De'),
      admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'endsAt',
      type: 'date',
      label: l('Au', 'Until', 'Bis', 'Até'),
      admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
};

/** A percentage (basis points) or an amount (cents, VAT included): the field shown follows the kind chosen. */
const amount: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'type',
        type: 'select',
        required: true,
        defaultValue: 'percent',
        options: [
          { value: 'percent', label: l('Pourcentage', 'Percentage', 'Prozent', 'Percentagem') },
          { value: 'fixed', label: l('Montant', 'Amount', 'Betrag', 'Montante') },
        ],
        label: l('Remise', 'Discount', 'Rabatt', 'Desconto'),
        admin: { width: '50%' },
      },
      {
        name: 'percentBp',
        type: 'number',
        min: 1,
        max: 10000,
        label: l('Pourcentage', 'Percentage', 'Prozent', 'Percentagem'),
        admin: { width: '50%', condition: (data) => data?.type !== 'fixed', components: scaledNumber('%') },
      },
      {
        name: 'amountCents',
        type: 'number',
        min: 1,
        label: l('Montant TTC', 'Amount incl. VAT', 'Betrag inkl. MwSt.', 'Montante c/ IVA'),
        admin: { width: '50%', condition: (data) => data?.type === 'fixed', components: scaledNumber('€') },
      },
    ],
  },
];

const needsValue: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const type = data.type ?? originalDoc?.type;
  const value =
    type === 'fixed' ? (data.amountCents ?? originalDoc?.amountCents) : (data.percentBp ?? originalDoc?.percentBp);
  if (!value)
    throw new APIError(
      say(
        req,
        l(
          'Indiquez le pourcentage ou le montant de la remise.',
          'Enter the discount percentage or amount.',
          'Geben Sie den Prozentsatz oder Betrag ein.',
          'Indique a percentagem ou o montante.',
        ),
      ),
      400,
      null,
      true,
    );
  return data;
};

/** A box chosen on a line must be one of that size's boxes; a size and box appear once per list. */
async function checkLines(req: PayloadRequest, lines: { variant?: unknown; unit?: unknown }[]) {
  const seen = new Set<string>();
  for (const line of lines) {
    const variant = idOf(line.variant);
    const unit = idOf(line.unit);
    const key = `${variant}:${unit ?? ''}`;
    if (seen.has(key))
      throw new APIError(
        say(
          req,
          l(
            'Ce format (ou ce carton) est déjà dans la liste.',
            'This size (or box) is already in the list.',
            'Dieses Format (oder dieser Karton) ist schon in der Liste.',
            'Este formato (ou caixa) já está na lista.',
          ),
        ),
        400,
        null,
        true,
      );
    seen.add(key);
    if (!unit) continue;
    const doc = await req.payload.findByID({
      collection: 'packagingUnits',
      id: unit,
      depth: 0,
      req,
      overrideAccess: true,
      disableErrors: true,
    });
    if (!doc || idOf(doc.variant) !== variant)
      throw new APIError(
        say(
          req,
          l(
            'Ce carton n’appartient pas à ce format.',
            'This box does not belong to this size.',
            'Dieser Karton gehört nicht zu diesem Format.',
            'Esta caixa não pertence a este formato.',
          ),
        ),
        400,
        null,
        true,
      );
  }
}

export const priceLists: CollectionConfig = {
  slug: 'priceLists',
  labels: {
    singular: l('Liste de prix', 'Price list', 'Preisliste', 'Lista de preços'),
    plural: l('Listes de prix', 'Price lists', 'Preislisten', 'Listas de preços'),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'pricesInclVat', 'validFrom', 'validTo', 'updatedAt'],
    hidden: hiddenUnless('manager', 'sales'),
    description: l(
      'Les prix négociés d’un client professionnel ou d’un groupe, à la bouteille ou au carton. Liez la liste au client (ou à son groupe) dans sa fiche.',
      'The negotiated prices of a business customer or a group, per bottle or per box. Link the list to the customer (or their group) on their page.',
      'Die ausgehandelten Preise eines Geschäftskunden oder einer Gruppe, pro Flasche oder Karton. Verknüpfen Sie die Liste mit dem Kunden (oder seiner Gruppe).',
      'Os preços negociados de um cliente profissional ou de um grupo, à garrafa ou à caixa. Ligue a lista ao cliente (ou ao grupo) na ficha.',
    ),
    components: {
      ...addButton('priceLists', l('Ajouter une liste', 'Add a list', 'Liste hinzufügen', 'Adicionar uma lista')),
      ...emptyList({
        icon: 'formats',
        title: l('Aucune liste de prix', 'No price lists', 'Keine Preislisten', 'Sem listas de preços'),
        text: l(
          'Créez une liste pour un client professionnel, puis liez-la à sa fiche.',
          'Create a list for a business customer, then link it on their page.',
          'Legen Sie eine Liste für einen Geschäftskunden an und verknüpfen Sie sie.',
          'Crie uma lista para um cliente profissional e ligue-a à ficha.',
        ),
        action: l('Ajouter une liste', 'Add a list', 'Liste hinzufügen', 'Adicionar uma lista'),
      }),
    },
  },
  access: { read: roles, create: roles, update: roles, delete: isStaff('manager') },
  hooks: { beforeChange: [async ({ data, req }) => (await checkLines(req, data.lines ?? []), data)] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: l('Nom', 'Name', 'Name', 'Nome'),
          admin: { width: '50%', placeholder: 'Restaurant Lisboa 2027' },
        },
        {
          name: 'pricesInclVat',
          type: 'checkbox',
          defaultValue: false,
          label: l('Prix TTC', 'Prices include VAT', 'Preise inkl. MwSt.', 'Preços com IVA'),
          admin: {
            width: '50%',
            description: l(
              'Décoché : prix HT, la TVA s’ajoute (habituel pour les professionnels).',
              'Unticked: prices excl. VAT, VAT is added (usual for businesses).',
              'Nicht angehakt: Nettopreise, MwSt. kommt hinzu (üblich für Firmen).',
              'Desmarcado: preços sem IVA, o IVA é somado (habitual para empresas).',
            ),
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'validFrom',
          type: 'date',
          label: l('Valable du', 'Valid from', 'Gültig ab', 'Válida de'),
          admin: { width: '50%' },
        },
        { name: 'validTo', type: 'date', label: l('au', 'until', 'bis', 'até'), admin: { width: '50%' } },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      label: l('Prix', 'Prices', 'Preise', 'Preços'),
      labels: { singular: l('Prix', 'Price', 'Preis', 'Preço'), plural: l('Prix', 'Prices', 'Preise', 'Preços') },
      admin: { initCollapsed: false },
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
              admin: { width: '40%' },
            },
            {
              name: 'unit',
              type: 'relationship',
              relationTo: 'packagingUnits',
              label: l('Carton', 'Box', 'Karton', 'Caixa'),
              admin: {
                width: '30%',
                description: l(
                  'Vide : à la bouteille.',
                  'Empty: per bottle.',
                  'Leer: pro Flasche.',
                  'Vazio: à garrafa.',
                ),
              },
            },
            {
              name: 'priceCents',
              type: 'number',
              required: true,
              min: 0,
              label: l('Prix', 'Price', 'Preis', 'Preço'),
              admin: { width: '30%', components: scaledNumber('€') },
            },
          ],
        },
      ],
    },
  ],
};

export const promotions: CollectionConfig = {
  slug: 'promotions',
  labels: {
    singular: l('Promotion', 'Promotion', 'Aktion', 'Promoção'),
    plural: l('Promotions', 'Promotions', 'Aktionen', 'Promoções'),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'target', 'startsAt', 'endsAt', 'active'],
    hidden: hiddenUnless('manager', 'sales'),
    description: l(
      'Remises automatiques sur des produits, catégories ou marques. Elles ne se cumulent pas : la meilleure s’applique. Les prix des listes professionnelles n’en bénéficient pas.',
      'Automatic discounts on products, categories or brands. They do not add up: the best one applies. Business price-list prices are not discounted.',
      'Automatische Rabatte auf Produkte, Kategorien oder Marken. Sie addieren sich nicht: der beste gilt. Preislisten für Firmen sind ausgenommen.',
      'Descontos automáticos em produtos, categorias ou marcas. Não se acumulam: aplica-se o melhor. Os preços das listas profissionais não são descontados.',
    ),
    components: addButton(
      'promotions',
      l('Ajouter une promotion', 'Add a promotion', 'Aktion hinzufügen', 'Adicionar uma promoção'),
    ),
  },
  access: { read: roles, create: roles, update: roles, delete: isStaff('manager') },
  hooks: { beforeChange: [needsValue] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          localized: true,
          label: l('Nom', 'Name', 'Name', 'Nome'),
          admin: { width: '70%', placeholder: 'Douro −10 %' },
        },
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: true,
          label: l('Active', 'Active', 'Aktiv', 'Ativa'),
          admin: { width: '30%', components: boolCell() },
        },
      ],
    },
    ...amount,
    {
      type: 'row',
      fields: [
        {
          name: 'target',
          type: 'select',
          required: true,
          defaultValue: 'products',
          options: [
            {
              value: 'all',
              label: l('Tout le catalogue', 'The whole catalogue', 'Der ganze Katalog', 'Todo o catálogo'),
            },
            { value: 'products', label: l('Des produits', 'Products', 'Produkte', 'Produtos') },
            { value: 'categories', label: l('Des catégories', 'Categories', 'Kategorien', 'Categorias') },
            { value: 'brands', label: l('Des marques', 'Brands', 'Marken', 'Marcas') },
          ],
          label: l('Sur', 'On', 'Auf', 'Em'),
          admin: { width: '50%' },
        },
        {
          name: 'targets',
          type: 'relationship',
          relationTo: ['products', 'categories', 'brands'],
          hasMany: true,
          label: l('Lesquels', 'Which ones', 'Welche', 'Quais'),
          admin: { width: '50%', condition: (data) => data?.target !== 'all' },
        },
      ],
    },
    dates,
    {
      type: 'row',
      fields: [
        channels(['webshop', 'mobile']),
        {
          name: 'priority',
          type: 'number',
          defaultValue: 0,
          label: l(
            'Priorité (à égalité)',
            'Priority (on a tie)',
            'Priorität (bei Gleichstand)',
            'Prioridade (em empate)',
          ),
          admin: { width: '50%' },
        },
      ],
    },
  ],
};

export const discountCodes: CollectionConfig = {
  slug: 'discountCodes',
  labels: {
    singular: l('Code de réduction', 'Discount code', 'Rabattcode', 'Código de desconto'),
    plural: l('Codes de réduction', 'Discount codes', 'Rabattcodes', 'Códigos de desconto'),
  },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'minOrderCents', 'uses', 'maxUses', 'endsAt', 'active'],
    hidden: hiddenUnless('manager', 'sales'),
    description: l(
      'Un code que le client tape au panier ou que l’équipe saisit à la vente. Il s’ajoute à une promotion.',
      'A code the customer types in the cart or staff enter at the sale. It comes on top of a promotion.',
      'Ein Code, den der Kunde im Warenkorb oder das Team beim Verkauf eingibt. Er kommt zu einer Aktion hinzu.',
      'Um código que o cliente escreve no carrinho ou a equipa na venda. Soma-se a uma promoção.',
    ),
    components: addButton(
      'discountCodes',
      l('Ajouter un code', 'Add a code', 'Code hinzufügen', 'Adicionar um código'),
    ),
  },
  access: { read: roles, create: roles, update: roles, delete: isStaff('manager') },
  hooks: {
    beforeChange: [
      needsValue,
      ({ data }) => {
        if (typeof data.code === 'string') data.code = data.code.trim().toUpperCase().replace(/\s+/g, '');
        return data;
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          label: l('Code', 'Code', 'Code', 'Código'),
          admin: { width: '70%', placeholder: 'BIENVENUE10' },
        },
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: true,
          label: l('Actif', 'Active', 'Aktiv', 'Ativo'),
          admin: { width: '30%', components: boolCell() },
        },
      ],
    },
    ...amount,
    {
      type: 'row',
      fields: [
        {
          name: 'minOrderCents',
          type: 'number',
          min: 0,
          label: l('Commande minimum', 'Minimum order', 'Mindestbestellwert', 'Encomenda mínima'),
          admin: { width: '33%', components: scaledNumber('€') },
        },
        {
          name: 'maxUses',
          type: 'number',
          min: 1,
          label: l('Utilisations au total', 'Uses in total', 'Einlösungen insgesamt', 'Utilizações no total'),
          admin: {
            width: '33%',
            description: l('Vide : sans limite.', 'Empty: no limit.', 'Leer: unbegrenzt.', 'Vazio: sem limite.'),
          },
        },
        {
          name: 'maxUsesPerCustomer',
          type: 'number',
          min: 1,
          label: l('Par client', 'Per customer', 'Pro Kunde', 'Por cliente'),
          admin: { width: '33%' },
        },
      ],
    },
    dates,
    {
      type: 'row',
      fields: [
        channels(['webshop', 'mobile']),
        {
          name: 'uses',
          type: 'number',
          defaultValue: 0,
          label: l('Déjà utilisé', 'Used so far', 'Bisher eingelöst', 'Já utilizado'),
          // Counted only by the order transaction (redeem), never typed.
          access: { create: () => false, update: () => false },
          admin: { width: '50%', readOnly: true },
        },
      ],
    },
    {
      name: 'customers',
      type: 'relationship',
      relationTo: 'customers',
      hasMany: true,
      label: l('Réservé à ces clients', 'Only for these customers', 'Nur für diese Kunden', 'Só para estes clientes'),
      admin: { description: l('Vide : tout le monde.', 'Empty: everyone.', 'Leer: alle.', 'Vazio: todos.') },
    },
  ],
};

export const promotionCollections = [priceLists, promotions, discountCodes];
