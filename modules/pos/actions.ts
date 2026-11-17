'use server';

import { z } from 'zod';
import { action } from '@/lib/action';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { isModuleOn } from '@/modules/settings/service';
import { assignCode, confirmImport, importPreview, previewImport, retryOutbox } from './service';

// The till (M3.3 T5): the daily sales file (read, fix unmatched codes, import) and "Retry now" on the outbox.
// Managers only; each one refuses when the POS module is off.

const roles = { roles: ['manager' as const] };
const moduleOn = async () => {
  if (!(await isModuleOn('pos'))) throw new AppError('NOT_FOUND', 'module');
};
const id = z.string().regex(/^[a-f0-9]{24}$/);

export const previewPosFile = action(z.object({ file: z.instanceof(File).refine((f) => f.size > 0 && f.size <= 10 * 1024 * 1024, 'size') }), roles, async ({ file }, { payload, user }) => {
  await moduleOn();
  return previewImport(payload, { data: Buffer.from(await file.arrayBuffer()), filename: file.name, user: user.id });
});

export const openPosImport = action(z.object({ id }), roles, async ({ id }, { payload }) => {
  await moduleOn();
  return importPreview(payload, id);
});

export const assignPosCode = action(z.object({ id, code: z.string().max(64), target: z.string().trim().min(1, 'required').max(64) }), roles, async (input, { payload }) => {
  await moduleOn();
  return assignCode(payload, input);
});

export const confirmPosImport = action(z.object({ id }), roles, async ({ id }, { payload, user }) => {
  await moduleOn();
  const result = await confirmImport(payload, { id, user: user.id });
  await audit(payload, { user: user.id, action: 'pos.import', collection: 'posImports', id, ref: result.orders.join(', ').slice(0, 200), after: { lines: result.lines, left: result.left } });
  return { ...result, preview: await importPreview(payload, id) };
});

export const retryOutboxAction = action(z.object({ id }), roles, async ({ id }, { payload, user }) => {
  await retryOutbox(payload, id);
  await audit(payload, { user: user.id, action: 'doc.update', collection: 'outbox', id, after: { status: 'pending' } });
  return {};
});
