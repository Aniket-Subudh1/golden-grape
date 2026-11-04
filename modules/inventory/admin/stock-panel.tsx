import type { UIFieldServerProps } from 'payload';
import { hasRole } from '@/lib/access';
import { getSettingsPrivate } from '@/modules/settings/service';
import AdjustButton from './adjust-button';

// The "Stock" tab of a variant (ui field `stockPanel`): what is on hand, the low-stock alert level, the
// "Correct stock" form and the movement history (adjust-button.tsx), with the values known when the page opens.
export default async function StockPanel({ id, payload, user }: UIFieldServerProps) {
  if (!id || !hasRole(user, ['manager', 'stock'])) return null;
  const [{ docs }, settings, staff] = await Promise.all([
    payload.find({ collection: 'stockLevels', where: { variant: { equals: id } }, limit: 1, depth: 0, overrideAccess: true }),
    getSettingsPrivate(),
    // Names for the history's "By" column: a stock-role user may not read other staff records.
    payload.find({ collection: 'users', limit: 0, depth: 0, overrideAccess: true, select: { name: true } }),
  ]);
  const level = docs[0];
  return (
    <AdjustButton
      variant={String(id)}
      onHand={level?.onHand ?? 0}
      lowStock={level?.lowStock ?? false}
      threshold={level?.lowStockThreshold ?? null}
      defaultThreshold={settings.alerts?.defaultLowStock ?? 3}
      staffNames={Object.fromEntries(staff.docs.map((u) => [u.id, u.name]))}
    />
  );
}
