// Delivery zones (M2.3 T2). Pure.

export type Zone = { id?: string; name: string; postalCodes: string[]; feeCents: number; minOrderCents: number; freeFromCents?: number | null; active?: boolean | null };

/** "L-1234", "l 1234", " 1234 " → "1234". Anything that is not 4 digits after the prefix stays as typed (no match). */
export const normalizePostalCode = (value: string) => value.trim().toUpperCase().replace(/^L[\s-]*/, '').replace(/\s+/g, '');

/** The active zone that lists this postal code, or null (the checkout then suggests takeaway). */
export function resolveZone<Z extends Zone>(postalCode: string, zones: Z[]): Z | null {
  const code = normalizePostalCode(postalCode);
  if (!code) return null;
  return zones.find((z) => z.active !== false && z.postalCodes.map(normalizePostalCode).includes(code)) ?? null;
}

/** The fee for a subtotal (VAT incl.): free from the zone's threshold; `belowMinimum` blocks the checkout. */
export function deliveryFee(zone: Zone, subtotalCents: number) {
  const free = zone.freeFromCents != null && subtotalCents >= zone.freeFromCents;
  return { feeCents: free ? 0 : zone.feeCents, belowMinimum: subtotalCents < zone.minOrderCents };
}
