import { type Label, l } from '@/lib/admin';

// Everyday names of movement types and adjustment reasons: used by the collection config and the stock panel.

export const TYPE_LABELS: Record<string, Label> = {
  sale: l('Vente', 'Sale', 'Verkauf', 'Venda'),
  return: l('Retour', 'Return', 'Rückgabe', 'Devolução'),
  cancel: l('Annulation', 'Cancellation', 'Stornierung', 'Cancelamento'),
  adjustment: l('Correction', 'Correction', 'Korrektur', 'Correção'),
  count: l('Inventaire', 'Stock count', 'Inventur', 'Inventário'),
  receipt: l('Réception', 'Delivery received', 'Wareneingang', 'Receção'),
  pos_import: l('Vente en caisse', 'Till sale', 'Kassenverkauf', 'Venda na caixa'),
};

/**
 * Reasons offered for a manual adjustment; "other" asks for a short text instead. "received" and "inventory" (APPLUX
 * audit 10 Nov, §12): goods that came in without a purchase order (those arrive with M3.1), and a correction after a
 * count made outside the "Inventaires" screen.
 */
export const ADJUST_REASONS = ['received', 'inventory', 'breakage', 'tasting', 'gift', 'theft', 'correction', 'other'] as const;

export const REASON_LABELS: Record<string, Label> = {
  received: l('Réception de marchandise', 'Goods received', 'Wareneingang', 'Receção de mercadoria'),
  inventory: l('Correction d’inventaire', 'Stock count correction', 'Inventurkorrektur', 'Correção de inventário'),
  breakage: l('Casse', 'Breakage', 'Bruch', 'Quebra'),
  tasting: l('Dégustation', 'Tasting', 'Verkostung', 'Prova'),
  gift: l('Offert', 'Given away', 'Verschenkt', 'Oferta'),
  theft: l('Vol', 'Theft', 'Diebstahl', 'Roubo'),
  correction: l('Erreur de saisie', 'Entry mistake', 'Eingabefehler', 'Erro de registo'),
  other: l('Autre', 'Other', 'Sonstiges', 'Outro'),
  'opening stock': l('Stock de départ', 'Opening stock', 'Anfangsbestand', 'Stock inicial'),
};
