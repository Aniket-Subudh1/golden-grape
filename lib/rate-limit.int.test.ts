import { describe, expect, it } from 'vitest';
import { getTestPayload } from '@/tests/helpers';
import { rateLimit } from './rate-limit';

await getTestPayload();

const WINDOW = 60_000;
const t0 = 1_000 * WINDOW; // start of a window

describe('rateLimit', () => {
  it('allows 3 calls, blocks the 4th, and allows again in the next window', async () => {
    for (const offset of [0, 10, 20]) await rateLimit('k', 3, WINDOW, t0 + offset);
    await expect(rateLimit('k', 3, WINDOW, t0 + 30)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(rateLimit('k', 3, WINDOW, t0 + WINDOW)).resolves.toBeUndefined();
  });

  it('counts keys separately', async () => {
    for (let i = 0; i < 3; i++) await rateLimit('a', 3, WINDOW, t0);
    await expect(rateLimit('b', 3, WINDOW, t0)).resolves.toBeUndefined();
  });

  it('lets exactly `max` of many parallel calls through', async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => rateLimit('p', 3, WINDOW, t0)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  });
});
