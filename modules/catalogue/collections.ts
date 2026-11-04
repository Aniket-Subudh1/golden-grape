import { APIError, type CollectionConfig, type Field, type PayloadRequest, type Validate } from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { autoSlug, badgeCell, createInDrawer, emptyList, type Label, l, openAsPage, pageLinkCell, scaledNumber, seoSection } from '@/lib/admin';
import { validateFactor } from './packaging';

// The catalogue (04-DATA-MODEL §2). Staff-only through the API: the website reads it through service.ts.

// The inventory service is loaded when a hook runs, not at import: it reaches payload.config.ts (through the settings
// service), which imports this file, and the cycle breaks `next build`.
const inventory = () => import('@/modules/inventory/service');

const say = (req: PayloadRequest | undefined, label: Label) => label[(req?.i18n?.language ?? 'fr') as keyof Label] ?? label.fr;
const row = (...fields: Field[]): Field => ({ type: 'row', fields });
const editors = isStaff('manager', 'stock');

export const CHANNELS = ['webshop', 'mobile', 'pos'] as const;

const channels: Field = {
  name: 'channels',
  type: 'select',
  hasMany: true,
  defaultValue: [...CHANNELS],
  label: l('Vendu sur', 'Sold on', 'Verkauft über', 'Vendido em'),
  options: [
    { value: 'webshop', label: l('Boutique en ligne', 'Online shop', 'Onlineshop', 'Loja online') },
    { value: 'mobile', label: l('Vente mobile', 'Mobile sale', 'Mobiler Verkauf', 'Venda móvel') },
    { value: 'pos', label: l('Caisse', 'Till', 'Kasse', 'Caixa') },
  ],
};

const active: Field = {
  name: 'active',
  type: 'checkbox',
  defaultValue: true,
  label: l('En vente', 'On sale', 'Im Verkauf', 'À venda'),
};

const BARCODE = /^\d{4,14}$/;

/**
 * One barcode resolves to exactly one thing: a variant (its base unit) or a packaging unit, never both. Digits only
 * (EAN-8, UPC-A 12, EAN-13 or an internal code). Empty is stored as null so the partial unique index ignores it.
 */
const validateBarcode =
  (self: 'variants' | 'packagingUnits'): Validate<string | null | undefined> =>
  async (value, { req, id }) => {
    if (!value) return true;
    if (!BARCODE.test(value)) {
      return say(req, l('Chiffres uniquement (8, 12 ou 13 pour un EAN).', 'Digits only (8, 12 or 13 for an EAN).', 'Nur Ziffern (8, 12 oder 13 für eine EAN).', 'Apenas algarismos (8, 12 ou 13 para um EAN).'));
    }
    // One query after the other: inside a transaction, parallel queries on its session can fail (Mongo).
    const taken = [];
    for (const collection of ['variants', 'packagingUnits'] as const) {
      taken.push(
        await req.payload.count({
          collection,
          req,
          overrideAccess: true,
          where: { barcode: { equals: value }, ...(collection === self && id ? { id: { not_equals: id } } : {}) },
        }),
      );
    }
    return taken.some((c) => c.totalDocs > 0)
      ? say(req, l('Ce code-barres est déjà utilisé.', 'This barcode is already in use.', 'Dieser Barcode wird bereits verwendet.', 'Este código de barras já está a ser usado.'))
      : true;
  };

const barcode = (self: 'variants' | 'packagingUnits', width?: string): Field => ({
  name: 'barcode',
  type: 'text',
  label: l('Code-barres', 'Barcode', 'Barcode', 'Código de barras'),
  validate: validateBarcode(self),
  hooks: { beforeValidate: [({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : null)] },
  admin: { width },
});

const refuse = (req: PayloadRequest) => {
  throw new APIError(
    say(
      req,
      l(
        'Cet article a un historique de stock : il ne peut pas être supprimé. Décochez « En vente » pour l’archiver.',
        'This item has stock history, so it cannot be deleted. Untick “On sale” to archive it.',
        'Dieser Artikel hat eine Lagerhistorie und kann nicht gelöscht werden. Entfernen Sie „Im Verkauf“, um ihn zu archivieren.',
        'Este artigo tem histórico de stock e não pode ser apagado. Desmarque «À venda» para o arquivar.',
      ),
    ),
    409,
    undefined,
    true,
  );
};

export const categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: l('Catégorie', 'Category', 'Kategorie', 'Categoria'), plural: l('Catégories', 'Categories', 'Kategorien', 'Categorias') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'order'],
    custom: openAsPage,
    hidden: hiddenUnless('manager'),
    description: l(
      'Les rayons de la boutique (Vins, Porto…) et du comptoir, dans l’ordre choisi.',
      'The shop’s aisles (Wines, Port…) and the counter’s, in the order you choose.',
      'Die Regale des Ladens (Weine, Portwein…) und der Theke, in Ihrer Reihenfolge.',
      'As secções da loja (Vinhos, Porto…) e do balcão, pela ordem escolhida.',
    ),
    components: {
      ...createInDrawer('categories', l('Ajouter une catégorie', 'Add a category', 'Kategorie hinzufügen', 'Adicionar uma categoria')),
      ...emptyList({
        icon: 'categories',
        title: l('Aucune catégorie pour l’instant', 'No categories yet', 'Noch keine Kategorien', 'Ainda sem categorias'),
        text: l(
          'Les catégories rangent la boutique (Vins, Porto, Épicerie…) et le comptoir. Créez-les avant d’ajouter des produits.',
          'Categories arrange the shop (Wines, Port, Groceries…) and the counter. Create them before adding products.',
          'Kategorien ordnen den Laden (Weine, Portwein, Feinkost…) und die Theke. Legen Sie sie vor den Produkten an.',
          'As categorias organizam a loja (Vinhos, Porto, Mercearia…) e o balcão. Crie-as antes de adicionar produtos.',
        ),
        action: l('Ajouter une catégorie', 'Add a category', 'Kategorie hinzufügen', 'Adicionar uma categoria'),
      }),
    },
  },
  access: { read: isStaff(), create: isStaff('manager'), update: isStaff('manager'), delete: isStaff('manager') },
  defaultSort: 'order',
  indexes: [{ fields: ['kind', 'order'] }],
  fields: [
    row(
      { name: 'name', type: 'text', localized: true, required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
      {
        name: 'kind',
        type: 'select',
        required: true,
        defaultValue: 'shop',
        label: l('Pour', 'For', 'Für', 'Para'),
        options: [
          { value: 'shop', label: l('La boutique', 'The shop', 'Den Laden', 'A loja') },
          { value: 'snack', label: l('Le comptoir', 'The counter', 'Die Theke', 'O balcão') },
        ],
        admin: { width: '25%', isClearable: false, components: badgeCell({ shop: 'info', snack: 'neutral' }) },
      },
      {
        name: 'order',
        type: 'number',
        defaultValue: 0,
        label: l('Position', 'Position', 'Position', 'Posição'),
        admin: { width: '25%', description: l('1 = en premier', '1 = shown first', '1 = zuerst', '1 = primeiro') },
      },
    ),
    autoSlug('categories', 'name'),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: l('Dans la catégorie (facultatif)', 'Inside category (optional)', 'In Kategorie (optional)', 'Dentro da categoria (opcional)'),
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: l('Photo', 'Photo', 'Foto', 'Foto') },
  ],
};

export const brands: CollectionConfig = {
  slug: 'brands',
  labels: { singular: l('Producteur', 'Producer', 'Erzeuger', 'Produtor'), plural: l('Producteurs', 'Producers', 'Erzeuger', 'Produtores') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'origin'],
    custom: openAsPage,
    hidden: hiddenUnless('manager'),
    description: l(
      'Les domaines et maisons dont vous vendez les produits. Ils s’ajoutent aussi depuis la fiche produit ou l’import.',
      'The estates and houses whose products you sell. They can also be added from a product or the import.',
      'Die Weingüter und Häuser, deren Produkte Sie verkaufen. Auch im Produkt oder beim Import anlegbar.',
      'As quintas e casas cujos produtos vende. Também se adicionam a partir do produto ou da importação.',
    ),
    components: {
      ...createInDrawer('brands', l('Ajouter un producteur', 'Add a producer', 'Erzeuger hinzufügen', 'Adicionar um produtor')),
      ...emptyList({
        icon: 'producers',
        title: l('Aucun producteur pour l’instant', 'No producers yet', 'Noch keine Erzeuger', 'Ainda sem produtores'),
        text: l(
          'Ajoutez les domaines et maisons de vos vins (Quinta do Crasto, Niepoort…) pour les relier à leurs produits.',
          'Add the estates and houses behind your wines (Quinta do Crasto, Niepoort…) to link them to their products.',
          'Legen Sie die Weingüter und Häuser Ihrer Weine an (Quinta do Crasto, Niepoort…), um sie mit Produkten zu verknüpfen.',
          'Adicione as quintas e casas dos seus vinhos (Quinta do Crasto, Niepoort…) para as ligar aos produtos.',
        ),
        action: l('Ajouter un producteur', 'Add a producer', 'Erzeuger hinzufügen', 'Adicionar um produtor'),
      }),
    },
  },
  access: { read: isStaff(), create: isStaff('manager', 'stock'), update: isStaff('manager', 'stock'), delete: isStaff('manager') },
  fields: [
    row(
      { name: 'name', type: 'text', required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
      { name: 'origin', type: 'text', localized: true, label: l('Région', 'Region', 'Region', 'Região'), admin: { width: '50%', placeholder: 'Douro' } },
    ),
    autoSlug('brands', 'name'),
  ],
};

const ALLERGENS: [string, Label][] = [
  ['gluten', l('Gluten', 'Gluten', 'Gluten', 'Glúten')],
  ['crustaceans', l('Crustacés', 'Crustaceans', 'Krebstiere', 'Crustáceos')],
  ['eggs', l('Œufs', 'Eggs', 'Eier', 'Ovos')],
  ['fish', l('Poisson', 'Fish', 'Fisch', 'Peixe')],
  ['peanuts', l('Arachides', 'Peanuts', 'Erdnüsse', 'Amendoins')],
  ['soy', l('Soja', 'Soy', 'Soja', 'Soja')],
  ['milk', l('Lait', 'Milk', 'Milch', 'Leite')],
  ['nuts', l('Fruits à coque', 'Tree nuts', 'Schalenfrüchte', 'Frutos de casca rija')],
  ['celery', l('Céleri', 'Celery', 'Sellerie', 'Aipo')],
  ['mustard', l('Moutarde', 'Mustard', 'Senf', 'Mostarda')],
  ['sesame', l('Sésame', 'Sesame', 'Sesam', 'Sésamo')],
  ['sulphites', l('Sulfites', 'Sulphites', 'Sulfite', 'Sulfitos')],
  ['lupin', l('Lupin', 'Lupin', 'Lupinen', 'Tremoço')],
  ['molluscs', l('Mollusques', 'Molluscs', 'Weichtiere', 'Moluscos')],
];

export const VAT_CLASSES = ['standard', 'intermediate', 'reduced', 'superReduced'] as const;
export const BADGES = ['signature', 'rare', 'dop', 'bestseller', 'homemade', 'new'] as const;
export const PRODUCT_KINDS = ['wine', 'grocery', 'snack', 'gift', 'other'] as const;
export const WINE_COLOURS = ['red', 'white', 'rose', 'sparkling', 'fortified'] as const;

/** Default variant: created with the product, labelled with its name (02 §5.1: every sale line points at a variant). */
async function createDefaultVariant({ doc, data, operation, req }: Parameters<NonNullable<NonNullable<CollectionConfig['hooks']>['afterChange']>[number]>[0]) {
  if (operation === 'create') {
    const existing = await req.payload.count({ collection: 'variants', where: { product: { equals: doc.id } }, req, overrideAccess: true });
    if (existing.totalDocs > 0) return doc;
    const first = (data as { firstVariant?: { sku?: string; barcode?: string; priceCents?: number; costCents?: number } }).firstVariant ?? {};
    await req.payload.create({
      collection: 'variants',
      req,
      overrideAccess: true,
      locale: req.locale && req.locale !== 'all' ? req.locale : 'fr',
      data: {
        product: doc.id,
        label: doc.name,
        sku: first.sku ?? '',
        barcode: first.barcode || undefined,
        priceCents: first.priceCents ?? 0,
        costCents: first.costCents,
        trackStock: doc.kind !== 'snack' && !doc.giftCard,
      },
    });
  }
  return doc;
}

/** Variant titles start with the product's French name; refresh them when it changes. */
async function retitleVariants({ doc, previousDoc, operation, req }: Parameters<NonNullable<NonNullable<CollectionConfig['hooks']>['afterChange']>[number]>[0]) {
  if (operation === 'update' && (req.locale ?? 'fr') === 'fr' && doc.name !== previousDoc?.name) {
    await req.payload.update({ collection: 'variants', where: { product: { equals: doc.id } }, data: {}, req, overrideAccess: true });
  }
  return doc;
}

export const products: CollectionConfig = {
  slug: 'products',
  labels: { singular: l('Produit', 'Product', 'Produkt', 'Produto'), plural: l('Produits', 'Products', 'Produkte', 'Produtos') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['images', 'name', 'category', 'offer', 'status'],
    custom: openAsPage,
    listSearchableFields: ['name'],
    hidden: hiddenUnless('manager', 'stock'),
    description: l(
      'Les vins, l’épicerie et le menu du comptoir. Le prix et le code-barres sont sur chaque format (bouteille, magnum…).',
      'The wines, groceries and counter menu. Price and barcode are on each size (bottle, magnum…).',
      'Weine, Feinkost und Thekenkarte. Preis und Barcode stehen bei jedem Format (Flasche, Magnum…).',
      'Os vinhos, a mercearia e o menu do balcão. O preço e o código de barras estão em cada formato (garrafa, magnum…).',
    ),
    components: {
      ...createInDrawer('products', l('Ajouter un produit', 'Add a product', 'Produkt hinzufügen', 'Adicionar um produto')),
      ...emptyList({
        icon: 'products',
        title: l('Aucun produit pour l’instant', 'No products yet', 'Noch keine Produkte', 'Ainda sem produtos'),
        text: l(
          'Ajoutez vos vins, votre épicerie et le menu du comptoir. Chaque produit reçoit un prix, un code-barres et son stock.',
          'Add your wines, groceries and the counter menu. Each product gets a price, a barcode and its stock.',
          'Fügen Sie Weine, Feinkost und die Thekenkarte hinzu. Jedes Produkt erhält Preis, Barcode und Bestand.',
          'Adicione os vinhos, a mercearia e o menu do balcão. Cada produto recebe preço, código de barras e stock.',
        ),
        action: l('Ajouter un produit', 'Add a product', 'Produkt hinzufügen', 'Adicionar um produto'),
      }),
    },
  },
  access: { read: isStaff(), create: editors, update: editors, delete: isStaff('admin') },
  hooks: {
    afterChange: [createDefaultVariant, retitleVariants],
    beforeDelete: [
      async ({ id, req }) => {
        const { docs } = await req.payload.find({ collection: 'variants', where: { product: { equals: id } }, limit: 0, depth: 0, req, overrideAccess: true });
        if (await (await inventory()).hasMovements(req, { variants: docs.map((v) => v.id) })) refuse(req);
      },
    ],
    afterDelete: [({ id, req }) => req.payload.delete({ collection: 'variants', where: { product: { equals: id } }, req, overrideAccess: true })],
  },
  fields: [
    {
      // Unnamed tabs only group the form; the stored data keeps its shape.
      type: 'tabs',
      tabs: [
        {
          label: l('Produit', 'Product', 'Produkt', 'Produto'),
          fields: [
          row(
            { name: 'name', type: 'text', localized: true, required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%' } },
            {
              name: 'kind',
              type: 'select',
              required: true,
              defaultValue: 'wine',
              label: l('Type', 'Type', 'Art', 'Tipo'),
              options: [
                { value: 'wine', label: l('Vin, porto, bière', 'Wine, port, beer', 'Wein, Portwein, Bier', 'Vinho, porto, cerveja') },
                { value: 'grocery', label: l('Épicerie', 'Grocery', 'Feinkost', 'Mercearia') },
                { value: 'snack', label: l('Comptoir (préparé sur place)', 'Counter (made here)', 'Theke (vor Ort zubereitet)', 'Balcão (feito cá)') },
                { value: 'gift', label: l('Coffret cadeau', 'Gift box', 'Geschenkbox', 'Cabaz de oferta') },
                { value: 'other', label: l('Autre', 'Other', 'Sonstiges', 'Outro') },
              ],
              admin: { width: '25%', isClearable: false },
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'active',
              index: true,
              label: l('Statut', 'Status', 'Status', 'Estado'),
              options: [
                { value: 'active', label: l('En vente', 'On sale', 'Im Verkauf', 'À venda') },
                { value: 'draft', label: l('En préparation', 'Being prepared', 'In Vorbereitung', 'Em preparação') },
                { value: 'archived', label: l('Archivé', 'Archived', 'Archiviert', 'Arquivado') },
              ],
              admin: { width: '25%', isClearable: false, components: badgeCell({ active: 'success', draft: 'warning', archived: 'neutral' }) },
            },
          ),
          autoSlug('products', 'name'),
          row(
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              required: true,
              index: true,
              label: l('Catégorie', 'Category', 'Kategorie', 'Categoria'),
              filterOptions: ({ data }) => ({ kind: { equals: data?.kind === 'snack' ? 'snack' : 'shop' } }),
              admin: { width: '50%', components: { Cell: '@/modules/catalogue/admin/product-cells#CategoryCell' } },
            },
            { name: 'brand', type: 'relationship', relationTo: 'brands', index: true, label: l('Producteur', 'Producer', 'Erzeuger', 'Produtor'), admin: { width: '50%' } },
          ),
          {
            // Only on the "Add" form: the price and barcode of the first size. Afterwards they live on the size itself.
            // Virtual fields are read-only and unvalidated by default in Payload: both are switched back on here.
            name: 'firstVariant',
            type: 'group',
            virtual: true,
            label: l('Prix et code-barres', 'Price and barcode', 'Preis und Barcode', 'Preço e código de barras'),
            admin: { readOnly: false, condition: (_, __, { operation }) => operation === 'create' },
            fields: [
              row(
                {
                  name: 'priceCents',
                  type: 'number',
                  required: true,
                  min: 0,
                  virtual: true,
                  label: l('Prix de vente TTC', 'Selling price incl. VAT', 'Verkaufspreis inkl. MwSt.', 'Preço de venda c/ IVA'),
                  validate: (value: number | null | undefined, { req }: { req: PayloadRequest }) =>
                    (Number.isInteger(value) && (value as number) >= 0) ||
                    say(req, l('Indiquez le prix, par ex. 24,50.', 'Enter the price, e.g. 24.50.', 'Geben Sie den Preis ein, z. B. 24,50.', 'Indique o preço, por ex. 24,50.')),
                  admin: { readOnly: false, disableListColumn: true, width: '33%', components: scaledNumber('€') },
                },
                {
                  name: 'barcode',
                  type: 'text',
                  virtual: true,
                  label: l('Code-barres (facultatif)', 'Barcode (optional)', 'Barcode (optional)', 'Código de barras (opcional)'),
                  validate: validateBarcode('variants'),
                  admin: { readOnly: false, disableListColumn: true, width: '33%' },
                },
                {
                  name: 'sku',
                  type: 'text',
                  virtual: true,
                  label: l('Référence (facultatif)', 'Reference (optional)', 'Referenz (optional)', 'Referência (opcional)'),
                  admin: { readOnly: false, disableListColumn: true, width: '33%', description: l('Vide : créée à partir du nom.', 'Empty: made from the name.', 'Leer: aus dem Namen erstellt.', 'Vazio: criada a partir do nome.') },
                },
              ),
            ],
          },
          {
            name: 'vatClass',
            type: 'select',
            required: true,
            defaultValue: 'standard',
            label: l('TVA', 'VAT', 'MwSt.', 'IVA'),
            options: [
              { value: 'standard', label: l('Taux normal (17 %)', 'Standard rate (17%)', 'Normalsatz (17 %)', 'Taxa normal (17 %)') },
              { value: 'intermediate', label: l('Taux intermédiaire (14 %)', 'Intermediate rate (14%)', 'Zwischensatz (14 %)', 'Taxa intermédia (14 %)') },
              { value: 'reduced', label: l('Taux réduit (8 %)', 'Reduced rate (8%)', 'Ermäßigter Satz (8 %)', 'Taxa reduzida (8 %)') },
              { value: 'superReduced', label: l('Taux super-réduit (3 %)', 'Super-reduced rate (3%)', 'Stark ermäßigter Satz (3 %)', 'Taxa super-reduzida (3 %)') },
            ],
            admin: { isClearable: false },
          },
          {
            name: 'variants',
            type: 'join',
            collection: 'variants',
            on: 'product',
            label: l('Formats et prix', 'Sizes and prices', 'Formate und Preise', 'Formatos e preços'),
            admin: {
              condition: (_, __, { operation }) => operation === 'update',
              disableListColumn: true,
              defaultColumns: ['title', 'sku', 'barcode', 'priceCents'],
              description: l(
                'Chaque format a son prix, son code-barres et son stock. Ouvrez-le pour ajouter un carton de 6 ou de 12.',
                'Each size has its own price, barcode and stock. Open it to add a box of 6 or 12.',
                'Jedes Format hat eigenen Preis, Barcode und Bestand. Öffnen Sie es, um einen 6er- oder 12er-Karton hinzuzufügen.',
                'Cada formato tem o seu preço, código de barras e stock. Abra-o para adicionar uma caixa de 6 ou de 12.',
              ),
            },
          },
          {
            name: 'wine',
            type: 'group',
            label: l('Le vin', 'The wine', 'Der Wein', 'O vinho'),
            admin: { condition: (data) => data?.kind === 'wine' },
            fields: [
              row(
                { name: 'region', type: 'text', localized: true, label: l('Région', 'Region', 'Region', 'Região'), admin: { width: '50%' } },
                { name: 'grape', type: 'text', localized: true, label: l('Cépages', 'Grapes', 'Rebsorten', 'Castas'), admin: { width: '50%' } },
              ),
              row(
                { name: 'vintage', type: 'number', min: 1800, max: 2100, label: l('Millésime', 'Vintage', 'Jahrgang', 'Colheita'), admin: { width: '25%' } },
                {
                  name: 'colour',
                  type: 'select',
                  label: l('Couleur', 'Colour', 'Farbe', 'Cor'),
                  options: [
                    { value: 'red', label: l('Rouge', 'Red', 'Rot', 'Tinto') },
                    { value: 'white', label: l('Blanc', 'White', 'Weiß', 'Branco') },
                    { value: 'rose', label: l('Rosé', 'Rosé', 'Rosé', 'Rosé') },
                    { value: 'sparkling', label: l('Effervescent', 'Sparkling', 'Schaumwein', 'Espumante') },
                    { value: 'fortified', label: l('Muté (porto…)', 'Fortified (port…)', 'Likörwein (Portwein…)', 'Generoso (porto…)') },
                  ],
                  admin: { width: '25%' },
                },
                { name: 'abv', type: 'number', min: 0, max: 10000, label: l('Degré d’alcool', 'Alcohol', 'Alkoholgehalt', 'Teor alcoólico'), admin: { width: '25%', components: scaledNumber('%') } },
                { name: 'servingTemp', type: 'text', label: l('Service', 'Serve at', 'Serviertemperatur', 'Servir a'), admin: { width: '25%', placeholder: '16–18 °C' } },
              ),
            ],
          },
          {
            name: 'snack',
            type: 'group',
            label: l('Le plat', 'The dish', 'Das Gericht', 'O prato'),
            admin: { condition: (data) => data?.kind === 'snack' },
            fields: [
              { name: 'ingredients', type: 'textarea', localized: true, label: l('Ingrédients', 'Ingredients', 'Zutaten', 'Ingredientes') },
              {
                name: 'allergens',
                type: 'select',
                hasMany: true,
                label: l('Allergènes', 'Allergens', 'Allergene', 'Alergénios'),
                options: ALLERGENS.map(([value, label]) => ({ value, label })),
              },
            ],
          },
          ],
        },
        {
          label: l('Photos et texte', 'Photos and text', 'Fotos und Text', 'Fotos e texto'),
          fields: [
          {
            name: 'images',
            type: 'upload',
            relationTo: 'media',
            hasMany: true,
            label: l('Photos', 'Photos', 'Fotos', 'Fotos'),
            admin: {
              description: l('La première sert de vignette dans la boutique.', 'The first one is the card image in the shop.', 'Das erste ist das Vorschaubild im Shop.', 'A primeira é a miniatura na loja.'),
              components: { Cell: '@/modules/catalogue/admin/product-cells#PhotoCell' },
            },
          },
          {
            name: 'badges',
            type: 'select',
            hasMany: true,
            label: l('Étiquettes', 'Labels', 'Etiketten', 'Etiquetas'),
            options: [
              { value: 'signature', label: l('Signature', 'Signature', 'Signature', 'Assinatura') },
              { value: 'rare', label: l('Rare', 'Rare', 'Selten', 'Raro') },
              { value: 'dop', label: l('DOP', 'PDO', 'g.U.', 'DOP') },
              { value: 'bestseller', label: l('Best-seller', 'Bestseller', 'Bestseller', 'Mais vendido') },
              { value: 'homemade', label: l('Fait maison', 'Homemade', 'Hausgemacht', 'Caseiro') },
              { value: 'new', label: l('Nouveau', 'New', 'Neu', 'Novo') },
            ],
          },
          { name: 'description', type: 'richText', localized: true, label: l('Description', 'Description', 'Beschreibung', 'Descrição'), admin: { disableListColumn: true } },
          seoSection([
            { name: 'title', type: 'text', localized: true, label: l('Titre dans Google', 'Title in Google', 'Titel bei Google', 'Título no Google') },
            { name: 'description', type: 'textarea', localized: true, label: l('Texte dans Google', 'Text in Google', 'Text bei Google', 'Texto no Google') },
          ]),
          ],
        },
      ],
    },
    // Used from M3.2 (loyalty, gift cards); kept in the data, not shown before then.
    { name: 'loyaltyExcluded', type: 'checkbox', defaultValue: false, admin: { hidden: true, disableListColumn: true } },
    { name: 'giftCard', type: 'checkbox', defaultValue: false, admin: { hidden: true, disableListColumn: true } },
    // List column only: lowest price and stock across the sizes (modules/catalogue/admin/product-cells.tsx).
    {
      name: 'offer',
      type: 'ui',
      label: l('Prix et stock', 'Price and stock', 'Preis und Bestand', 'Preço e stock'),
      admin: { components: { Cell: '@/modules/catalogue/admin/product-cells#OfferCell' } },
    },
  ],
  custom: {
    // Localized text is stored per locale (`name.fr`, `wine.region.fr`): checked in catalogue.int.test.ts.
    indexes: [{ fields: { 'name.fr': 'text', 'name.en': 'text', 'name.de': 'text', 'name.pt': 'text', 'wine.region.fr': 'text' } }],
  },
};

export const variants: CollectionConfig = {
  slug: 'variants',
  labels: { singular: l('Format', 'Size', 'Format', 'Formato'), plural: l('Formats', 'Sizes', 'Formate', 'Formatos') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'barcode', 'priceCents', 'active'],
    custom: openAsPage,
    listSearchableFields: ['title', 'sku', 'barcode'],
    hidden: hiddenUnless('manager', 'stock'),
  },
  access: { read: isStaff(), create: editors, update: editors, delete: isStaff('admin') },
  hooks: {
    // beforeValidate: the generated reference must exist before the required check runs.
    beforeValidate: [
      async ({ data = {}, originalDoc, req }) => {
        const productId = data.product ?? originalDoc?.product;
        const id = typeof productId === 'object' ? productId?.id : productId;
        if (!id) return data;
        // Payload writes a call's `locale` onto the shared req: read the French name, then put the save's locale back,
        // or the rest of this save (an English label…) would be written in French.
        const { locale, fallbackLocale } = req;
        const product = await req.payload.findByID({ collection: 'products', id, locale: 'fr', depth: 0, req, overrideAccess: true });
        Object.assign(req, { locale, fallbackLocale });
        // The title (lists, pickers) is French only: saving another language's label leaves it as it is.
        if (!locale || locale === 'fr') {
          const label = data.label ?? originalDoc?.label;
          data.title = label && label !== product.name ? `${product.name} · ${label}` : product.name;
        }
        if (!data.sku && !originalDoc?.sku) {
          const base = product.slug.toUpperCase();
          for (let n = 1; ; n++) {
            const sku = n === 1 ? base : `${base}-${n}`;
            const { totalDocs } = await req.payload.count({ collection: 'variants', where: { sku: { equals: sku } }, req, overrideAccess: true });
            if (totalDocs === 0) {
              data.sku = sku;
              break;
            }
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (doc.trackStock) await (await inventory()).ensureStockLevel(req, doc.id);
        return doc;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        if (await (await inventory()).hasMovements(req, { variants: [String(id)] })) refuse(req);
      },
    ],
    afterDelete: [
      async ({ id, req }) => {
        await req.payload.delete({ collection: 'packagingUnits', where: { variant: { equals: id } }, req, overrideAccess: true });
        await (await inventory()).dropStockLevel(req, String(id));
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: l('Format', 'Size', 'Format', 'Formato'), admin: { hidden: true, components: pageLinkCell } },
    {
      type: 'tabs',
      tabs: [
        {
          label: l('Prix et codes', 'Price and codes', 'Preis und Codes', 'Preço e códigos'),
          fields: [
            row(
              { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true, label: l('Produit', 'Product', 'Produkt', 'Produto'), admin: { width: '50%' } },
              {
                name: 'label',
                type: 'text',
                localized: true,
                label: l('Nom du format', 'Size name', 'Name des Formats', 'Nome do formato'),
                admin: { width: '50%', placeholder: '75 cl · 2019' },
              },
            ),
            row(
              { name: 'priceCents', type: 'number', required: true, min: 0, label: l('Prix de vente TTC', 'Selling price incl. VAT', 'Verkaufspreis inkl. MwSt.', 'Preço de venda c/ IVA'), admin: { width: '50%', components: scaledNumber('€') } },
              { name: 'costCents', type: 'number', min: 0, label: l('Dernier prix d’achat HT', 'Latest purchase cost excl. VAT', 'Letzter Einkaufspreis netto', 'Último custo s/ IVA'), admin: { width: '50%', components: scaledNumber('€') } },
            ),
            row(
              { name: 'sku', type: 'text', required: true, unique: true, label: l('Référence', 'Reference', 'Referenz', 'Referência'), admin: { width: '50%', description: l('Vide : créée à partir du nom.', 'Empty: made from the name.', 'Leer: aus dem Namen erstellt.', 'Vazio: criada a partir do nome.') } },
              barcode('variants', '50%'),
            ),
            channels,
            row(active, {
              name: 'trackStock',
              type: 'checkbox',
              defaultValue: true,
              label: l('Suivre le stock', 'Track stock', 'Bestand führen', 'Controlar stock'),
              admin: {
                description: l(
                  'Décoché pour ce qui est préparé à la demande (comptoir) ou les bons cadeaux.',
                  'Unticked for what is made to order (counter) or gift vouchers.',
                  'Nicht angehakt für Zubereitetes (Theke) oder Gutscheine.',
                  'Desmarcado para o que é feito na hora (balcão) ou vales de oferta.',
                ),
              },
            }),
          ],
        },
        {
          label: l('Cartons', 'Boxes', 'Kartons', 'Caixas'),
          fields: [
            {
              name: 'packaging',
              type: 'join',
              collection: 'packagingUnits',
              on: 'variant',
              label: l('Cartons et lots', 'Boxes and packs', 'Kartons und Packungen', 'Caixas e packs'),
              admin: {
                condition: (_, __, { operation }) => operation === 'update',
                defaultColumns: ['label', 'factor', 'barcode', 'priceCents'],
                description: l(
                  'Un carton de 6 vend ou reçoit 6 bouteilles d’un coup. Il peut avoir son propre code-barres et son prix.',
                  'A box of 6 sells or receives 6 bottles at once. It can have its own barcode and price.',
                  'Ein 6er-Karton verkauft oder empfängt 6 Flaschen auf einmal. Er kann eigenen Barcode und Preis haben.',
                  'Uma caixa de 6 vende ou recebe 6 garrafas de uma vez. Pode ter o seu próprio código de barras e preço.',
                ),
              },
            },
          ],
        },
        {
          label: l('Stock', 'Stock', 'Bestand', 'Stock'),
          // Level, alert, "Correct stock" and the movement history (newest first, paginated) in one panel.
          fields: [
            {
              name: 'stockPanel',
              type: 'ui',
              admin: {
                condition: (data, _, { operation }) => operation === 'update' && data?.trackStock !== false,
                components: { Field: '@/modules/inventory/admin/stock-panel' },
              },
            },
          ],
        },
      ],
    },
  ],
  custom: {
    // Unique only when set: a size without a barcode is normal. Also the barcode lookup index.
    indexes: [{ fields: { barcode: 1 }, options: { name: 'barcode_unique', unique: true, partialFilterExpression: { barcode: { $type: 'string' } } } }],
  },
};

export const packagingUnits: CollectionConfig = {
  slug: 'packagingUnits',
  labels: { singular: l('Carton', 'Box', 'Karton', 'Caixa'), plural: l('Cartons', 'Boxes', 'Kartons', 'Caixas') },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'variant', 'factor', 'barcode', 'priceCents'],
    custom: openAsPage,
    hidden: hiddenUnless('manager', 'stock'),
  },
  access: { read: isStaff(), create: editors, update: editors, delete: editors },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        if (await (await inventory()).hasMovements(req, { unit: String(id) })) refuse(req);
      },
    ],
  },
  indexes: [{ fields: ['variant', 'factor'], unique: true }],
  fields: [
    row(
      { name: 'variant', type: 'relationship', relationTo: 'variants', required: true, index: true, label: l('Format', 'Size', 'Format', 'Formato'), admin: { width: '50%' } },
      { name: 'label', type: 'text', localized: true, required: true, label: l('Nom', 'Name', 'Name', 'Nome'), admin: { width: '50%', placeholder: 'Carton de 6', components: pageLinkCell } },
    ),
    row(
      {
        name: 'factor',
        type: 'number',
        required: true,
        min: 2,
        label: l('Nombre d’unités', 'Number of units', 'Anzahl Einheiten', 'Número de unidades'),
        validate: (value: number | null | undefined, { req }: { req: PayloadRequest }) =>
          validateFactor(value) === true || say(req, l('Un nombre entier, au moins 2.', 'A whole number, at least 2.', 'Eine ganze Zahl, mindestens 2.', 'Um número inteiro, pelo menos 2.')),
        admin: { width: '33%' },
      },
      barcode('packagingUnits', '33%'),
      {
        name: 'priceCents',
        type: 'number',
        min: 0,
        label: l('Prix du carton TTC (facultatif)', 'Box price incl. VAT (optional)', 'Kartonpreis inkl. MwSt. (optional)', 'Preço da caixa c/ IVA (opcional)'),
        admin: { width: '33%', components: scaledNumber('€'), description: l('Vide : nombre × prix unitaire.', 'Empty: units × unit price.', 'Leer: Anzahl × Stückpreis.', 'Vazio: unidades × preço unitário.') },
      },
    ),
    channels,
    active,
  ],
  custom: {
    indexes: [{ fields: { barcode: 1 }, options: { name: 'barcode_unique', unique: true, partialFilterExpression: { barcode: { $type: 'string' } } } }],
  },
};

export const catalogueCollections = [categories, brands, products, variants, packagingUnits];
