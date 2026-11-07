import { describe, expect, it } from 'vitest';
import { isBeforeSlot, localStamp } from './time';

describe('localStamp and isBeforeSlot (GG-027)', () => {
  it('writes Luxembourg wall-clock time, winter and summer', () => {
    expect(localStamp(new Date('2026-11-07T10:05:00Z'))).toBe('2026-11-07T11:05');
    expect(localStamp(new Date('2026-07-01T10:05:00Z'))).toBe('2026-07-01T12:05');
  });
  it('is early before the slot start, not at or after it, and never without a slot', () => {
    const slot = '2026-11-07T12:30';
    expect(isBeforeSlot(slot, new Date('2026-11-07T11:00:00Z'))).toBe(true); // 12:00 local
    expect(isBeforeSlot(slot, new Date('2026-11-06T16:00:00Z'))).toBe(true); // the day before
    expect(isBeforeSlot(slot, new Date('2026-11-07T11:30:00Z'))).toBe(false); // 12:30 local
    expect(isBeforeSlot(slot, new Date('2026-11-07T12:00:00Z'))).toBe(false);
    expect(isBeforeSlot(null, new Date())).toBe(false);
  });
});
