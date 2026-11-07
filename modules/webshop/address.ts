// Luxembourg addresses for the checkout (GG-007), from Geoportail (the national cadastre's public geocoder). Pure:
// the network calls are in service.ts. Suggestions only fill the fields; the customer can still change every one.

export type AddressSuggestion = { line1: string; postalCode: string; city: string };

/** "36, Route de Roost, L-7791 Bissen" → { line1: "36, Route de Roost", postalCode: "7791", city: "Bissen" }. */
export function parseAddressLabel(label: string): AddressSuggestion | null {
  const m = /^(.+?),\s*L-(\d{4})\s+(.+)$/.exec(label.trim());
  return m ? { line1: m[1].trim(), postalCode: m[2], city: m[3].trim() } : null;
}

/** The localities Geoportail gives for a postcode, without repeats (most codes have one). */
export function localitiesOf(results: { AddressDetails?: { zip?: string | null; locality?: string | null } | null }[], postalCode: string) {
  const names = results.filter((r) => r.AddressDetails?.zip === postalCode && r.AddressDetails.locality).map((r) => r.AddressDetails!.locality!.trim());
  return [...new Set(names)];
}
