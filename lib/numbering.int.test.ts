import { describe, expect, it } from 'vitest';
import { getTestPayload } from '@/tests/helpers';
import { nextNumber } from './numbering';
import { withTx } from './tx';

const payload = await getTestPayload();

describe('nextNumber', () => {
  it('gives 1, 2, 3 for three sequential calls, per series and year', async () => {
    const take = (series: string, year: number) => withTx(payload, (tx) => nextNumber(tx, series, year));
    expect([await take('test', 2026), await take('test', 2026), await take('test', 2026)]).toEqual([1, 2, 3]);
    expect(await take('test', 2027)).toBe(1);
    expect(await take('other', 2026)).toBe(1);
  });

  it('does not consume a number when the transaction fails', async () => {
    await expect(
      withTx(payload, async (tx) => {
        await nextNumber(tx, 'rollback', 2026);
        throw new Error('insert failed');
      }),
    ).rejects.toThrow('insert failed');
    expect(await withTx(payload, (tx) => nextNumber(tx, 'rollback', 2026))).toBe(1);
  });
});
