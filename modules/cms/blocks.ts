import type { Block, Field } from 'payload';
import { type Label, l, linkTo } from '@/lib/admin';

// The CMS blocks of 05 §4. Text fields are localized one by one, so the block structure is shared by
// the four languages and an edit in EN never changes FR.
const text = (name: string, label: Label, required = false): Field => ({ name, type: 'text', localized: true, required, label });
const image = (required = false): Field => ({ name: 'image', type: 'upload', relationTo: 'media', required, label: l('Photo', 'Photo', 'Foto', 'Foto') });
const heading = (required = true): Field[] => [
  text('eyebrow', l('Petit titre au-dessus', 'Small line above', 'Kleine Zeile darüber', 'Linha pequena por cima')),
  {
    type: 'row',
    fields: [
      { ...text('titleA', l('Titre', 'Title', 'Titel', 'Título'), required), admin: { width: '50%' } } as Field,
      {
        name: 'titleB',
        type: 'text',
        localized: true,
        label: l('Suite du titre, en or', 'Rest of the title, in gold', 'Rest des Titels, in Gold', 'Resto do título, a dourado'),
        admin: { width: '50%' },
      },
    ],
  },
];
const name = (fr: string, en: string, de: string, pt: string) => ({ singular: l(fr, en, de, pt), plural: l(fr, en, de, pt) });
const body = (required = false): Field => ({ name: 'body', type: 'richText', localized: true, required, label: l('Texte', 'Text', 'Text', 'Texto') });
const subtitle: Field = { name: 'subtitle', type: 'textarea', localized: true, label: l('Sous-titre', 'Subtitle', 'Untertitel', 'Subtítulo') };

export const hero: Block = {
  slug: 'hero',
  labels: name('Grand titre avec photo', 'Big title with photo', 'Großer Titel mit Foto', 'Título grande com foto'),
  fields: [...heading(), subtitle, image()],
};

export const richText: Block = {
  slug: 'richText',
  labels: name('Texte', 'Text', 'Text', 'Texto'),
  fields: [body(true)],
};

export const mediaText: Block = {
  slug: 'mediaText',
  labels: name('Photo et texte côte à côte', 'Photo and text side by side', 'Foto und Text nebeneinander', 'Foto e texto lado a lado'),
  fields: [
    image(true),
    {
      name: 'imagePosition',
      type: 'select',
      required: true,
      defaultValue: 'left',
      label: l('Photo à', 'Photo on the', 'Foto auf der', 'Foto à'),
      options: [
        { value: 'left', label: l('Gauche', 'Left', 'Linken Seite', 'Esquerda') },
        { value: 'right', label: l('Droite', 'Right', 'Rechten Seite', 'Direita') },
      ],
    },
    ...heading(),
    body(),
  ],
};

export const cardGrid: Block = {
  slug: 'cardGrid',
  labels: name('Cartes', 'Cards', 'Karten', 'Cartões'),
  fields: [
    ...heading(false),
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'cards',
      label: l('Style', 'Style', 'Stil', 'Estilo'),
      options: [
        { value: 'hairline', label: l('Texte seul, lignes fines', 'Text only, fine lines', 'Nur Text, feine Linien', 'Só texto, linhas finas') },
        { value: 'cards', label: l('Cartes avec photo', 'Cards with photo', 'Karten mit Foto', 'Cartões com foto') },
        { value: 'dark', label: l('Bande sombre', 'Dark band', 'Dunkles Band', 'Faixa escura') },
      ],
    },
    {
      name: 'cards',
      type: 'array',
      minRows: 1,
      label: l('Cartes', 'Cards', 'Karten', 'Cartões'),
      labels: { singular: l('Carte', 'Card', 'Karte', 'Cartão'), plural: l('Cartes', 'Cards', 'Karten', 'Cartões') },
      admin: { components: { RowLabel: '@/components/admin/row-label' } },
      fields: [
        image(),
        text('eyebrow', l('Petit titre au-dessus', 'Small line above', 'Kleine Zeile darüber', 'Linha pequena por cima')),
        text('title', l('Titre', 'Title', 'Titel', 'Título'), true),
        { name: 'text', type: 'textarea', localized: true, label: l('Texte', 'Text', 'Text', 'Texto') },
      ],
    },
  ],
};

export const cta: Block = {
  slug: 'cta',
  labels: name('Appel à l’action', 'Call to action', 'Handlungsaufruf', 'Chamada para ação'),
  fields: [
    ...heading(),
    subtitle,
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
      label: l('Boutons', 'Buttons', 'Schaltflächen', 'Botões'),
      labels: { singular: l('Bouton', 'Button', 'Schaltfläche', 'Botão'), plural: l('Boutons', 'Buttons', 'Schaltflächen', 'Botões') },
      admin: { components: { RowLabel: '@/components/admin/row-label' } },
      fields: [
        {
          type: 'row',
          fields: [
            { ...text('label', l('Texte du bouton', 'Button text', 'Text der Schaltfläche', 'Texto do botão'), true), admin: { width: '40%' } } as Field,
            linkTo('35%'),
            {
              name: 'style',
              type: 'select',
              required: true,
              defaultValue: 'solid',
              label: l('Style', 'Style', 'Stil', 'Estilo'),
              options: [
                { value: 'solid', label: l('Plein', 'Filled', 'Gefüllt', 'Cheio') },
                { value: 'outline', label: l('Contour', 'Outline', 'Umriss', 'Contorno') },
              ],
              admin: { width: '25%' },
            },
          ],
        },
      ],
    },
  ],
};
