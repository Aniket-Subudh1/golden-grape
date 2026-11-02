import { AppError } from './errors';
import { getPayloadClient } from './payload';
import { model } from './tx';

// Fixed window: one counter document per key and window, removed by the TTL index on `expiresAt`.
export async function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  const payload = await getPayloadClient();
  const window = Math.floor(now / windowMs);
  const counter = await model(payload, 'rateLimits').collection.findOneAndUpdate(
    { key: `${key}:${window}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!counter || counter.count > max) throw new AppError('RATE_LIMITED');
}
