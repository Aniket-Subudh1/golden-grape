import type { Field, GlobalConfig } from 'payload';
import de from '@/dictionaries/de.json';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import pt from '@/dictionaries/pt.json';
import { hiddenUnless, isStaff, publicRead } from '@/lib/access';
import { l, linkTo, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { isLocale } from '@/lib/i18n';
import { revalidateTagHook } from '@/lib/revalidate';

const editable = { read: publicRead, update: isStaff('manager') };
const rowLabel = { components: { RowLabel: '@/components/admin/row-label' } };
// One compact row per link: its text and the page it leads to (a list, not a typed path).
const link: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'label', type: 'text', localized: true, required: true, label: l('Texte du lien', 'Link text', 'Linktext', 'Texto da ligação'), admin: { width: '50%' } },
      linkTo('50%'),
    ],
  },
];
const linkLabels = { singular: l('Lien', 'Link', 'Link', 'Ligação'), plural: l('Liens', 'Links', 'Links', 'Ligações') };

export const header: GlobalConfig = {
  slug: 'Header',
  label: l('Menu du haut', 'Top menu', 'Hauptmenü der Website', 'Menu superior'),
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'Les liens en haut de chaque page du site.',
      'The links at the top of every page of the website.',
      'Die Links oben auf jeder Seite der Website.',
      'As ligações no topo de cada página do site.',
    ),
    preview: (_, { locale }) => `/${locale}`,
  },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('header')] },
  fields: [
    {
      name: 'navItems',
      label: l('Liens du menu', 'Menu links', 'Menülinks', 'Ligações do menu'),
      labels: linkLabels,
      type: 'array',
      maxRows: 8,
      admin: {
        description: l(
          'Sur ordinateur, les trois premiers sont à gauche du logo, les autres à droite. Glissez ⠿ pour changer l’ordre.',
          'On computers the first three sit left of the logo, the rest on the right. Drag ⠿ to change the order.',
          'Am Computer stehen die ersten drei links vom Logo, die anderen rechts. Ziehen Sie ⠿, um die Reihenfolge zu ändern.',
          'No computador, as três primeiras ficam à esquerda do logótipo e as outras à direita. Arraste ⠿ para mudar a ordem.',
        ),
        ...rowLabel,
      },
      fields: link,
    },
  ],
};

export const footer: GlobalConfig = {
  slug: 'Footer',
  label: l('Pied de page', 'Footer', 'Fußzeile', 'Rodapé'),
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'Le bas de chaque page. Les pages légales en ligne y sont ajoutées toutes seules.',
      'The bottom of every page. Legal pages that are online are added automatically.',
      'Der untere Teil jeder Seite. Rechtliche Seiten, die online sind, kommen automatisch dazu.',
      'A parte de baixo de cada página. As páginas legais online são acrescentadas sozinhas.',
    ),
    preview: (_, { locale }) => `/${locale}`,
  },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('footer')] },
  fields: [
    { name: 'tagline', type: 'textarea', localized: true, label: l('Phrase sous le logo', 'Line under the logo', 'Satz unter dem Logo', 'Frase por baixo do logótipo') },
    {
      name: 'columns',
      label: l('Colonnes de liens', 'Link columns', 'Linkspalten', 'Colunas de ligações'),
      labels: { singular: l('Colonne', 'Column', 'Spalte', 'Coluna'), plural: l('Colonnes', 'Columns', 'Spalten', 'Colunas') },
      type: 'array',
      maxRows: 3,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        { name: 'title', type: 'text', localized: true, required: true, label: l('Titre de la colonne', 'Column title', 'Spaltentitel', 'Título da coluna') },
        { name: 'links', label: l('Liens', 'Links', 'Links', 'Ligações'), labels: linkLabels, type: 'array', admin: rowLabel, fields: link },
      ],
    },
  ],
};

export const happyHour: GlobalConfig = {
  slug: 'HappyHour',
  label: 'Happy Hour',
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'La section Happy Hour de la page d’accueil.',
      'The Happy Hour section of the home page.',
      'Der Happy-Hour-Bereich der Startseite.',
      'A secção Happy Hour da página inicial.',
    ),
    preview: (_, { locale }) => `/${locale}`,
  },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('happy-hour')] },
  fields: [
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: l('Afficher sur le site', 'Show on the website', 'Auf der Website zeigen', 'Mostrar no site'),
      admin: {
        description: l('Décochez pour cacher la section.', 'Untick to hide the section.', 'Abwählen, um den Bereich auszublenden.', 'Desmarque para esconder a secção.'),
      },
    },
    { name: 'days', type: 'select', hasMany: true, required: true, options: WEEKDAYS, label: l('Jours', 'Days', 'Tage', 'Dias') },
    { type: 'row', fields: [timeOfDay('from', l('De', 'From', 'Von', 'Das'), '50%'), timeOfDay('to', l('À', 'To', 'Bis', 'Às'), '50%')] },
    {
      type: 'row',
      fields: [
        { name: 'titleA', type: 'text', localized: true, required: true, label: l('Titre', 'Title', 'Titel', 'Título'), admin: { width: '50%' } },
        {
          name: 'titleB',
          type: 'text',
          localized: true,
          label: l('Suite du titre, en or', 'Rest of the title, in gold', 'Rest des Titels, in Gold', 'Resto do título, a dourado'),
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'text',
      type: 'textarea',
      localized: true,
      label: l('Texte', 'Text', 'Text', 'Texto'),
      admin: {
        description: l(
          'Pour mettre des mots en or, entourez-les ainsi : <gold>à moitié prix</gold>',
          'To show words in gold, surround them like this: <gold>half price</gold>',
          'Um Wörter in Gold zu zeigen, umgeben Sie sie so: <gold>halber Preis</gold>',
          'Para mostrar palavras a dourado, rodeie-as assim: <gold>metade do preço</gold>',
        ),
      },
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: l('Photo', 'Photo', 'Foto', 'Foto') },
  ],
};

// The home page's big title. It opens filled with today's text (the dictionary), and the site falls back to that
// text for any field left empty, so nothing changes until someone edits it.
const HERO = { fr: fr.hero, en: en.hero, de: de.hero, pt: pt.hero };
const heroDefault =
  (key: 'eyebrow' | 'titleA' | 'titleB' | 'subtitle') =>
  ({ locale }: { locale?: string }) =>
    HERO[locale && isLocale(locale) ? locale : 'fr'][key];

export const homePage: GlobalConfig = {
  slug: 'HomePage',
  label: l('Page d’accueil', 'Home page', 'Startseite', 'Página inicial'),
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'Le grand titre et la photo en haut de la page d’accueil. Les événements à venir s’y affichent tout seuls.',
      'The big title and photo at the top of the home page. Upcoming events appear there by themselves.',
      'Der große Titel und das Foto oben auf der Startseite. Kommende Veranstaltungen erscheinen dort von selbst.',
      'O título grande e a foto no topo da página inicial. Os próximos eventos aparecem lá sozinhos.',
    ),
    preview: (_, { locale }) => `/${locale}`,
  },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('home')] },
  fields: [
    {
      name: 'hero',
      type: 'group',
      label: false,
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          localized: true,
          defaultValue: heroDefault('eyebrow'),
          label: l('Petite ligne au-dessus', 'Small line above', 'Kleine Zeile darüber', 'Linha pequena por cima'),
        },
        {
          type: 'row',
          fields: [
            { name: 'titleA', type: 'text', localized: true, defaultValue: heroDefault('titleA'), label: l('Titre', 'Title', 'Titel', 'Título'), admin: { width: '50%' } },
            {
              name: 'titleB',
              type: 'text',
              localized: true,
              defaultValue: heroDefault('titleB'),
              label: l('Suite du titre, en or', 'Rest of the title, in gold', 'Rest des Titels, in Gold', 'Resto do título, a dourado'),
              admin: { width: '50%' },
            },
          ],
        },
        { name: 'subtitle', type: 'textarea', localized: true, defaultValue: heroDefault('subtitle'), label: l('Sous-titre', 'Subtitle', 'Untertitel', 'Subtítulo') },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: l('Photo de fond', 'Background photo', 'Hintergrundfoto', 'Foto de fundo'),
          admin: {
            description: l(
              'Vide : la photo actuelle du verre de vin.',
              'Empty: the current wine-glass photo.',
              'Leer: das aktuelle Weinglas-Foto.',
              'Vazio: a foto atual do copo de vinho.',
            ),
          },
        },
      ],
    },
  ],
};

export const cmsGlobals: GlobalConfig[] = [homePage, header, footer, happyHour];
