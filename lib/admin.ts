import type { Field, FieldHook, TextField } from 'payload';

// Admin building blocks shared by several collections and globals. The admin is used by non-technical staff
// (docs/03-CODING-LAWS.md): everyday words in the four languages, no codes, cents, paths or IDs on screen.

export type Label = { fr: string; en: string; de: string; pt: string };

/** A label in the four admin languages, in the order fr, en, de, pt (Payload picks the user's language). */
export const l = (fr: string, en: string, de: string, pt: string): Label => ({ fr, en, de, pt });

/** A list page whose "Add" opens a centred modal over the list (components/admin/create-button.tsx). */
export const createInDrawer = (collectionSlug: string, label: Label) => ({
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

/** The web address (`/events/<slug>`), made from the title when the document is created, then kept. Hidden. */
export const autoSlug = (collection: 'events' | 'legal' | 'pages'): TextField => {
  const fill: FieldHook = async ({ value, data, req, originalDoc }) => {
    if (value || originalDoc?.slug) return value || originalDoc?.slug;
    const base = slugify(String(data?.title ?? '')) || 'page';
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const { totalDocs } = await req.payload.count({ collection, where: { slug: { equals: slug } }, req });
      if (totalDocs === 0) return slug;
    }
  };
  return { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { hidden: true }, hooks: { beforeValidate: [fill] } };
};

/** "Links to": the website's pages as a list instead of a typed path. Values are the stored paths. */
export const linkTo = (width?: string): Field => ({
  name: 'href',
  type: 'select',
  label: l('Mène vers', 'Links to', 'Führt zu', 'Leva a'),
  options: [
    { value: '/', label: l('Accueil', 'Home', 'Startseite', 'Início') },
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
  fields: [{ name: 'seo', type: 'group', label: false, fields }],
});
