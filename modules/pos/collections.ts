import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, none } from '@/lib/access';
import { badgeCell, l } from '@/lib/admin';

// The POS side (M3.3 T5, 04 §7). `posImports`: one daily sales file, by its hash (the same file twice is refused), its
// rows as read and what became of them. `outbox`: events queued inside the transactions that cause them, sent to the
// till by a job. `integrationLogs`: each call to the till, kept 90 days. All written by the server only.

export const OUTBOX_STATUS = ['pending', 'sending', 'sent', 'failed', 'dead'] as const;

export const posImports: CollectionConfig = {
  slug: 'posImports',
  labels: { singular: l('Import caisse', 'Till import', 'Kassenimport', 'Importação da caixa'), plural: l('Imports caisse', 'Till imports', 'Kassenimporte', 'Importações da caixa') },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['createdAt', 'filename', 'status', 'receipts', 'matched', 'unmatched', 'user'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les fichiers de ventes de la caisse importés. Pour en importer un : Import / export › Ventes de la caisse.',
      'The till’s sales files imported. To import one: Import / export › Till sales.',
      'Die importierten Verkaufsdateien der Kasse. Zum Importieren: Import / Export › Kassenverkäufe.',
      'Os ficheiros de vendas da caixa importados. Para importar: Importar / exportar › Vendas da caixa.',
    ),
    components: { edit: { beforeDocumentControls: ['@/modules/pos/admin/retry-button#ContinueImport'] } },
  },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'filename', type: 'text', required: true, label: l('Fichier', 'File', 'Datei', 'Ficheiro') },
    { name: 'hash', type: 'text', required: true, unique: true, admin: { hidden: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'preview',
      options: [
        { value: 'preview', label: l('À valider', 'To confirm', 'Zu bestätigen', 'Por confirmar') },
        { value: 'partial', label: l('En partie importé', 'Partly imported', 'Teilweise importiert', 'Importado em parte') },
        { value: 'posted', label: l('Importé', 'Imported', 'Importiert', 'Importado') },
      ],
      label: l('Statut', 'Status', 'Status', 'Estado'),
      admin: { components: badgeCell({ preview: 'info', partial: 'warning', posted: 'success' }) },
    },
    { name: 'receipts', type: 'number', defaultValue: 0, label: l('Tickets importés', 'Receipts imported', 'Importierte Bons', 'Talões importados') },
    { name: 'matched', type: 'number', defaultValue: 0, label: l('Lignes importées', 'Lines imported', 'Importierte Zeilen', 'Linhas importadas') },
    { name: 'unmatched', type: 'number', defaultValue: 0, label: l('Lignes sans article', 'Lines without item', 'Zeilen ohne Artikel', 'Linhas sem artigo') },
    { name: 'rows', type: 'json', admin: { hidden: true } },
    { name: 'rowErrors', type: 'json', admin: { hidden: true } },
    { name: 'assignments', type: 'json', admin: { hidden: true } },
    { name: 'postedLines', type: 'json', admin: { hidden: true } },
    { name: 'confirms', type: 'number', defaultValue: 0, admin: { hidden: true } },
    { name: 'user', type: 'relationship', relationTo: 'users', label: l('Par', 'By', 'Von', 'Por') },
  ],
};

export const outbox: CollectionConfig = {
  slug: 'outbox',
  labels: { singular: l('Envoi vers la caisse', 'Message to the till', 'Nachricht an die Kasse', 'Envio para a caixa'), plural: l('Envois vers la caisse', 'Messages to the till', 'Nachrichten an die Kasse', 'Envios para a caixa') },
  admin: {
    useAsTitle: 'topic',
    defaultColumns: ['createdAt', 'topic', 'ref', 'status', 'attempts', 'nextAttemptAt', 'lastError'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Les commandes envoyées à la caisse, envoyées chaque minute. Sans caisse connectée, elles passent à « Envoyé » (aucune caisse). Un envoi en échec peut être relancé (ouvrez-le, « Relancer »).',
      'Orders sent to the till, every minute. With no till connected they become “Sent” (no till). A failed one can be retried (open it, “Retry now”).',
      'Bestellungen an die Kasse, jede Minute gesendet. Ohne verbundene Kasse werden sie „Gesendet“ (keine Kasse). Ein Fehlschlag kann erneut gesendet werden (öffnen, „Jetzt erneut senden“).',
      'Encomendas enviadas para a caixa, a cada minuto. Sem caixa ligada passam a «Enviado» (sem caixa). Um envio falhado pode ser repetido (abra-o, «Repetir agora»).',
    ),
    components: { edit: { beforeDocumentControls: ['@/modules/pos/admin/retry-button#RetryButton'] } },
  },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'topic', type: 'text', required: true, index: true, label: l('Évènement', 'Event', 'Ereignis', 'Evento') },
    { name: 'ref', type: 'text', label: l('Référence', 'Reference', 'Referenz', 'Referência') },
    { name: 'payload', type: 'json', required: true, label: l('Contenu', 'Content', 'Inhalt', 'Conteúdo') },
    { name: 'target', type: 'text', required: true, label: l('Destination', 'Target', 'Ziel', 'Destino') },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { value: 'pending', label: l('En attente', 'Pending', 'Wartend', 'Pendente') },
        { value: 'sending', label: l('En cours', 'Sending', 'Wird gesendet', 'A enviar') },
        { value: 'sent', label: l('Envoyé', 'Sent', 'Gesendet', 'Enviado') },
        { value: 'failed', label: l('Échec, nouvel essai prévu', 'Failed, will retry', 'Fehlgeschlagen, neuer Versuch geplant', 'Falhou, nova tentativa prevista') },
        { value: 'dead', label: l('Abandonné', 'Given up', 'Aufgegeben', 'Abandonado') },
      ],
      label: l('Statut', 'Status', 'Status', 'Estado'),
      admin: { components: badgeCell({ pending: 'info', sending: 'info', sent: 'success', failed: 'warning', dead: 'danger' }) },
    },
    { name: 'attempts', type: 'number', defaultValue: 0, label: l('Essais', 'Attempts', 'Versuche', 'Tentativas') },
    { name: 'nextAttemptAt', type: 'date', index: true, label: l('Prochain essai', 'Next attempt', 'Nächster Versuch', 'Próxima tentativa'), admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'sentAt', type: 'date', label: l('Envoyé le', 'Sent at', 'Gesendet am', 'Enviado em'), admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'note', type: 'text', label: l('Note', 'Note', 'Notiz', 'Nota') },
    { name: 'lastError', type: 'text', label: l('Dernière erreur', 'Last error', 'Letzter Fehler', 'Último erro') },
  ],
  custom: { indexes: [{ fields: { status: 1, nextAttemptAt: 1 }, options: { name: 'due' } }] },
};

export const integrationLogs: CollectionConfig = {
  slug: 'integrationLogs',
  labels: { singular: l('Journal caisse', 'Till log', 'Kassenprotokoll', 'Registo da caixa'), plural: l('Journal caisse', 'Till log', 'Kassenprotokoll', 'Registo da caixa') },
  admin: { defaultColumns: ['createdAt', 'target', 'direction', 'ok', 'ms', 'outbox'], hidden: hiddenUnless('manager') },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'target', type: 'text', required: true, label: l('Destination', 'Target', 'Ziel', 'Destino') },
    { name: 'direction', type: 'select', options: ['out', 'in'], required: true, label: l('Sens', 'Direction', 'Richtung', 'Sentido') },
    { name: 'outbox', type: 'relationship', relationTo: 'outbox', label: l('Envoi', 'Message', 'Nachricht', 'Envio') },
    { name: 'request', type: 'json', label: l('Requête', 'Request', 'Anfrage', 'Pedido') },
    { name: 'response', type: 'json', label: l('Réponse', 'Response', 'Antwort', 'Resposta') },
    { name: 'ok', type: 'checkbox', label: l('Réussi', 'OK', 'OK', 'OK') },
    { name: 'ms', type: 'number', label: l('Durée (ms)', 'Duration (ms)', 'Dauer (ms)', 'Duração (ms)') },
    // Deleted by MongoDB at this date (90 days after the call): Payload already indexes createdAt.
    { name: 'expiresAt', type: 'date', admin: { hidden: true } },
  ],
  custom: { ttl: { field: 'expiresAt', seconds: 0 } },
};

export const posCollections = [posImports, outbox, integrationLogs];
