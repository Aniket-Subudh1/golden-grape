import { describe, expect, it } from 'vitest';
import { matchOrderQuery, ORDER_TABS, ORDER_VIEWS, type OrderView, orderTabQuery, orderViewUrl } from './order-filters';

// What is lit above the Orders list must be what is listed (QA 12 Nov GG-04 on reservations, QA 14 Nov GG-22 here).
const params = (url: string) => Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)));
const RANGE = { from: '2026-11-01', to: '2026-11-14' };

describe('matchOrderQuery', () => {
  it.each(ORDER_TABS.map((t) => [t.key, t] as const))('the %s tab URL lights that tab, with or without day and search', (_, tab) => {
    expect(matchOrderQuery(params(orderTabQuery(tab)))).toMatchObject({ tab, view: undefined, filtered: false });
    expect(matchOrderQuery(params(orderTabQuery(tab, { day: '2026-11-14', search: 'Silva' })))).toMatchObject({ tab, day: '2026-11-14' });
  });

  it.each(Object.keys(ORDER_VIEWS) as OrderView[])('the %s shortcut is named and lights no tab', (view) => {
    const match = matchOrderQuery(params(orderViewUrl(view, view === 'sold' ? RANGE : undefined)));
    expect(match).toMatchObject({ view, tab: undefined, filtered: false });
    if (view === 'sold') expect(match.range).toEqual(RANGE);
  });

  it('reads the URL as Payload writes it back (nested, `in` for `equals`, extra list keys)', () => {
    const refunds = { where: { and: [{ 'payment.status': { in: ['refund_pending'] } }] }, limit: '10', page: '1', columns: '[]' };
    expect(matchOrderQuery(refunds)).toMatchObject({ view: 'refunds', tab: undefined });
    const todo = { where: { or: [{ and: [{ mode: { not_equals: 'table' } }, { status: { in: ['awaiting_payment', 'pending'] } }] }] }, sort: 'slotAt' };
    expect(matchOrderQuery(todo).tab?.key).toBe('todo');
  });

  it('the mode counts: pending orders off the table are not the table pre-orders tab', () => {
    expect(matchOrderQuery(params(orderViewUrl('toConfirm'))).tab).toBeUndefined();
  });

  it('a filter made by hand lights no tab and is said', () => {
    expect(matchOrderQuery({ 'where[and][0][status][in][0]': 'confirmed', 'where[and][1][mode][equals]': 'delivery' })).toMatchObject({ tab: undefined, view: undefined, filtered: true });
    expect(matchOrderQuery({ 'where[or][0][and][0][status][in][0]': 'pending', 'where[or][1][and][0][status][in][0]': 'confirmed' })).toMatchObject({ tab: undefined, filtered: true });
    expect(matchOrderQuery({ 'where[contact.email][like]': 'a@b.lu' })).toMatchObject({ tab: undefined, filtered: true });
  });

  it('no condition is "All"', () => {
    expect(matchOrderQuery({ sort: '-createdAt' }).tab?.key).toBe('all');
  });
});
