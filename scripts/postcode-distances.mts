// Builds modules/sales/postcode-km.json: the driving distance from the shop to every Luxembourg postcode (client
// request 17 Nov: delivery priced by distance). Run again when the shop moves or the State adds postcodes (rare):
//
//   curl -o /tmp/addresses.csv https://data.public.lu/fr/datasets/adresses-georeferencees-bd-adresses/  (addresses.csv)
//   node scripts/postcode-distances.mts /tmp/addresses.csv 49.78789 6.08595
//
// Source: BD-Adresses (CC0, every address of the country with its GPS point). Per postcode, the address nearest to the
// mean of its addresses stands for the postcode; OSRM (OpenStreetMap routing) gives the driving distance from the shop.
// Nothing runs at checkout: the website only reads the JSON, so there is no API key, no cost and no outage to plan for.

import { readFileSync, writeFileSync } from 'node:fs';

const [csvPath, lat, lng] = process.argv.slice(2);
if (!csvPath || !lat || !lng) throw new Error('usage: node scripts/postcode-distances.mts <addresses.csv> <shop lat> <shop lng>');
const OSRM = process.env.OSRM_URL ?? 'https://router.project-osrm.org';

type Point = { lat: number; lng: number; place: string };
const byCode = new Map<string, Point[]>();
const [header, ...lines] = readFileSync(csvPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const col = Object.fromEntries(header.split(';').map((name, i) => [name, i]));
for (const line of lines) {
  const f = line.split(';');
  const code = f[col.code_postal];
  if (!/^\d{4}$/.test(code ?? '')) continue;
  const point = { lat: Number(f[col.lat_wgs84]), lng: Number(f[col.lon_wgs84]), place: f[col.localite] };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
  byCode.set(code, [...(byCode.get(code) ?? []), point]);
}

// The address nearest to the mean, and the locality most addresses of the postcode carry (shown in the admin).
const stands = [...byCode].map(([code, points]) => {
  const mLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const mLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const near = points.reduce((a, b) => ((a.lat - mLat) ** 2 + (a.lng - mLng) ** 2 <= (b.lat - mLat) ** 2 + (b.lng - mLng) ** 2 ? a : b));
  const count = new Map<string, number>();
  for (const p of points) count.set(p.place, (count.get(p.place) ?? 0) + 1);
  const place = [...count].sort((a, b) => b[1] - a[1])[0][0];
  return { code, lat: near.lat, lng: near.lng, place };
});

const out: Record<string, [number, string]> = {};
const CHUNK = 90; // the public OSRM server answers tables of up to 100 points
for (let i = 0; i < stands.length; i += CHUNK) {
  const chunk = stands.slice(i, i + CHUNK);
  const coords = [`${lng},${lat}`, ...chunk.map((s) => `${s.lng},${s.lat}`)].join(';');
  const res = await fetch(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=distance`);
  const body = (await res.json()) as { code: string; distances: (number | null)[][] };
  if (body.code !== 'Ok') throw new Error(`OSRM ${res.status} ${body.code}`);
  chunk.forEach((s, j) => {
    const metres = body.distances[0][j + 1];
    if (metres != null) out[s.code] = [Math.round(metres / 100) / 10, s.place];
  });
  process.stdout.write(`\r${Math.min(i + CHUNK, stands.length)}/${stands.length}`);
  await new Promise((r) => setTimeout(r, 1100)); // the public server asks for at most one request a second
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('../modules/sales/postcode-km.json', import.meta.url), `${JSON.stringify(sorted)}\n`);
console.log(`\n${Object.keys(sorted).length} postcodes written`);
