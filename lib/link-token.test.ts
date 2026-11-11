import { describe, expect, it, vi } from 'vitest';
import { checkLinkToken, linkToken } from './link-token';

// lib/env.ts reads the environment on first use: a secret of the required length is enough here.
vi.stubEnv('DATABASE_URL', 'mongodb://localhost/unit');
vi.stubEnv('PAYLOAD_SECRET', 'unit-test-secret-at-least-32-characters');
vi.stubEnv('APP_URL', 'http://localhost:3000');

describe('link tokens', () => {
  const id = '6731f0a1c2d3e4f5a6b7c8d9';
  it('opens its own document only', () => {
    expect(checkLinkToken('quotation', id, linkToken('quotation', id))).toBe(true);
    expect(checkLinkToken('quotation', '6731f0a1c2d3e4f5a6b7c8da', linkToken('quotation', id))).toBe(false);
  });
  it('a token of one kind never opens another (an order link is not a quotation link)', () => {
    expect(checkLinkToken('quotation', id, linkToken('order', id))).toBe(false);
    expect(checkLinkToken('document', id, linkToken('quotation', id))).toBe(false);
  });
  it('a missing, shortened or altered token is refused', () => {
    const token = linkToken('quotation', id);
    expect(checkLinkToken('quotation', id, '')).toBe(false);
    expect(checkLinkToken('quotation', id, null)).toBe(false);
    expect(checkLinkToken('quotation', id, token.slice(0, -1))).toBe(false);
    expect(checkLinkToken('quotation', id, `${token.slice(0, -1)}${token.at(-1) === 'A' ? 'B' : 'A'}`)).toBe(false);
  });
});
