import { describe, expect, it } from 'vitest';
import { getTestPayload } from '@/tests/helpers';
import { withTx } from './tx';

const payload = await getTestPayload();

const count = async (action: string) =>
  (await payload.count({ collection: 'auditLogs', where: { action: { equals: action } } })).totalDocs;

describe('withTx', () => {
  it('commits both writes when the function succeeds', async () => {
    await withTx(payload, async ({ req }) => {
      await payload.create({ collection: 'auditLogs', data: { action: 'tx-ok', targetCollection: 'users', docId: '1' }, req });
      await payload.create({ collection: 'auditLogs', data: { action: 'tx-ok', targetCollection: 'users', docId: '2' }, req });
    });
    expect(await count('tx-ok')).toBe(2);
  });

  it('rolls back the first write when the second throws', async () => {
    await expect(
      withTx(payload, async ({ req }) => {
        await payload.create({ collection: 'auditLogs', data: { action: 'tx-fail', targetCollection: 'users', docId: '1' }, req });
        // Missing required `action` → ValidationError.
        await payload.create({ collection: 'auditLogs', data: { targetCollection: 'users', docId: '2' } as never, req });
      }),
    ).rejects.toThrow();
    expect(await count('tx-fail')).toBe(0);
  });

  it('rolls back raw writes made with the exposed session', async () => {
    await expect(
      withTx(payload, async ({ session, model }) => {
        await model('rateLimits').collection.insertOne({ key: 'tx-raw', count: 1, expiresAt: new Date() }, { session });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await payload.db.connection.collection('rateLimits').countDocuments({ key: 'tx-raw' })).toBe(0);
  });
});
