import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, none } from '@/lib/access';
import { badgeCell, l, scaledNumber } from '@/lib/admin';

// Append-only record of money movements per order (04 §4). Written only by a PaymentProvider (provider.ts).
export const PAYMENT_KINDS = ['charge', 'refund', 'authorization', 'capture', 'void'] as const;

export const payments: CollectionConfig = {
  slug: 'payments',
  labels: { singular: l('Paiement', 'Payment', 'Zahlung', 'Pagamento'), plural: l('Paiements', 'Payments', 'Zahlungen', 'Pagamentos') },
  admin: {
    defaultColumns: ['at', 'order', 'kind', 'amountCents', 'method', 'reference', 'user'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Chaque encaissement et remboursement enregistré sur une commande. Rien ne peut y être modifié.',
      'Every payment and refund recorded on an order. Nothing here can be changed.',
      'Jede Zahlung und Erstattung zu einer Bestellung. Hier kann nichts geändert werden.',
      'Cada pagamento e reembolso registado numa encomenda. Nada aqui pode ser alterado.',
    ),
  },
  access: { read: isStaff('sales'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true, label: l('Commande', 'Order', 'Bestellung', 'Encomenda') },
    { name: 'provider', type: 'select', required: true, options: ['manual', 'wallee'], label: l('Prestataire', 'Provider', 'Anbieter', 'Prestador') },
    {
      name: 'kind',
      type: 'select',
      required: true,
      label: l('Type', 'Type', 'Art', 'Tipo'),
      options: [
        { value: 'charge', label: l('Encaissement', 'Payment', 'Zahlung', 'Pagamento') },
        { value: 'refund', label: l('Remboursement', 'Refund', 'Erstattung', 'Reembolso') },
        { value: 'authorization', label: l('Autorisation', 'Authorisation', 'Autorisierung', 'Autorização') },
        { value: 'capture', label: l('Débit', 'Capture', 'Abbuchung', 'Captura') },
        { value: 'void', label: l('Annulation', 'Void', 'Storno', 'Anulação') },
      ],
      admin: { components: badgeCell({ charge: 'success', capture: 'success', refund: 'danger', void: 'neutral', authorization: 'info' }) },
    },
    { name: 'amountCents', type: 'number', required: true, label: l('Montant', 'Amount', 'Betrag', 'Montante'), admin: { components: scaledNumber('€') } },
    { name: 'method', type: 'text', label: l('Moyen', 'Method', 'Art', 'Meio') },
    { name: 'status', type: 'text', required: true, label: l('État', 'State', 'Stand', 'Estado') },
    // When the money actually arrived or left the bank (GG-003/004), as staff typed it; `createdAt` is when it was noted.
    { name: 'at', type: 'date', label: l('Date réelle', 'Actual date', 'Tatsächliches Datum', 'Data real'), admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'reference', type: 'text', label: l('Réf. bancaire', 'Bank reference', 'Bankreferenz', 'Ref. bancária') },
    { name: 'reason', type: 'text', label: l('Motif', 'Reason', 'Grund', 'Motivo') },
    { name: 'providerRef', type: 'text', label: l('Référence prestataire', 'Provider reference', 'Anbieterreferenz', 'Referência do prestador') },
    { name: 'user', type: 'relationship', relationTo: 'users', label: l('Par', 'By', 'Von', 'Por') },
    { name: 'raw', type: 'json', admin: { hidden: true } },
  ],
  custom: { indexes: [{ fields: { providerRef: 1 }, options: { unique: true, partialFilterExpression: { providerRef: { $type: 'string' } } } }] },
};
