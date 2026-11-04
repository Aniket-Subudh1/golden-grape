import { describe, expect, it } from 'vitest';
import { canTransition, canTransitionReservation, effects, ORDER_FLOW, ORDER_STATUSES, type OrderStatus } from './order-states';

const allowed = Object.entries(ORDER_FLOW).flatMap(([from, tos]) => tos.map((to) => [from, to] as [OrderStatus, OrderStatus]));

describe('order flow', () => {
  it.each(allowed)('%s → %s is allowed', (from, to) => expect(canTransition(from, to)).toBe(true));

  it.each([
    ['pending', 'ready'],
    ['pending', 'completed'],
    ['awaiting_payment', 'out_for_delivery'],
    ['cancelled', 'confirmed'],
    ['refunded', 'confirmed'],
    ['completed', 'cancelled'],
    ['ready', 'confirmed'],
    ['confirmed', 'confirmed'],
  ] as [OrderStatus, OrderStatus][])('%s → %s is refused', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(effects(from, to)).toEqual([]);
  });

  it('no terminal state has a way out', () => {
    expect(ORDER_STATUSES.filter((s) => ORDER_FLOW[s].length === 0)).toEqual(['cancelled', 'refunded']);
  });
});

describe('effects', () => {
  it.each([
    ['pending', 'confirmed', ['postSale', 'mailCustomer', 'outbox']],
    ['awaiting_payment', 'confirmed', ['postSale', 'mailCustomer', 'outbox']],
    ['confirmed', 'cancelled', ['returnStock', 'mailCustomer', 'outbox']],
    ['ready', 'cancelled', ['returnStock', 'mailCustomer', 'outbox']],
    ['out_for_delivery', 'cancelled', ['returnStock', 'mailCustomer', 'outbox']],
    ['pending', 'cancelled', ['mailCustomer', 'outbox']],
    ['awaiting_payment', 'cancelled', ['mailCustomer', 'outbox']],
    ['confirmed', 'refunded', ['returnStock', 'mailCustomer', 'outbox']],
    ['completed', 'refunded', ['mailCustomer', 'outbox']],
    ['confirmed', 'ready', ['mailCustomer']],
    ['confirmed', 'out_for_delivery', ['mailCustomer']],
    ['ready', 'completed', []],
  ] as [OrderStatus, OrderStatus, string[]][])('%s → %s', (from, to, expected) => expect(effects(from, to)).toEqual(expected));
});

describe('reservation flow', () => {
  it.each([
    ['pending', 'accepted', true],
    ['pending', 'rejected', true],
    ['pending', 'cancelled', true],
    ['accepted', 'completed', true],
    ['accepted', 'cancelled', true],
    ['rejected', 'accepted', false],
    ['cancelled', 'accepted', false],
    ['pending', 'completed', false],
    ['completed', 'cancelled', false],
  ] as const)('%s → %s: %s', (from, to, ok) => expect(canTransitionReservation(from, to)).toBe(ok));
});
