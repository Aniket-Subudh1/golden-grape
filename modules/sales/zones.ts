// Delivery by driving distance (client request 17 Nov, replacing M2.3's postcode lists). Pure.
//
// Golden Grape sets distance ranges in the admin (Delivery › "up to 10 km: 5 €, minimum 30 €, free from 80 €"). A
// range starts where the next shorter one ends, so ranges never overlap or leave gaps. Which postcodes fall in which
// range follows from postcode-km.json (driving km from the shop, scripts/postcode-distances.mts): changing a limit
// moves the postcodes by itself. Beyond the longest range, and for a postcode not in the table, there is no delivery.

export type DeliveryRange = { id?: string; name?: string | null; upToKm?: number | null; feeCents: number; minOrderCents: number; freeFromCents?: number | null; active?: boolean | null };
/** What the checkout gets for a postcode: the range's prices, its bounds and the postcode's own distance and place. */
export type Zone = DeliveryRange & { fromKm: number; upToKm: number; km: number; place: string };
/** Postcode → [driving km from the shop, locality]. */
export type PostcodeTable = Record<string, readonly [number, string]>;

/** "L-1234", "l 1234", " 1234 " → "1234". Anything that is not 4 digits after the prefix stays as typed (no match). */
export const normalizePostalCode = (value: string) => value.trim().toUpperCase().replace(/^L[\s-]*/, '').replace(/\s+/g, '');

/** A Luxembourg postcode: 4 digits. */
export const isLuxPostalCode = (code: string) => /^\d{4}$/.test(code);

/** Active ranges with a limit, shortest first, each with where it starts. */
export function sortedRanges<R extends DeliveryRange>(ranges: R[]): (R & { fromKm: number; upToKm: number })[] {
  const usable = ranges.filter((r): r is R & { upToKm: number } => r.active !== false && r.upToKm != null && r.upToKm > 0).sort((a, b) => a.upToKm - b.upToKm);
  return usable.map((r, i) => ({ ...r, fromKm: i === 0 ? 0 : usable[i - 1].upToKm }));
}

/** The range a distance falls in: from (excluded, except 0) up to the limit (included). Null beyond the longest. */
export function rangeForKm<R extends DeliveryRange>(km: number, ranges: R[]) {
  return sortedRanges(ranges).find((r) => km <= r.upToKm) ?? null;
}

/** The delivery for a postcode, or null (unknown postcode or too far: the checkout then suggests pickup). */
export function resolveZone<R extends DeliveryRange>(postalCode: string, ranges: R[], table: PostcodeTable): (Zone & R) | null {
  const entry = table[normalizePostalCode(postalCode)];
  if (!entry) return null;
  const range = rangeForKm(entry[0], ranges);
  return range && { ...range, km: entry[0], place: entry[1] };
}

/** The fee for a subtotal (VAT incl.): free from the range's threshold; `belowMinimum` blocks the checkout. */
export function deliveryFee(zone: DeliveryRange, subtotalCents: number) {
  const free = zone.freeFromCents != null && subtotalCents >= zone.freeFromCents;
  return { feeCents: free ? 0 : zone.feeCents, belowMinimum: subtotalCents < zone.minOrderCents };
}

/**
 * Only shop goods travel (client request 17 Nov): the counter's dishes (kind `snack`) are never delivered, and any other
 * product can be kept to pickup with "Pickup only". A basket with one such line cannot be delivered (checkout and server).
 */
export const isDeliverable = (product: { kind?: string | null; pickupOnly?: boolean | null }) => product.kind !== 'snack' && product.pickupOnly !== true;
