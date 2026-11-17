'use client';

import { useDocumentInfo, useFormFields, useTranslation } from '@payloadcms/ui';
import { useEffect, useMemo, useState } from 'react';
import { l, type Label } from '@/lib/admin';
import table from '../postcode-km.json';
import type { DeliveryRange, PostcodeTable } from '../zones';

// Under a distance range's limit (client request 17 Nov): where the range starts, which places and postcodes it covers
// with the limit as typed, and a box to check one postcode. Nothing is stored: the checkout reads the same table.

const KM = table as unknown as PostcodeTable;

const T = {
  covers: l('Cette tranche : de {from} à {to} km en voiture — {n} codes postaux.', 'This range: {from} to {to} driving km — {n} postcodes.', 'Diese Stufe: {from} bis {to} Fahr-km — {n} Postleitzahlen.', 'Este escalão: de {from} a {to} km de carro — {n} códigos postais.'),
  beyond: l('Au-delà de {to} km, la livraison n’est pas proposée (ajoutez une tranche plus longue pour livrer plus loin).', 'Beyond {to} km, delivery is not offered (add a longer range to deliver further).', 'Über {to} km wird nicht geliefert (eine längere Stufe hinzufügen, um weiter zu liefern).', 'Para além de {to} km, a entrega não é proposta (adicione um escalão mais longo para entregar mais longe).'),
  inactive: l('Tranche désactivée : ces codes postaux passent à la tranche suivante, ou à « pas de livraison ».', 'Range switched off: these postcodes go to the next range, or to “no delivery”.', 'Stufe deaktiviert: diese Postleitzahlen fallen in die nächste Stufe oder auf „keine Lieferung“.', 'Escalão desativado: estes códigos postais passam ao escalão seguinte, ou a «sem entrega».'),
  empty: l('Aucun code postal dans cette tranche.', 'No postcode in this range.', 'Keine Postleitzahl in dieser Stufe.', 'Nenhum código postal neste escalão.'),
  check: l('Vérifier un code postal', 'Check a postcode', 'Postleitzahl prüfen', 'Verificar um código postal'),
  found: l('{code} {place} : {km} km.', '{code} {place}: {km} km.', '{code} {place}: {km} km.', '{code} {place}: {km} km.'),
  inside: l('Dans cette tranche.', 'In this range.', 'In dieser Stufe.', 'Neste escalão.'),
  outside: l('Pas dans cette tranche.', 'Not in this range.', 'Nicht in dieser Stufe.', 'Fora deste escalão.'),
  unknown: l('Code postal inconnu.', 'Unknown postcode.', 'Unbekannte Postleitzahl.', 'Código postal desconhecido.'),
};

export default function RangePostcodes() {
  const { i18n } = useTranslation();
  const say = (label: Label, values: Record<string, string | number> = {}) => Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), label[i18n.language as keyof Label] ?? label.fr);
  const { id } = useDocumentInfo();
  const upToKm = useFormFields(([fields]) => fields.upToKm?.value as number | null | undefined);
  const active = useFormFields(([fields]) => fields.active?.value as boolean | undefined);
  const [others, setOthers] = useState<number[]>([]);
  const [code, setCode] = useState('');

  // The other active ranges' limits: where this one starts, and whether it is the longest.
  useEffect(() => {
    void fetch('/api/deliveryZones?depth=0&limit=0&where[active][equals]=true', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { docs: (DeliveryRange & { id: string })[] }) => setOthers(body.docs.filter((d) => d.id !== id && d.upToKm != null).map((d) => d.upToKm!)));
  }, [id]);

  const to = typeof upToKm === 'number' && upToKm > 0 ? upToKm : null;
  const from = to == null ? 0 : Math.max(0, ...others.filter((km) => km < to));
  const places = useMemo(() => {
    if (to == null) return [];
    const byPlace = new Map<string, { codes: string[]; km: number }>();
    for (const [postcode, [km, place]] of Object.entries(KM)) {
      if (km > to || (from > 0 && km <= from)) continue;
      const p = byPlace.get(place) ?? { codes: [], km };
      p.codes.push(postcode);
      p.km = Math.min(p.km, km);
      byPlace.set(place, p);
    }
    return [...byPlace].sort((a, b) => a[1].km - b[1].km);
  }, [to, from]);

  if (to == null) return null;
  const count = places.reduce((n, [, p]) => n + p.codes.length, 0);
  const longest = others.every((km) => km < to);
  const typed = code.trim().replace(/^L[\s-]*/i, '');
  const entry = KM[typed];

  return (
    <div className="gg-range">
      <p>
        <strong>{say(T.covers, { from, to, n: count })}</strong>
      </p>
      {active === false && <p>{say(T.inactive)}</p>}
      {longest && <p>{say(T.beyond, { to })}</p>}
      {places.length === 0 ? (
        <p>{say(T.empty)}</p>
      ) : (
        <ul className="gg-range__places">
          {places.map(([place, p]) => (
            <li key={place} title={p.codes.join(', ')}>
              {place} <span>({p.codes.length})</span>
            </li>
          ))}
        </ul>
      )}
      <label className="gg-range__check">
        <span>{say(T.check)}</span>
        <input value={code} inputMode="numeric" placeholder="7795" onChange={(e) => setCode(e.target.value)} />
        {/^\d{4}$/.test(typed) && (
          <span role="status">{entry ? `${say(T.found, { code: typed, place: entry[1], km: entry[0].toLocaleString(i18n.language) })} ${say(entry[0] <= to && (from === 0 || entry[0] > from) ? T.inside : T.outside)}` : say(T.unknown)}</span>
        )}
      </label>
    </div>
  );
}
