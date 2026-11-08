'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { readTable } from '@/lib/table';
import { today } from '@/lib/time';
import { applyMapping, exportCatalogue, importCatalogue, type Mapping, parseCatalogue, previewCatalogue, suggestMapping, TEMPLATE_COLUMNS } from './import';

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
