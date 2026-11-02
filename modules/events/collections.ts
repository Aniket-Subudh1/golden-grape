import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, published } from '@/lib/access';
import { autoSlug, createInDrawer, l, scaledNumber, seoSection } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';

const editors = isStaff('manager');

// Content only in M1.3; bookings (eventBookings, the `booked` counter) arrive in M2.3.
export const events: CollectionConfig = {
  slug: 'events',
  labels: {
    singular: l('Événement', 'Event', 'Veranstaltung', 'Evento'),
    plural: l('Événements', 'Events', 'Veranstaltungen', 'Eventos'),
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'priceCents', '_status'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les soirées et dégustations affichées sur la page Événements et sur la page d’accueil.',
      'The evenings and tastings shown on the Events page and on the home page.',
      'Abende und Verkostungen auf der Veranstaltungsseite und der Startseite.',
      'As noites e provas mostradas na página Eventos e na página inicial.',
    ),
    components: createInDrawer('events', l('Ajouter un événement', 'Add an event', 'Veranstaltung hinzufügen', 'Adicionar um evento')),
    preview: (doc, { locale }) => (doc.slug ? `/${locale}/events/${doc.slug}` : null),
  },
  versions: { drafts: true },
  access: { read: published, create: editors, update: editors, delete: editors },
  hooks: { afterChange: [revalidateTagHook('events')], afterDelete: [revalidateTagHook('events')] },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: l('Nom de l’événement', 'Name of the event', 'Name der Veranstaltung', 'Nome do evento') },
    autoSlug('events'),
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          index: true,
          label: l('Début', 'Starts', 'Beginn', 'Início'),
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
        {
          name: 'endsAt',
          type: 'date',
          label: l('Fin (facultatif)', 'Ends (optional)', 'Ende (optional)', 'Fim (opcional)'),
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      label: l('Description', 'Description', 'Beschreibung', 'Descrição'),
      admin: {
        description: l(
          'Deux ou trois phrases, affichées sous le nom.',
          'Two or three sentences, shown under the name.',
          'Zwei oder drei Sätze, unter dem Namen angezeigt.',
          'Duas ou três frases, mostradas por baixo do nome.',
        ),
      },
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: l('Photo', 'Photo', 'Foto', 'Foto') },
    {
      type: 'row',
      fields: [
        {
          name: 'priceCents',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
          label: l('Prix par personne', 'Price per person', 'Preis pro Person', 'Preço por pessoa'),
          admin: { width: '50%', description: l('0 = gratuit', '0 = free', '0 = kostenlos', '0 = grátis'), components: scaledNumber('€') },
        },
        {
          name: 'capacity',
          type: 'number',
          min: 1,
          label: l('Places (facultatif)', 'Seats (optional)', 'Plätze (optional)', 'Lugares (opcional)'),
          admin: { width: '50%' },
        },
      ],
    },
    // Filled by bookings from M2.3; never typed by staff.
    { name: 'booked', type: 'number', defaultValue: 0, access: { create: () => false, update: () => false }, admin: { hidden: true } },
    seoSection([
      { name: 'title', type: 'text', localized: true, label: l('Titre dans Google', 'Title in Google', 'Titel bei Google', 'Título no Google') },
      { name: 'description', type: 'textarea', localized: true, label: l('Texte dans Google', 'Text in Google', 'Text bei Google', 'Texto no Google') },
    ]),
  ],
};
