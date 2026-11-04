import type { Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { type Label, l, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { revalidateTagHook } from '@/lib/revalidate';

export const MODULES = ['b2b', 'purchasing', 'promotions', 'loyalty', 'giftCards', 'reviews', 'attendance', 'pos'] as const;
export type ModuleName = (typeof MODULES)[number];

const text = (name: string, label: Label, required = false, width = '50%'): Field => ({ name, type: 'text', required, label, admin: { width } });
const def = (name: string, defaultValue: string): Field => ({ name, type: 'text', defaultValue });
const row = (...fields: Field[]): Field => ({ type: 'row', fields });
// Kept in the data but not shown: nothing uses them before the shop and invoices (M2/M3), where they come back in
// everyday words (docs/03-CODING-LAWS.md: a screen shows only what a feature uses).
const later = { hidden: true };

export const businessSettings: GlobalConfig = {
  slug: 'BusinessSettings',
  label: l('Infos de la boutique', 'Shop details', 'Geschäftsdaten', 'Dados da loja'),
  admin: {
    hidden: hiddenUnless('manager'),
    description: l(
      'Adresse, contact, horaires et réseaux sociaux, affichés partout sur le site.',
      'Address, contact, opening hours and social links, shown all over the website.',
      'Adresse, Kontakt, Öffnungszeiten und soziale Netzwerke, überall auf der Website.',
      'Morada, contacto, horário e redes sociais, mostrados em todo o site.',
    ),
    preview: (_, { locale }) => `/${locale}/contact`,
  },
  // Public pages read it only through getSettings(), which strips bank and internal fields.
  access: { read: isStaff('manager'), update: isStaff('manager') },
  hooks: { afterChange: [revalidateTagHook('settings')] },
  fields: [
    {
      // Unnamed tabs only group the form; the stored data keeps its shape.
      type: 'tabs',
      tabs: [
        {
          label: l('Boutique et contact', 'Shop and contact', 'Geschäft und Kontakt', 'Loja e contacto'),
          fields: [
            {
              name: 'business',
              type: 'group',
              label: false,
              fields: [
                row(
                  text('name', l('Nom de la boutique', 'Shop name', 'Name des Geschäfts', 'Nome da loja'), true),
                  text('legalName', l('Nom officiel de la société', 'Official company name', 'Offizieller Firmenname', 'Nome oficial da empresa')),
                ),
                row(
                  text('phone', l('Téléphone', 'Phone', 'Telefon', 'Telefone')),
                  { name: 'email', type: 'email', label: l('E-mail', 'E-mail', 'E-Mail', 'E-mail'), admin: { width: '50%' } },
                ),
                row(
                  text('street', l('Rue et numéro', 'Street and number', 'Straße und Hausnummer', 'Rua e número'), true),
                  text('postalCode', l('Code postal', 'Postcode', 'Postleitzahl', 'Código postal'), true, '20%'),
                  text('city', l('Ville', 'Town', 'Ort', 'Localidade'), true, '30%'),
                ),
                row(
                  { name: 'country', type: 'text', defaultValue: 'Luxembourg', label: l('Pays', 'Country', 'Land', 'País'), admin: { width: '50%' } },
                  {
                    name: 'mapsUrl',
                    type: 'text',
                    label: l('Lien Google Maps (facultatif)', 'Google Maps link (optional)', 'Google-Maps-Link (optional)', 'Ligação do Google Maps (opcional)'),
                    admin: {
                      width: '50%',
                      description: l(
                        'Vide : l’itinéraire est cherché avec l’adresse.',
                        'Empty: directions are found from the address.',
                        'Leer: die Route wird über die Adresse gesucht.',
                        'Vazio: o caminho é procurado pela morada.',
                      ),
                    },
                  },
                ),
                row(
                  text('instagram', l('Page Instagram (lien)', 'Instagram page (link)', 'Instagram-Seite (Link)', 'Página do Instagram (ligação)')),
                  text('facebook', l('Page Facebook (lien)', 'Facebook page (link)', 'Facebook-Seite (Link)', 'Página do Facebook (ligação)')),
                ),
                row(
                  text('vatNumber', l('Numéro de TVA', 'VAT number', 'USt-IdNr.', 'Número de IVA')),
                  { name: 'rcs', type: 'text', label: l('Numéro RCS', 'RCS number', 'RCS-Nummer', 'Número RCS'), admin: { width: '50%' } },
                ),
                row(
                  {
                    name: 'latitude',
                    type: 'number',
                    min: -90,
                    max: 90,
                    label: l('Latitude GPS (facultatif)', 'GPS latitude (optional)', 'GPS-Breitengrad (optional)', 'Latitude GPS (opcional)'),
                    admin: { width: '50%', step: 0.000001, placeholder: '49.7881' },
                  },
                  {
                    name: 'longitude',
                    type: 'number',
                    min: -180,
                    max: 180,
                    label: l('Longitude GPS (facultatif)', 'GPS longitude (optional)', 'GPS-Längengrad (optional)', 'Longitude GPS (opcional)'),
                    admin: {
                      width: '50%',
                      step: 0.000001,
                      placeholder: '6.0661',
                      description: l(
                        'Pour placer la boutique sur Google. Clic droit sur la boutique dans Google Maps pour les copier.',
                        'Places the shop on Google. Right-click the shop in Google Maps to copy them.',
                        'Platziert den Laden bei Google. Rechtsklick auf den Laden in Google Maps zum Kopieren.',
                        'Coloca a loja no Google. Clique com o botão direito na loja no Google Maps para as copiar.',
                      ),
                    },
                  },
                ),
                { name: 'iban', type: 'text', admin: later },
                { name: 'bic', type: 'text', admin: later },
              ],
            },
          ],
        },
        {
          label: l('Horaires', 'Opening hours', 'Öffnungszeiten', 'Horário'),
          fields: [
            {
              name: 'hours',
              type: 'array',
              label: l('Horaires d’ouverture', 'Opening hours', 'Öffnungszeiten', 'Horário de abertura'),
              labels: { singular: l('Créneau', 'Time slot', 'Zeitfenster', 'Horário'), plural: l('Créneaux', 'Time slots', 'Zeitfenster', 'Horários') },
              admin: {
                description: l(
                  'Une ligne par jour d’ouverture (deux lignes si vous fermez à midi). Un jour sans ligne est fermé.',
                  'One line per open day (two lines if you close at lunchtime). A day without a line is closed.',
                  'Eine Zeile pro Öffnungstag (zwei, wenn Sie mittags schließen). Ein Tag ohne Zeile ist geschlossen.',
                  'Uma linha por dia aberto (duas se fechar ao almoço). Um dia sem linha está fechado.',
                ),
              },
              fields: [
                row(
                  { name: 'day', type: 'select', required: true, options: WEEKDAYS, label: l('Jour', 'Day', 'Tag', 'Dia'), admin: { width: '40%', isClearable: false } },
                  timeOfDay('open', l('Ouvre à', 'Opens at', 'Öffnet um', 'Abre às'), '30%'),
                  timeOfDay('close', l('Ferme à', 'Closes at', 'Schließt um', 'Fecha às'), '30%'),
                ),
              ],
            },
            {
              name: 'closedDates',
              type: 'array',
              label: l('Jours de fermeture exceptionnelle', 'Extra closing days', 'Zusätzliche Schließtage', 'Dias de fecho extra'),
              labels: { singular: l('Jour', 'Day', 'Tag', 'Dia'), plural: l('Jours', 'Days', 'Tage', 'Dias') },
              admin: {
                description: l(
                  'Jours fériés, vacances : le site affiche « fermé » ce jour-là.',
                  'Public holidays, holidays: the website shows “closed” that day.',
                  'Feiertage, Urlaub: Die Website zeigt an diesem Tag „geschlossen“.',
                  'Feriados, férias: o site mostra «fechado» nesse dia.',
                ),
              },
              fields: [
                {
                  name: 'date',
                  type: 'date',
                  required: true,
                  label: l('Date', 'Date', 'Datum', 'Data'),
                  admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'vat',
      type: 'array',
      admin: later,
      fields: [
        { name: 'key', type: 'select', required: true, options: ['standard', 'intermediate', 'reduced', 'superReduced'] },
        { name: 'rateBp', type: 'number', required: true, min: 0 },
      ],
    },
    {
      name: 'numbering',
      type: 'group',
      admin: later,
      fields: [
        def('invoice', 'INV-{YYYY}-{00000}'),
        def('creditNote', 'CN-{YYYY}-{00000}'),
        def('quotation', 'QUO-{YYYY}-{00000}'),
        def('deliveryNote', 'DN-{YYYY}-{00000}'),
        def('order', 'ORD-{YYYY}-{00000}'),
        def('cateringRequest', 'REQ-{YYYY}-{0000}'),
      ],
    },
    {
      name: 'alerts',
      type: 'group',
      admin: later,
      fields: [
        { name: 'defaultLowStock', type: 'number', defaultValue: 3, min: 0 },
        { name: 'lowStockEmail', type: 'email' },
        { name: 'outboxAlertEmail', type: 'email' },
      ],
    },
    { name: 'modules', type: 'group', admin: later, fields: MODULES.map((name): Field => ({ name, type: 'checkbox', defaultValue: false })) },
    {
      name: 'paymentTerms',
      type: 'array',
      admin: later,
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'days', type: 'number', required: true, min: 0 },
        { name: 'label', type: 'text', required: true, localized: true },
      ],
    },
  ],
};
