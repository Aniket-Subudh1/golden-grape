import type { CollectionConfig } from 'payload';
import { hiddenUnless, isStaff, none } from '@/lib/access';
import { badgeCell, l } from '@/lib/admin';

// Staff attendance (M3.3 T3, 04 §7): one row per shift, opened by a check-in on the venue's daily QR and closed by the
// check-out. `open` marks the shift still running; a partial unique index keeps one open shift per person. Rows change
// only through the service (check-in/out, a manager's correction with its reason, `attendanceCorrections` + audit).
// No location is recorded (Q§09).

const when = (name: string, label: ReturnType<typeof l>) => ({
  name,
  type: 'date' as const,
  label,
  admin: { date: { pickerAppearance: 'dayAndTime' as const, displayFormat: 'dd/MM/yyyy HH:mm' } },
});

export const attendance: CollectionConfig = {
  slug: 'attendance',
  labels: { singular: l('Pointage', 'Shift', 'Schicht', 'Turno'), plural: l('Pointages', 'Time clock', 'Zeiterfassung', 'Ponto') },
  admin: {
    useAsTitle: 'day',
    defaultColumns: ['day', 'user', 'checkIn', 'checkOut', 'minutes', 'source'],
    hidden: hiddenUnless('manager'),
    description: l(
      'Arrivées et départs pointés sur le QR du jour. Pour corriger une heure ou un départ oublié : ouvrez la ligne, « Corriger ».',
      'Check-ins and check-outs on the daily QR. To fix a time or a missing check-out: open the row, “Correct”.',
      'Kommen und Gehen per Tages-QR. Um eine Zeit oder ein fehlendes Gehen zu korrigieren: Zeile öffnen, „Korrigieren“.',
      'Entradas e saídas no QR do dia. Para corrigir uma hora ou uma saída em falta: abra a linha, «Corrigir».',
    ),
    components: { edit: { beforeDocumentControls: ['@/modules/attendance/admin/correct-button#CorrectButton'] } },
  },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  defaultSort: '-checkIn',
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, label: l('Personne', 'Person', 'Person', 'Pessoa') },
    { name: 'day', type: 'text', required: true, index: true, label: l('Jour', 'Day', 'Tag', 'Dia') },
    when('checkIn', l('Arrivée', 'Check-in', 'Kommen', 'Entrada')),
    when('checkOut', l('Départ', 'Check-out', 'Gehen', 'Saída')),
    { name: 'minutes', type: 'number', label: l('Minutes', 'Minutes', 'Minuten', 'Minutos') },
    { name: 'open', type: 'checkbox', defaultValue: true, index: true, label: l('En cours', 'Open', 'Offen', 'Em curso') },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'qr',
      options: [
        { value: 'qr', label: l('QR', 'QR', 'QR', 'QR') },
        { value: 'manager', label: l('Corrigé', 'Corrected', 'Korrigiert', 'Corrigido') },
      ],
      label: l('Origine', 'Source', 'Quelle', 'Origem'),
      admin: { components: badgeCell({ qr: 'neutral', manager: 'warning' }) },
    },
  ],
  custom: { indexes: [{ fields: { user: 1 }, options: { name: 'one_open_shift', unique: true, partialFilterExpression: { open: true } } }] },
};

export const attendanceCorrections: CollectionConfig = {
  slug: 'attendanceCorrections',
  labels: { singular: l('Correction de pointage', 'Time correction', 'Zeitkorrektur', 'Correção de ponto'), plural: l('Corrections de pointage', 'Time corrections', 'Zeitkorrekturen', 'Correções de ponto') },
  admin: { defaultColumns: ['createdAt', 'attendance', 'field', 'before', 'after', 'reason', 'by'], hidden: hiddenUnless('manager') },
  access: { read: isStaff('manager'), create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    { name: 'attendance', type: 'relationship', relationTo: 'attendance', required: true, index: true, label: l('Pointage', 'Shift', 'Schicht', 'Turno') },
    {
      name: 'field',
      type: 'select',
      required: true,
      options: [
        { value: 'checkIn', label: l('Arrivée', 'Check-in', 'Kommen', 'Entrada') },
        { value: 'checkOut', label: l('Départ', 'Check-out', 'Gehen', 'Saída') },
      ],
      label: l('Heure corrigée', 'Time corrected', 'Korrigierte Zeit', 'Hora corrigida'),
    },
    when('before', l('Avant', 'Before', 'Vorher', 'Antes')),
    when('after', l('Après', 'After', 'Nachher', 'Depois')),
    { name: 'reason', type: 'text', required: true, label: l('Raison', 'Reason', 'Grund', 'Motivo') },
    { name: 'by', type: 'relationship', relationTo: 'users', required: true, label: l('Par', 'By', 'Von', 'Por') },
  ],
};

export const attendanceCollections = [attendance, attendanceCorrections];
