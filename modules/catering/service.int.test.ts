import { describe, expect, it } from 'vitest';
import { getTestPayload } from '@/tests/helpers';
import { type CateringInput, requestCatering } from './service';

const payload = await getTestPayload();

const pkg = await payload.create({
  collection: 'cateringPackages',
  data: { name: 'Mesa Farta', pricePerGuestCents: 5500, minGuests: 10, includes: [] },
  overrideAccess: true,
  context: { skipRevalidate: true },
});

const NOW = new Date('2026-11-03T10:00:00Z');
const base: CateringInput = {
  package: pkg.id,
  guests: 20,
  date: '2026-11-20',
  time: '19:30',
  location: 'Bissen',
  name: 'Marie Dupont',
  email: 'marie@example.test',
  phone: '+352 621 000 000',
  locale: 'fr',
};

describe('requestCatering', () => {
  it('stores the server-computed estimate and ignores a client-sent one', async () => {
    const forged = { ...base, estimateCents: 1 } as CateringInput;
    const { request } = await requestCatering(payload, forged, NOW);
    expect(request.estimateCents).toBe(5500 * 20);
    expect(request.number).toBe('REQ-2026-0001');
    const stored = await payload.findByID({ collection: 'cateringRequests', id: request.id, overrideAccess: true });
    expect(stored.estimateCents).toBe(110000);
  });

  it('numbers requests sequentially', async () => {
    const { request } = await requestCatering(payload, base, NOW);
    expect(request.number).toBe('REQ-2026-0002');
  });

  it('rejects fewer guests than the package minimum', async () => {
    await expect(requestCatering(payload, { ...base, guests: 9 }, NOW)).rejects.toMatchObject({ code: 'VALIDATION', message: 'minGuests', field: 'guests' });
  });

  it('rejects a date less than 2 days ahead, accepts exactly 2', async () => {
    await expect(requestCatering(payload, { ...base, date: '2026-11-04' }, NOW)).rejects.toMatchObject({ message: 'dateTooSoon', field: 'date' });
    await expect(requestCatering(payload, { ...base, date: '2026-11-05' }, NOW)).resolves.toBeTruthy();
  });

  it('does not consume a number when validation fails', async () => {
    const count = await payload.count({ collection: 'cateringRequests', overrideAccess: true });
    await requestCatering(payload, { ...base, guests: 1 }, NOW).catch(() => {});
    expect((await payload.count({ collection: 'cateringRequests', overrideAccess: true })).totalDocs).toBe(count.totalDocs);
  });
});
