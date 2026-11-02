import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, vi } from 'vitest';

// Runs before each integration test file is imported: a fresh replica set per file
// (transactions need one), and env set before anything evaluates payload.config.ts.
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
process.env.DATABASE_URL = replSet.getUri('golden_grape_test');
process.env.PAYLOAD_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
process.env.APP_URL = 'http://localhost:3000';

// Services use Next request APIs that only exist inside a Next request; outside one they are no-ops.
vi.mock('next/cache', () => ({ cacheTag: () => {}, cacheLife: () => {}, revalidateTag: () => {} }));
vi.mock('next/server', () => ({ connection: async () => {}, after: () => {} }));

afterAll(async () => {
  await replSet.stop();
});
