import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(import.meta.dirname), '@payload-config': path.resolve(import.meta.dirname, 'payload.config.ts') };
const exclude = ['node_modules/**', 'golden-grape-luxembourg/**', '.next/**'];

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: 'unit', include: ['**/*.test.ts'], exclude: [...exclude, '**/*.int.test.ts'] } },
      {
        resolve: { alias },
        test: { name: 'int', include: ['**/*.int.test.ts'], exclude, testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false },
      },
    ],
  },
});
