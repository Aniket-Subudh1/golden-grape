'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { readTable } from '@/lib/table';
import type { Locale } from '@/lib/i18n';
import { today } from '@/lib/time';
import { onHand } from '@/modules/inventory/service';
import { applyMapping, exportCatalogue, importCatalogue, type Mapping, parseCatalogue, previewCatalogue, suggestMapping, TEMPLATE_COLUMNS } from './import';
import { findByBarcode, searchSizes, staffItems } from './service';

// The back-office catalogue import/export (client request, 7 Nov). Stateless: the page sends the file with each step,
// and every step checks the whole file again, so a batch never writes rows that were not checked.

const roles = { roles: ['manager' as const, 'stock' as const] };
/** Rows written per call: each call stays well within the proxy timeout; the page shows the progress. */
const BATCH = 100;

const file = z.instanceof(File).refine((f) => f.size > 0 && f.size <= 10 * 1024 * 1024, 'size');
const source = z.union([z.object({ column: z.string() }), z.object({ value: z.string() })]);
const mapping = z.string().transform((text, ctx): Mapping => {
  try {
    return z.partialRecord(z.enum(TEMPLATE_COLUMNS), source).parse(JSON.parse(text));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'mapping' });
    return z.NEVER;
  }
});

const read = async (f: File) => readTable(Buffer.from(await f.arrayBuffer()), f.name);

/** Step 1: the file's columns, a few rows, and the columns already named like the template. */
export const inspectImportFile = action(z.object({ file }), roles, async (input) => {
  const table = await read(input.file);
  return {
    headers: table.headers,
    sample: table.rows.filter((r) => Object.values(r).some(Boolean)).slice(0, 3),
    rows: table.rows.length,
    mapping: suggestMapping(table.headers),
  };
});

/** Step 2: every check of the import, nothing written: how many products would be created and updated, and why
 * rows are refused (spreadsheet row numbers). */
export const checkCatalogueImport = action(z.object({ file, mapping }), roles, async (input, { payload }) => {
  const parsed = parseCatalogue(applyMapping(await read(input.file), input.mapping));
  const preview = await previewCatalogue(payload, parsed.rows);
  const errors = [...parsed.errors, ...preview.errors].sort((a, b) => a.row - b.row || a.column.localeCompare(b.column));
  return { rows: parsed.rows.length, create: preview.create, update: preview.update, errors: errors.slice(0, 200), errorCount: errors.length };
});

/** Step 3: writes the next batch of rows from `from`; `next` is where the following call starts (null when done). */
export const runCatalogueImport = action(z.object({ file, mapping, from: z.coerce.number().int().min(0) }), roles, async (input, { payload, user }) => {
  const parsed = parseCatalogue(applyMapping(await read(input.file), input.mapping));
  if (parsed.errors.length) throw new AppError('VALIDATION', 'check');
  const to = Math.min(input.from + BATCH, parsed.rows.length);
  const result = await importCatalogue(payload, parsed.rows, { from: input.from, to });
  if (result.errors.length) throw new AppError('VALIDATION', 'check');
  await audit(payload, {
    user: user.id,
    action: 'catalogue.import',
    collection: 'products',
    id: input.file.name,
    ref: input.file.name,
    after: { rows: `${input.from + 1}–${to} / ${parsed.rows.length}`, created: result.created, updated: result.updated },
  });
  return { created: result.created, updated: result.updated, next: to < parsed.rows.length ? to : null, total: parsed.rows.length };
});

/** The whole catalogue in the import's format, to edit in Excel and import again. */
export const exportCatalogueFile = action(z.object({}), roles, async (_, { payload }) => ({ name: `golden-grape-catalogue-${today()}.csv`, csv: await exportCatalogue(payload) }));

// ---------------------------------------------------------------------------------------------------------------
// Staff phone screens (M3.1 T2): one scanned code or a few typed words → product cards with the stock on hand.

const scanRoles = { roles: ['stock' as const, 'sales' as const, 'manager' as const] };

async function cards(payload: Parameters<typeof staffItems>[0], ids: string[], locale: Locale) {
  const [items, stock] = await Promise.all([staffItems(payload, ids, locale), onHand(payload, ids)]);
  return items.map((item) => ({ ...item, onHand: stock[item.variant] ?? 0 }));
}

export type ScanCard = Awaited<ReturnType<typeof cards>>[number];

/** A scanned barcode (a box's first, then a bottle's: findByBarcode) → the card, and which unit the code was. */
export const lookupBarcode = action(z.object({ code: z.string().trim().min(1).max(64) }), scanRoles, async ({ code }, { payload, user }) => {
  const found = await findByBarcode(payload, code);
  if (!found) throw new AppError('NOT_FOUND', 'barcode', 'code');
  const [card] = await cards(payload, [found.variant.id], (user.locale ?? 'fr') as Locale);
  return { card, unit: found.unit?.id ?? null, factor: found.factor };
});

/** Typed words (a name, a sku): up to 12 cards, for products without a barcode at hand. */
export const searchItems = action(z.object({ q: z.string().trim().min(2).max(80) }), scanRoles, async ({ q }, { payload, user }) =>
  cards(payload, await searchSizes(payload, q), (user.locale ?? 'fr') as Locale),
);
