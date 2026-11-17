import type { PayloadRequest, Field, GlobalConfig } from 'payload';
import { hiddenUnless, isStaff } from '@/lib/access';
import { type Label, l, say, scaledNumber, timeOfDay, WEEKDAYS } from '@/lib/admin';
import { isBic, isIban, withOneDefault } from './iban';
import { revalidateTagHook } from '@/lib/revalidate';

export const MODULES = ['b2b', 'purchasing', 'promotions', 'loyalty', 'giftCards', 'reviews', 'attendance', 'pos'] as const;
export type ModuleName = (typeof MODULES)[number];

const MODULE_LABELS: Record<ModuleName, Label> = {
  b2b: l('Clients professionnels (B2B)', 'Business customers (B2B)', 'Geschäftskunden (B2B)', 'Clientes profissionais (B2B)'),
  purchasing: l('Achats et réceptions', 'Purchasing and deliveries', 'Einkauf und Wareneingang', 'Compras e receções'),
  promotions: l('Promotions et codes', 'Promotions and codes', 'Aktionen und Codes', 'Promoções e códigos'),
  loyalty: l('Fidélité', 'Loyalty', 'Treueprogramm', 'Fidelização'),
  giftCards: l('Cartes cadeaux', 'Gift cards', 'Geschenkkarten', 'Cartões-presente'),
  reviews: l('Avis Google', 'Google reviews', 'Google-Bewertungen', 'Avaliações Google'),
  attendance: l('Pointage', 'Time clock', 'Zeiterfassung', 'Ponto'),
  pos: l('Caisse', 'Till', 'Kasse', 'Caixa'),
};

/**
 * Reference formats, French prefixes everywhere (APPLUX, 9 Nov): DEM request, DEV quotation, FAC invoice, CMD order,
 * RES reservation, AV credit note, BL delivery note. The defaults of BusinessSettings › numbering and the services'
 * fallback; a saved format wins. Changing one never renumbers: the counter series stay the same.
 */
export const NUMBERING = {
  invoice: 'FAC-{YYYY}-{00000}',
  creditNote: 'AV-{YYYY}-{00000}',
  quotation: 'DEV-{YYYY}-{0000}',
  deliveryNote: 'BL-{YYYY}-{00000}',
  order: 'CMD-{YYYY}-{00000}',
  purchase: 'BCF-{YYYY}-{00000}',
  cateringRequest: 'DEM-{YYYY}-{0000}',
  reservation: 'RES-{YYYY}-{00000}',
  // Till sales imported from the POS file (M3.3 T5): their own series, so the shop's CMD numbers stay the shop's.
  pos: 'POS-{YYYY}-{00000}',
} as const;

const text = (name: string, label: Label, required = false, width = '50%'): Field => ({ name, type: 'text', required, label, admin: { width } });
const def = (name: string, defaultValue: string): Field => ({ name, type: 'text', defaultValue });
const row = (...fields: Field[]): Field => ({ type: 'row', fields });
// Kept in the data but not shown: nothing uses them before the shop and invoices (M2/M3), where they come back in
// everyday words (docs/03-CODING-LAWS.md: a screen shows only what a feature uses).
const later = { hidden: true };

/** The conditions a new catering quotation starts with until Golden Grape writes its own (Shop details › Devis catering). */
const QUOTATION_CONDITIONS = {
  fr: 'Prix TTC. Le nombre définitif de convives est à confirmer au plus tard 7 jours avant la prestation ; il sert de base à la facture. Toute prestation supplémentaire fait l’objet d’un nouveau devis. Ce devis est valable jusqu’à la date indiquée.',
  en: 'Prices include VAT. The final number of guests is to be confirmed at least 7 days before the event; the invoice is based on it. Any additional service is subject to a new quotation. This quotation is valid until the date shown.',
  de: 'Preise inkl. MwSt. Die endgültige Gästezahl ist spätestens 7 Tage vor der Veranstaltung zu bestätigen; sie ist die Grundlage der Rechnung. Zusätzliche Leistungen werden neu angeboten. Dieses Angebot gilt bis zum angegebenen Datum.',
  pt: 'Preços com IVA incluído. O número final de convidados deve ser confirmado até 7 dias antes do evento; serve de base à fatura. Qualquer serviço adicional é objeto de um novo orçamento. Este orçamento é válido até à data indicada.',
};

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
                        'Pour ouvrir exactement votre fiche : sur Google Maps, votre établissement › Partager › Copier le lien. Vide : recherche du nom et de l’adresse.',
                        'To open your exact listing: on Google Maps, your business › Share › Copy link. Empty: a search for the name and address.',
                        'Für genau Ihren Eintrag: in Google Maps Ihr Geschäft › Teilen › Link kopieren. Leer: Suche nach Name und Adresse.',
                        'Para abrir exatamente a sua ficha: no Google Maps, o seu estabelecimento › Partilhar › Copiar link. Vazio: pesquisa do nome e da morada.',
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
                // The accounts customers pay into by bank transfer (APPLUX, 12 Nov): as many as needed, one default. A
                // new transfer order gets the default one; staff can choose another on the order. Only the order's own
                // account is shown to its customer (order page and e-mail), with the order number as reference.
                {
                  name: 'bankAccounts',
                  type: 'array',
                  label: l('Comptes bancaires (pour les virements)', 'Bank accounts (for transfers)', 'Bankkonten (für Überweisungen)', 'Contas bancárias (para transferências)'),
                  labels: {
                    singular: l('Compte bancaire', 'Bank account', 'Bankkonto', 'Conta bancária'),
                    plural: l('Comptes bancaires', 'Bank accounts', 'Bankkonten', 'Contas bancárias'),
                  },
                  hooks: { beforeChange: [({ value }) => (Array.isArray(value) ? withOneDefault(value) : value)] },
                  admin: {
                    components: { RowLabel: '@/components/admin/row-label' },
                    description: l(
                      'Le compte « par défaut » est proposé aux clients qui paient par virement. Un compte désactivé n’est plus proposé ; les commandes déjà passées gardent le leur.',
                      'The “default” account is given to customers who pay by transfer. A deactivated account is no longer offered; orders already placed keep theirs.',
                      'Das „Standard“-Konto wird Kunden mit Überweisung genannt. Ein deaktiviertes Konto wird nicht mehr angeboten; bestehende Bestellungen behalten ihres.',
                      'A conta «predefinida» é indicada aos clientes que pagam por transferência. Uma conta desativada deixa de ser proposta; as encomendas já feitas mantêm a sua.',
                    ),
                  },
                  fields: [
                    row(
                      { name: 'holder', type: 'text', required: true, label: l('Titulaire du compte', 'Account holder', 'Kontoinhaber', 'Titular da conta'), admin: { width: '50%' } },
                      { name: 'bankName', type: 'text', label: l('Banque (facultatif)', 'Bank (optional)', 'Bank (optional)', 'Banco (opcional)'), admin: { width: '50%' } },
                    ),
                    row(
                      {
                        name: 'iban',
                        type: 'text',
                        required: true,
                        label: l('IBAN', 'IBAN', 'IBAN', 'IBAN'),
                        // GG-014: only a real IBAN (check digits verified, published examples refused) reaches customers.
                        validate: (value: string | null | undefined, { req }: { req: PayloadRequest }) =>
                          (Boolean(value) && isIban(value!)) ||
                          say(
                            req,
                            l(
                              'IBAN invalide : vérifiez-le sur votre relevé bancaire (LU suivi de 18 chiffres).',
                              'Invalid IBAN: check it on your bank statement (LU followed by 18 digits).',
                              'Ungültige IBAN: Bitte auf dem Kontoauszug prüfen (LU gefolgt von 18 Ziffern).',
                              'IBAN inválido: verifique-o no extrato bancário (LU seguido de 18 algarismos).',
                            ),
                          ),
                        admin: { width: '60%', placeholder: 'LU.. .... .... .... ....' },
                      },
                      {
                        name: 'bic',
                        type: 'text',
                        label: l('BIC', 'BIC', 'BIC', 'BIC'),
                        validate: (value: string | null | undefined, { req }: { req: PayloadRequest }) =>
                          !value ||
                          isBic(value) ||
                          say(req, l('BIC invalide : 8 ou 11 caractères.', 'Invalid BIC: 8 or 11 characters.', 'Ungültiger BIC: 8 oder 11 Zeichen.', 'BIC inválido: 8 ou 11 caracteres.')),
                        admin: { width: '40%', placeholder: 'XXXXLULL' },
                      },
                    ),
                    row(
                      { name: 'active', type: 'checkbox', defaultValue: true, label: l('Actif', 'Active', 'Aktiv', 'Ativa'), admin: { width: '50%' } },
                      { name: 'isDefault', type: 'checkbox', defaultValue: false, label: l('Compte par défaut', 'Default account', 'Standardkonto', 'Conta predefinida'), admin: { width: '50%' } },
                    ),
                  ],
                },
              ],
            },
          ],
        },
        {
          label: l('Horaires', 'Opening hours', 'Öffnungszeiten', 'Horário'),
          fields: [
            // GG-023: tick several days, give the hours once.
            { name: 'hoursBulk', type: 'ui', admin: { components: { Field: { path: '@/components/admin/weekday-bulk', clientProps: { array: 'hours' } } } } },
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
        {
          // Catering quotations (Q-12): what every new quotation starts with; staff can change them per quotation.
          label: l('Devis catering', 'Catering quotations', 'Catering-Angebote', 'Orçamentos de catering'),
          fields: [
            {
              name: 'quotationConditions',
              type: 'textarea',
              localized: true,
              label: l('Conditions des devis', 'Quotation conditions', 'Angebotsbedingungen', 'Condições dos orçamentos'),
              defaultValue: ({ locale }: { locale?: string }) => QUOTATION_CONDITIONS[(locale ?? 'fr') as keyof typeof QUOTATION_CONDITIONS] ?? QUOTATION_CONDITIONS.fr,
              admin: {
                rows: 6,
                description: l(
                  'Imprimées sur chaque nouveau devis, dans la langue du client. Modifiables devis par devis.',
                  'Printed on every new quotation, in the customer’s language. Can be changed on each quotation.',
                  'Auf jedes neue Angebot gedruckt, in der Sprache des Kunden. Pro Angebot änderbar.',
                  'Impressas em cada novo orçamento, na língua do cliente. Podem ser alteradas em cada orçamento.',
                ),
              },
            },
            {
              name: 'quotationValidityDays',
              type: 'number',
              min: 1,
              defaultValue: 30,
              label: l('Validité d’un devis (jours)', 'Quotation valid for (days)', 'Angebot gültig (Tage)', 'Validade do orçamento (dias)'),
              admin: { width: '50%' },
            },
          ],
        },
        {
          // Invoices, delivery notes and credit notes (M3.2 T5). Until the accountant's mentions are entered (DEP-07),
          // every PDF carries "BROUILLON – en attente du comptable" (A-07).
          label: l('Factures', 'Invoices', 'Rechnungen', 'Faturas'),
          fields: [
            {
              name: 'invoiceLegal',
              type: 'textarea',
              localized: true,
              label: l('Mentions légales des factures', 'Legal mentions on invoices', 'Pflichtangaben auf Rechnungen', 'Menções legais das faturas'),
              admin: {
                rows: 4,
                description: l(
                  'Texte imprimé en bas de chaque facture et avoir (fourni par le comptable). Tant qu’il est vide, les documents portent « BROUILLON ».',
                  'Printed at the bottom of every invoice and credit note (given by the accountant). While it is empty, documents say “DRAFT”.',
                  'Wird unten auf jede Rechnung und Gutschrift gedruckt (vom Steuerberater). Solange leer, tragen die Dokumente „ENTWURF“.',
                  'Impresso no fundo de cada fatura e nota de crédito (dado pelo contabilista). Enquanto vazio, os documentos dizem «RASCUNHO».',
                ),
              },
            },
            {
              name: 'invoicePaymentNote',
              type: 'textarea',
              localized: true,
              label: l('Note de paiement', 'Payment note', 'Zahlungshinweis', 'Nota de pagamento'),
              admin: { rows: 2, description: l('Par ex. « Merci d’indiquer le numéro de facture avec votre virement. »', 'E.g. “Please quote the invoice number with your transfer.”', 'Z. B. „Bitte geben Sie die Rechnungsnummer bei der Überweisung an.“', 'Ex. «Indique o número da fatura na transferência.»') },
            },
          ],
        },
        {
          // Module switches (R9) and who gets the automatic alerts (M3.1): shown once purchasing needed them.
          label: l('Modules et alertes', 'Modules and alerts', 'Module und Warnungen', 'Módulos e alertas'),
          fields: [
            {
              name: 'modules',
              type: 'group',
              label: l('Modules activés', 'Modules switched on', 'Aktive Module', 'Módulos ativos'),
              admin: {
                description: l(
                  'Un module éteint disparaît du site, de l’espace équipe et du menu de gestion. Rien n’est effacé.',
                  'A module switched off disappears from the website, the team screens and the back-office menu. Nothing is deleted.',
                  'Ein ausgeschaltetes Modul verschwindet von der Website, den Teambildschirmen und dem Verwaltungsmenü. Nichts wird gelöscht.',
                  'Um módulo desligado desaparece do site, dos ecrãs da equipa e do menu de gestão. Nada é apagado.',
                ),
              },
              fields: MODULES.map((name): Field => ({ name, type: 'checkbox', defaultValue: false, label: MODULE_LABELS[name] })),
            },
            {
              name: 'alerts',
              type: 'group',
              label: l('Alertes', 'Alerts', 'Warnungen', 'Alertas'),
              fields: [
                row(
                  {
                    name: 'defaultLowStock',
                    type: 'number',
                    defaultValue: 3,
                    min: 0,
                    label: l('Seuil de stock bas par défaut', 'Default low-stock level', 'Standard-Warnschwelle', 'Nível de stock baixo por defeito'),
                    admin: { width: '50%', description: l('Pour les articles sans seuil propre.', 'For items without their own level.', 'Für Artikel ohne eigene Schwelle.', 'Para artigos sem nível próprio.') },
                  },
                  {
                    name: 'lowStockEmail',
                    type: 'email',
                    label: l('E-mail du stock bas (chaque matin)', 'Low-stock e-mail (every morning)', 'E-Mail bei niedrigem Bestand (jeden Morgen)', 'E-mail de stock baixo (todas as manhãs)'),
                    admin: { width: '50%' },
                  },
                ),
                {
                  name: 'outboxAlertEmail',
                  type: 'email',
                  label: l('E-mail si la caisse ne reçoit plus les commandes', 'E-mail when the till stops receiving orders', 'E-Mail, wenn die Kasse keine Bestellungen mehr erhält', 'E-mail quando a caixa deixa de receber encomendas'),
                  admin: { condition: (data) => data?.modules?.pos === true, description: l('Après 5 essais sans succès.', 'After 5 failed attempts.', 'Nach 5 erfolglosen Versuchen.', 'Após 5 tentativas falhadas.') },
                },
              ],
            },
            {
              // Loyalty points (M3.2 T3): earned when an order is completed (A-08), spent like money, expired oldest first.
              name: 'loyalty',
              type: 'group',
              label: l('Fidélité', 'Loyalty', 'Treueprogramm', 'Fidelização'),
              admin: { condition: (data) => data?.modules?.loyalty === true },
              fields: [
                row(
                  { name: 'pointsPerEuro', type: 'number', defaultValue: 1, min: 0, label: l('Points par euro dépensé', 'Points per euro spent', 'Punkte pro ausgegebenem Euro', 'Pontos por euro gasto'), admin: { width: '33%' } },
                  {
                    name: 'pointValueCents',
                    type: 'number',
                    defaultValue: 5,
                    min: 1,
                    label: l('Valeur d’un point', 'Value of a point', 'Wert eines Punktes', 'Valor de um ponto'),
                    admin: { width: '33%', components: scaledNumber('€') },
                  },
                  { name: 'expiryMonths', type: 'number', defaultValue: 24, min: 1, label: l('Validité (mois)', 'Valid for (months)', 'Gültig (Monate)', 'Validade (meses)'), admin: { width: '33%' } },
                ),
                {
                  name: 'eligibleChannels',
                  type: 'select',
                  hasMany: true,
                  defaultValue: ['webshop', 'mobile'],
                  options: [
                    { value: 'webshop', label: l('Site', 'Website', 'Website', 'Site') },
                    { value: 'mobile', label: l('Vente équipe', 'Staff sale', 'Teamverkauf', 'Venda equipa') },
                  ],
                  label: l('Où l’on gagne des points', 'Where points are earned', 'Wo Punkte gesammelt werden', 'Onde se ganham pontos'),
                },
              ],
            },
            {
              name: 'giftCards',
              type: 'group',
              label: l('Cartes cadeaux', 'Gift cards', 'Geschenkkarten', 'Cartões-presente'),
              admin: { condition: (data) => data?.modules?.giftCards === true },
              fields: [{ name: 'validityMonths', type: 'number', defaultValue: 24, min: 1, label: l('Validité d’une carte (mois)', 'A card is valid for (months)', 'Gültigkeit einer Karte (Monate)', 'Validade de um cartão (meses)') }],
            },
            {
              // Google reviews (M3.3 T1): which place, and where the review QR leads.
              name: 'reviews',
              type: 'group',
              label: l('Avis Google', 'Google reviews', 'Google-Bewertungen', 'Avaliações Google'),
              admin: { condition: (data) => data?.modules?.reviews === true },
              fields: [
                row(
                  {
                    name: 'placeId',
                    type: 'text',
                    label: l('Identifiant Google du lieu (Place ID)', 'Google Place ID', 'Google Place ID', 'Place ID do Google'),
                    admin: { width: '50%', description: l('Trouvé avec l’outil « Place ID Finder » de Google.', 'Found with Google’s “Place ID Finder”.', 'Mit Googles „Place ID Finder“ zu finden.', 'Encontrado com o «Place ID Finder» do Google.') },
                  },
                  {
                    name: 'reviewUrl',
                    type: 'text',
                    label: l('Lien « Laisser un avis » (facultatif)', '“Leave a review” link (optional)', 'Link „Bewertung schreiben“ (optional)', 'Ligação «Deixar uma avaliação» (opcional)'),
                    admin: { width: '50%', description: l('Vide : le formulaire d’avis Google du lieu.', 'Empty: the place’s Google review form.', 'Leer: das Google-Bewertungsformular des Orts.', 'Vazio: o formulário de avaliação Google do local.') },
                  },
                ),
              ],
            },
            {
              // The till's daily sales file (M3.3 T5): the column names of its export (A-10 until a real CashMag sample).
              name: 'pos',
              type: 'group',
              label: l('Caisse (fichier des ventes)', 'Till (sales file)', 'Kasse (Verkaufsdatei)', 'Caixa (ficheiro de vendas)'),
              admin: {
                condition: (data) => data?.modules?.pos === true,
                description: l(
                  'Le nom de chaque colonne dans l’export journalier de la caisse. Majuscules, accents et espaces ne comptent pas.',
                  'The name of each column in the till’s daily export. Case, accents and spaces do not matter.',
                  'Der Name jeder Spalte im täglichen Kassenexport. Groß-/Kleinschreibung, Akzente und Leerzeichen zählen nicht.',
                  'O nome de cada coluna na exportação diária da caixa. Maiúsculas, acentos e espaços não contam.',
                ),
              },
              fields: [
                {
                  name: 'csvMapping',
                  type: 'group',
                  label: l('Colonnes', 'Columns', 'Spalten', 'Colunas'),
                  fields: [
                    row(
                      { name: 'receipt', type: 'text', defaultValue: 'Ticket', label: l('N° de ticket', 'Receipt number', 'Bonnummer', 'N.º do talão'), admin: { width: '33%' } },
                      { name: 'date', type: 'text', defaultValue: 'Date', label: l('Date', 'Date', 'Datum', 'Data'), admin: { width: '33%' } },
                      { name: 'time', type: 'text', defaultValue: 'Heure', label: l('Heure (facultatif)', 'Time (optional)', 'Uhrzeit (optional)', 'Hora (opcional)'), admin: { width: '33%' } },
                    ),
                    row(
                      { name: 'barcode', type: 'text', defaultValue: 'Code barre', label: l('Code-barres', 'Barcode', 'Strichcode', 'Código de barras'), admin: { width: '50%' } },
                      { name: 'ref', type: 'text', defaultValue: 'Référence', label: l('Référence (SKU)', 'Reference (SKU)', 'Artikelnummer (SKU)', 'Referência (SKU)'), admin: { width: '50%' } },
                    ),
                    row(
                      { name: 'qty', type: 'text', defaultValue: 'Quantité', label: l('Quantité', 'Quantity', 'Menge', 'Quantidade'), admin: { width: '50%' } },
                      { name: 'unitPrice', type: 'text', defaultValue: 'Prix unitaire TTC', label: l('Prix unitaire TTC', 'Unit price incl. VAT', 'Stückpreis inkl. MwSt.', 'Preço unitário c/ IVA'), admin: { width: '50%' } },
                    ),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // Team & access (/admin/team): the areas each role is given on top of its own. Edited there only.
      name: 'access',
      type: 'group',
      admin: later,
      fields: [{ name: 'grants', type: 'json' }],
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
      fields: Object.entries(NUMBERING).map(([name, format]) => def(name, format)),
    },
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
