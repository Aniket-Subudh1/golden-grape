import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { de } from '@payloadcms/translations/languages/de';
import { en } from '@payloadcms/translations/languages/en';
import { fr } from '@payloadcms/translations/languages/fr';
import { pt } from '@payloadcms/translations/languages/pt';
import { s3Storage } from '@payloadcms/storage-s3';
import type { CreateIndexesOptions, IndexSpecification } from 'mongodb';
import { baseIDField, buildConfig, type CollectionConfig, type Field, type GlobalConfig } from 'payload';
import sharp from 'sharp';
import { auditGlobalHook, auditHooks } from '@/lib/audit';
import { env, isBuildPhase, s3Configured, smtpConfigured } from '@/lib/env';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { cmsCollections } from '@/modules/cms/collections';
import { cmsGlobals } from '@/modules/cms/globals';
import { catalogueCollections } from '@/modules/catalogue/collections';
import { customerGroups, customers } from '@/modules/customers/collections';
import { cateringPackages, cateringRequests } from '@/modules/catering/collections';
import { documentCollections } from '@/modules/documents/collections';
import { eventBookings, events } from '@/modules/events/collections';
import { payments } from '@/modules/payments/collections';
import { salesCollections } from '@/modules/sales/collections';
import { inventoryCollections } from '@/modules/inventory/collections';
import { settingsCollections } from '@/modules/settings/collections';
import { businessSettings } from '@/modules/settings/globals';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// "Golden Grape <hello@goldengrape.lu>" → name + address for Payload's own e-mails (staff password reset).
const from = () => {
  const match = /^(.*)<(.+)>$/.exec(env.MAIL_FROM);
  return { defaultFromName: match?.[1].trim() || 'Golden Grape', defaultFromAddress: (match?.[2] ?? env.MAIL_FROM).trim() };
};

// GG-046: every edit made by staff in the admin forms goes to the activity log (lib/audit.ts). Not the log itself, the
// technical collections, nor what only the services write (they keep their own history and log their actions).
const NOT_AUDITED = new Set(['auditLogs', 'rateLimits', 'counters', 'orders', 'reservations', 'eventBookings', 'payments', 'stockMovements', 'stockLevels', 'quotations', 'documentFiles']);
const withAudit = (c: CollectionConfig): CollectionConfig => {
  if (NOT_AUDITED.has(c.slug)) return c;
  const hooks = auditHooks();
  return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), ...hooks.afterChange], afterDelete: [...(c.hooks?.afterDelete ?? []), ...hooks.afterDelete] } };
};
const withGlobalAudit = (g: GlobalConfig): GlobalConfig => ({ ...g, hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), auditGlobalHook()] } });

// QA 12 Nov (GG-07, GG-18): list columns and filters offer only what staff use, in their words. Payload offers the
// unnamed fields hidden in the admin, the fields inside a hidden group or a list kept out of the lists, every list's row
// id ("… > ID") and the panels of the edit view; all of these are kept out here, once for every collection.
const OUT = { disableListColumn: true, disableListFilter: true };
const ROW_ID = { ...baseIDField, admin: { ...baseIDField.admin, ...OUT } } as Field;
function listFields(fields: Field[], out = false): Field[] {
  return fields.map((f) => {
    const admin = ('admin' in f ? f.admin : undefined) ?? {};
    const hasCell = Boolean(admin.components && 'Cell' in admin.components);
    const hidden = 'hidden' in admin && Boolean(admin.hidden);
    // Hidden and unnamed: a technical value ("raw", "docId", timestamps). Hidden but named: shown in a panel, still useful.
    const technical = hidden && !('label' in f && f.label);
    const flags = out ? OUT : technical ? { disableListFilter: true, ...(hasCell ? {} : { disableListColumn: true }) } : f.type === 'ui' && !hasCell ? { disableListColumn: true } : {};
    const next = { ...f, admin: { ...admin, ...flags } } as Field;
    if (!('fields' in f)) return next;
    const inner = listFields(f.fields, out || hidden || ('disableListFilter' in admin && Boolean(admin.disableListFilter)));
    return { ...next, fields: f.type === 'array' && !f.fields.some((c) => 'name' in c && c.name === 'id') ? [...inner, ROW_ID] : inner } as Field;
  });
}
const withListFields = (c: CollectionConfig): CollectionConfig => ({ ...c, fields: listFields(c.fields) });

export default buildConfig({
  admin: {
    user: 'users',
    importMap: { baseDir: dirname },
    // One light theme in Golden Grape colours (styles in app/(payload)/custom.css); no theme switcher.
    theme: 'light',
    // Day first, 24 h, as in Luxembourg (Payload's default reads "November 4th 2026, 3:52 PM").
    dateFormat: 'dd/MM/yyyy HH:mm',
    meta: { titleSuffix: ' · Golden Grape', icons: [{ rel: 'icon', type: 'image/png', url: '/icon.png' }] },
    components: {
      graphics: { Logo: '@/components/admin/logo', Icon: '@/components/admin/icon' },
      beforeLogin: ['@/components/admin/login-brand'],
      Nav: '@/components/admin/nav',
      actions: ['@/components/admin/alerts-client', '@/components/admin/language-menu'],
      providers: ['@/components/admin/row-links', '@/components/admin/password-toggle'],
      views: {
        dashboard: { Component: '@/components/admin/dashboard' },
        // Products, stock counts and movements as spreadsheets (client request, 7 Nov).
        importExport: { Component: '@/components/admin/import-export', path: '/import-export' },
        // Event reservations by event: upcoming and archives (APPLUX report 4, §4).
        eventBookings: { Component: '@/modules/events/admin/events-board', path: '/event-bookings' },
      },
    },
  },
  collections: [
    ...settingsCollections,
    ...cmsCollections,
    events,
    cateringPackages,
    cateringRequests,
    ...catalogueCollections,
    ...inventoryCollections,
    customers,
    customerGroups,
    ...salesCollections,
    eventBookings,
    payments,
    ...documentCollections,
  ]
    .map(withAudit)
    .map(withListFields),
  globals: [businessSettings, ...cmsGlobals].map(withGlobalAudit),
  db: mongooseAdapter({
    url: isBuildPhase ? false : env.DATABASE_URL,
    transactionOptions: {},
    // Indexes Payload cannot declare: TTL (`custom.ttl`), and text, descending or partial ones (`custom.indexes`).
    afterOpenConnection: async (adapter) => {
      for (const { slug, custom } of adapter.payload.config.collections) {
        const { collection } = adapter.collections[slug];
        if (custom?.ttl) await collection.createIndex({ [custom.ttl.field]: 1 }, { expireAfterSeconds: custom.ttl.seconds });
        for (const index of (custom?.indexes ?? []) as { fields: IndexSpecification; options?: CreateIndexesOptions }[]) {
          await collection.createIndex(index.fields, index.options);
        }
      }
    },
  }),
  editor: lexicalEditor(),
  // Without SMTP Payload logs its e-mails to the console.
  email: smtpConfigured()
    ? nodemailerAdapter({
        ...from(),
        transportOptions: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        },
      })
    : undefined,
  secret: isBuildPhase ? 'build-phase-no-secret' : env.PAYLOAD_SECRET,
  sharp,
  graphQL: { disable: true },
  // The language of the website text being edited, shown by name ("Texte du site : Português").
  localization: {
    locales: LOCALES.map((code) => ({ code, label: LOCALE_NAMES[code] })),
    defaultLocale: 'fr',
    fallback: true,
  },
  // The language of the admin itself, chosen on the login page or in the header (French until chosen: proxy.ts).
  // A few of Payload's words are replaced by everyday ones for non-technical staff (docs/03-CODING-LAWS.md).
  i18n: {
    supportedLanguages: { fr, en, de, pt },
    fallbackLanguage: 'fr',
    translations: {
      fr: {
        general: {
          noLabel: '—',
          untitled: 'Nouveau',
          noResultsFound: 'Aucun résultat',
          noResultsDescription: 'Rien ne correspond à cette recherche ou à ces filtres. Essayez d’autres mots ou retirez un filtre.',
          createNewLabel: 'Ajouter : {{label}}',
          creatingNewLabel: 'Ajout : {{label}}',
          locale: 'Texte du site',
          createNew: 'Ajouter',
          updatedSuccessfully: 'Enregistré. Le site est à jour.',
          successfullyCreated: 'Ajouté. Le site est à jour.',
        },
        fields: {
          addNew: 'Ajouter',
          addNewLabel: 'Ajouter : {{label}}',
          chooseFromExisting: 'Choisir dans la photothèque',
          uploadNewLabel: 'Envoyer : {{label}}',
        },
        version: {
          saveDraft: 'Enregistrer sans publier',
          publishChanges: 'Enregistrer et mettre en ligne',
          draftSavedSuccessfully: 'Enregistré, pas encore en ligne.',
          preview: 'Voir sur le site',
        },
      },
      en: {
        general: {
          noLabel: '—',
          untitled: 'New',
          noResultsFound: 'No results',
          noResultsDescription: 'Nothing matches this search or these filters. Try other words or remove a filter.',
          createNewLabel: 'Add {{label}}',
          creatingNewLabel: 'New {{label}}',
          locale: 'Website text',
          createNew: 'Add',
          updatedSuccessfully: 'Saved. The website is up to date.',
          successfullyCreated: 'Added. The website is up to date.',
        },
        fields: {
          addNew: 'Add',
          addNewLabel: 'Add {{label}}',
          chooseFromExisting: 'Choose from the library',
          uploadNewLabel: 'Upload {{label}}',
        },
        version: {
          saveDraft: 'Save without publishing',
          publishChanges: 'Save and show on website',
          draftSavedSuccessfully: 'Saved, not online yet.',
          preview: 'See it on the website',
        },
      },
      de: {
        general: {
          noLabel: '—',
          untitled: 'Neu',
          noResultsFound: 'Keine Ergebnisse',
          noResultsDescription: 'Nichts passt zu dieser Suche oder diesen Filtern. Versuchen Sie andere Wörter oder entfernen Sie einen Filter.',
          createNewLabel: 'Hinzufügen: {{label}}',
          creatingNewLabel: 'Neu: {{label}}',
          locale: 'Websitetext',
          createNew: 'Hinzufügen',
          updatedSuccessfully: 'Gespeichert. Die Website ist aktuell.',
          successfullyCreated: 'Hinzugefügt. Die Website ist aktuell.',
        },
        fields: {
          addNew: 'Hinzufügen',
          addNewLabel: 'Hinzufügen: {{label}}',
          chooseFromExisting: 'Aus der Mediathek wählen',
          uploadNewLabel: 'Hochladen: {{label}}',
        },
        version: {
          saveDraft: 'Speichern, nicht veröffentlichen',
          publishChanges: 'Speichern und online stellen',
          draftSavedSuccessfully: 'Gespeichert, noch nicht online.',
          preview: 'Auf der Website ansehen',
        },
      },
      pt: {
        // GG-033: Payload's Portuguese says "Login" / "Log out"; the shop uses European Portuguese.
        authentication: {
          login: 'Iniciar sessão',
          logOut: 'Terminar sessão',
          logout: 'Terminar sessão',
          loggedOutSuccessfully: 'Sessão terminada.',
          backToLogin: 'Voltar a iniciar sessão',
        },
        general: {
          noLabel: '—',
          untitled: 'Novo',
          noResultsFound: 'Sem resultados',
          noResultsDescription: 'Nada corresponde a esta pesquisa ou a estes filtros. Experimente outras palavras ou retire um filtro.',
          createNewLabel: 'Adicionar: {{label}}',
          creatingNewLabel: 'Novo: {{label}}',
          locale: 'Texto do site',
          createNew: 'Adicionar',
          updatedSuccessfully: 'Guardado. O site está atualizado.',
          successfullyCreated: 'Adicionado. O site está atualizado.',
        },
        fields: {
          addNew: 'Adicionar',
          addNewLabel: 'Adicionar: {{label}}',
          chooseFromExisting: 'Escolher na biblioteca',
          uploadNewLabel: 'Carregar: {{label}}',
        },
        version: {
          saveDraft: 'Guardar sem publicar',
          publishChanges: 'Guardar e mostrar no site',
          draftSavedSuccessfully: 'Guardado, ainda não está online.',
          preview: 'Ver no site',
        },
      },
    },
  },
  plugins: [
    // Private bucket: files are served through Payload at /api/media/file/… (access control kept).
    s3Storage({
      enabled: s3Configured(),
      collections: { media: true },
      bucket: s3Configured() ? (env.S3_BUCKET ?? '') : '',
      config: s3Configured()
        ? {
            endpoint: env.S3_ENDPOINT,
            region: env.S3_REGION,
            forcePathStyle: Boolean(env.S3_ENDPOINT),
            credentials: { accessKeyId: env.S3_ACCESS_KEY ?? '', secretAccessKey: env.S3_SECRET_KEY ?? '' },
          }
        : {},
    }),
  ],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
