import { describe, expect, it } from 'vitest';
import { changedFields } from './audit';

describe('changedFields (GG-046)', () => {
  it('keeps only what changed, with short before and after values', () => {
    const diff = changedFields({ status: 'new', guests: 20, notes: 'x', updatedAt: '1' }, { status: 'quoted', guests: 20, notes: 'x', updatedAt: '2' });
    expect(diff).toEqual({ before: { status: 'new' }, after: { status: 'quoted' }, changed: true });
  });
  it('looks inside a group: an IBAN change says which field', () => {
    const diff = changedFields({ business: { iban: '', phone: '+352' } }, { business: { iban: 'LU12 0010 0012 3456 7891', phone: '+352' } });
    expect(diff.after).toEqual({ 'business.iban': 'LU12 0010 0012 3456 7891' });
  });
  it('a long text or a list is summarised, never copied; sign-in bookkeeping is not a change', () => {
    const diff = changedFields({ text: 'a', lines: [1] }, { text: 'b'.repeat(500), lines: [1, 2] });
    expect(diff.after).toEqual({ text: '…', lines: '…' });
    expect(changedFields({ sessions: [1], loginAttempts: 0 }, { sessions: [1, 2], loginAttempts: 1 }).changed).toBe(false);
  });
});
