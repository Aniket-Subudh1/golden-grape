import type { CollectionSlug, Field, FieldHook, PayloadRequest, TextField } from 'payload';

// Admin building blocks shared by several collections and globals. The admin is used by non-technical staff
// (docs/03-CODING-LAWS.md): everyday words in the four languages, no codes, cents, paths or IDs on screen.

export type Label = { fr: string; en: string; de: string; pt: string };

/** A label in the four admin languages, in the order fr, en, de, pt (Payload picks the user's language). */
export const l = (fr: string, en: string, de: string, pt: string): Label => ({ fr, en, de, pt });

/** A validation message in the language of the person saving (Payload `validate` returns the text to show). */
export const say = (req: PayloadRequest | undefined, label: Label) => label[(req?.i18n?.language ?? 'fr') as keyof Label] ?? label.fr;

/** The list page's "Add …" button, opening the create page (components/admin/create-button.tsx). */
export const addButton = (collectionSlug: string, label: Label) => ({
  views: { list: { actions: [{ path: '@/components/admin/create-button', clientProps: { collectionSlug, label } }] } },
});

const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** The web address (`/events/<slug>`), made from the title (or `from`) when the document is created, then kept. Hidden. */
export const autoSlug = (collection: CollectionSlug, from = 'title'): TextField => {
  const fill: FieldHook = async ({ value, data, req, originalDoc }) => {
    if (value || originalDoc?.slug) return value || originalDoc?.slug;
    const base = slugify(String(data?.[from] ?? '')) || 'page';
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const { totalDocs } = await req.payload.count({ collection, where: { slug: { equals: slug } }, req });
      if (totalDocs === 0) return slug;
    }
  };
  return { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { hidden: true, disableListColumn: true }, hooks: { beforeValidate: [fill] } };
};

/** "Links to": the website's pages as a list instead of a typed path. Values are the stored paths. */
export const linkTo = (width?: string): Field => ({
  name: 'href',
  type: 'select',
  label: l('Mène vers', 'Links to', 'Führt zu', 'Leva a'),
  options: [
    { value: '/', label: l('Accueil', 'Home', 'Startseite', 'Início') },
    { value: '/shop', label: l('Boutique', 'Shop', 'Shop', 'Loja') },
    { value: '/snack', label: l('Comptoir', 'Counter', 'Theke', 'Balcão') },
    { value: '/maison', label: l('La Maison', 'The House', 'Das Haus', 'A Casa') },
    { value: '/events', label: l('Événements', 'Events', 'Veranstaltungen', 'Eventos') },
    { value: '/catering', label: l('Traiteur', 'Catering', 'Catering', 'Catering') },
    { value: '/contact', label: l('Contact', 'Contact', 'Kontakt', 'Contacto') },
  ],
  admin: {
    width,
    description: l(
      'Vide : affiché sans lien (page pas encore en ligne).',
      'Empty: shown without a link (page not online yet).',
      'Leer: ohne Link angezeigt (Seite noch nicht online).',
      'Vazio: mostrado sem ligação (página ainda não online).',
    ),
  },
});

const weekday = (lang: string, day: number) => {
  const name = new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + day)));
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Sunday (0) to Saturday (6), named in the admin language. Values are the stored day numbers. */
export const WEEKDAYS = Array.from({ length: 7 }, (_, day) => ({
  value: String(day),
  label: l(weekday('fr', day), weekday('en', day), weekday('de', day), weekday('pt', day)),
}));

const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

/** A time picked from a list of quarter hours; stored as "HH:mm" like before. */
export const timeOfDay = (name: string, label: Label, width?: string): Field => ({
  name,
  type: 'select',
  required: true,
  label,
  options: QUARTER_HOURS,
  admin: { width, isClearable: false },
});

/** An amount typed in € (or %) and stored as integer cents (or basis points): components/admin/number-field.tsx. */
export const scaledNumber = (suffix: '€' | '%') => ({
  Field: { path: '@/components/admin/number-field', clientProps: { suffix } },
  Cell: { path: '@/components/admin/number-field#NumberCell', clientProps: { suffix } },
});

/** Search-engine texts, folded away: most people never need them, and empty means the title and text are reused. */
export const seoSection = (fields: Field[]): Field => ({
  type: 'collapsible',
  label: l('Google (facultatif)', 'Google (optional)', 'Google (optional)', 'Google (opcional)'),
  admin: {
    initCollapsed: true,
    description: l(
      'Le titre et le texte affichés dans les résultats Google. Vide : le titre et la description sont repris.',
      'The title and text shown in Google results. Empty: the title and description are used.',
      'Titel und Text in den Google-Ergebnissen. Leer: Titel und Beschreibung werden verwendet.',
      'O título e o texto mostrados nos resultados do Google. Vazio: são usados o título e a descrição.',
    ),
  },
  // Search-engine texts are not list columns.
  fields: [{ name: 'seo', type: 'group', label: false, fields: fields.map((f) => ({ ...f, admin: { ...('admin' in f ? f.admin : {}), disableListColumn: true } }) as Field) }],
});

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A select shown as a coloured badge in list columns (components/admin/cells.tsx). */
export const badgeCell = (tones: Record<string, Tone>) => ({ Cell: { path: '@/components/admin/cells#BadgeCell', clientProps: { tones } } });

/** A join-table title that opens the row's full page (Payload's join tables otherwise open a dialog). */
export const pageLinkCell = { Cell: '@/components/admin/cells#PageLinkCell' };

/** A signed quantity in list columns: +12 green, −3 red. */
export const signedCell = { Cell: '@/components/admin/cells#SignedCell' };

/** The list's first-use state: what it is for and a button to add the first one (components/admin/empty-list.tsx). */
export const emptyList = (empty: { icon: string; title: Label; text: Label; action?: Label; evenFiltered?: boolean }) => ({
  beforeListTable: [{ path: '@/components/admin/empty-list', clientProps: empty }],
});

/**
 * A field kept for list columns and filters but not drawn in the edit view, where a summary panel (a `ui` field)
 * shows the document instead: orders, reservations and bookings, which only their services write.
 */
export const listOnly = (field: Field): Field => ({ ...field, admin: { ...('admin' in field ? field.admin : {}), condition: () => false } }) as Field;
