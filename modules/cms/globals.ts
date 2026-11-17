import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff, publicRead } from '@/lib/access';
import { l, type Label, linkTo, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';

const editable = { read: publicRead, update: isStaff('manager') };
const rowLabel = { components: { RowLabel: '@/components/admin/row-label' } };
// One compact row per link: its text and the page it leads to (a list, not a typed path).
const link: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'label',
        type: 'text',
        localized: true,
        required: true,
        label: l('Texte du lien', 'Link text', 'Linktext', 'Texto da ligação'),
        admin: { width: '50%' },
      },
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
    {
      name: 'tagline',
      type: 'textarea',
      localized: true,
      label: l('Phrase sous le logo', 'Line under the logo', 'Satz unter dem Logo', 'Frase por baixo do logótipo'),
    },
    {
      name: 'columns',
      label: l('Colonnes de liens', 'Link columns', 'Linkspalten', 'Colunas de ligações'),
      labels: {
        singular: l('Colonne', 'Column', 'Spalte', 'Coluna'),
        plural: l('Colonnes', 'Columns', 'Spalten', 'Colunas'),
      },
      type: 'array',
      maxRows: 3,
      admin: { initCollapsed: true, ...rowLabel },
      fields: [
        {
          name: 'title',
          type: 'text',
          localized: true,
          required: true,
          label: l('Titre de la colonne', 'Column title', 'Spaltentitel', 'Título da coluna'),
        },
        {
          name: 'links',
          label: l('Liens', 'Links', 'Links', 'Ligações'),
          labels: linkLabels,
          type: 'array',
          admin: rowLabel,
          fields: link,
        },
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
        description: l(
          'Décochez pour cacher la section.',
          'Untick to hide the section.',
          'Abwählen, um den Bereich auszublenden.',
          'Desmarque para esconder a secção.',
        ),
      },
    },
    {
      name: 'days',
      type: 'select',
      hasMany: true,
      required: true,
      options: WEEKDAYS,
      label: l('Jours', 'Days', 'Tage', 'Dias'),
    },
    {
      type: 'row',
      fields: [
        timeOfDay('from', l('De', 'From', 'Von', 'Das'), '50%'),
        timeOfDay('to', l('À', 'To', 'Bis', 'Às'), '50%'),
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'titleA',
          type: 'text',
          localized: true,
          required: true,
          label: l('Titre', 'Title', 'Titel', 'Título'),
          admin: { width: '50%' },
        },
        {
          name: 'titleB',
          type: 'text',
          localized: true,
          label: l(
            'Suite du titre, en or',
            'Rest of the title, in gold',
            'Rest des Titels, in Gold',
            'Resto do título, a dourado',
          ),
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

// The home page (client request 17 Nov): the photos of its four banners. Their titles are the site's texts.
const banner = (name: string, label: Label): Field => ({ name, type: 'upload', relationTo: 'media', label, admin: { width: '50%' } });

export const homePage: GlobalConfig = {
  slug: 'HomePage',
  label: l('Page d’accueil', 'Home page', 'Startseite', 'Página inicial'),
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'Les photos de la page d’accueil. Les quatre bannières sont hautes et étroites sur ordinateur : une photo en hauteur (portrait, au moins 1400 px de haut) avec le sujet au centre rend le mieux.',
      'The home page’s photos. The four banners are tall and narrow on computers: an upright photo (portrait, at least 1400 px high) with its subject in the centre works best.',
      'Die Fotos der Startseite. Die vier Banner sind am Computer hoch und schmal: ein Hochformat-Foto (mindestens 1400 px hoch) mit dem Motiv in der Mitte wirkt am besten.',
      'As fotos da página inicial. As quatro faixas são altas e estreitas no computador: uma foto na vertical (pelo menos 1400 px de altura) com o tema ao centro fica melhor.',
    ),
    preview: (_, { locale }) => `/${locale}`,
  },
  access: editable,
  hooks: { afterChange: [revalidateTagHook('home')] },
  fields: [
    {
      name: 'photos',
      type: 'group',
      label: false,
      fields: [
        {
          type: 'row',
          fields: [
            banner('shop', l('Bannière 1 : Shop en ligne', 'Banner 1: Online shop', 'Banner 1: Online-Shop', 'Faixa 1: Loja online')),
            banner('table', l('Bannière 2 : Réserver une table', 'Banner 2: Book a table', 'Banner 2: Tisch reservieren', 'Faixa 2: Reservar uma mesa')),
            banner('catering', l('Bannière 3 : Services Catering', 'Banner 3: Catering services', 'Banner 3: Catering-Services', 'Faixa 3: Serviços de Catering')),
            banner('events', l('Bannière 4 : Événements', 'Banner 4: Events', 'Banner 4: Veranstaltungen', 'Faixa 4: Eventos')),
            banner('contact', l('Section Contact (page d’accueil)', 'Contact section (home page)', 'Kontaktbereich (Startseite)', 'Secção Contacto (página inicial)')),
            banner('interior', l('Intérieur de la boutique (page Contact)', 'Shop interior (Contact page)', 'Ladeninneres (Kontaktseite)', 'Interior da loja (página Contacto)')),
          ],
        },
      ],
    },
  ],
};

export const cmsGlobals: GlobalConfig[] = [homePage, header, footer, happyHour];
