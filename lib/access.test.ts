import { describe, expect, it } from 'vitest';
import { effectiveRoles, hasRole } from './access';
import { cleanGrants } from '@/modules/settings/team';

// Team & access: what every access check reads is a person's roles plus the areas the owner gave those roles.

describe('effectiveRoles', () => {
  it('a role gets the areas it was given; nothing else, no duplicates, in the roles’ order', () => {
    expect(effectiveRoles(['sales'], { sales: ['stock'] })).toEqual(['sales', 'stock']);
    expect(effectiveRoles(['sales', 'stock'], { sales: ['stock'], stock: ['attendance'] })).toEqual(['sales', 'stock', 'attendance']);
    expect(effectiveRoles(['stock'], { sales: ['manager'] })).toEqual(['stock']);
    expect(effectiveRoles([], { sales: ['stock'] })).toEqual([]);
    expect(effectiveRoles(['admin'], {})).toEqual(['admin']);
    expect(effectiveRoles(['sales', 'bogus'], null)).toEqual(['sales']);
  });

  it('hasRole reads the effective roles, else the roles', () => {
    const sales = { collection: 'users', roles: ['sales'] };
    expect(hasRole(sales, ['stock'])).toBe(false);
    expect(hasRole({ ...sales, effectiveRoles: ['sales', 'stock'] }, ['stock'])).toBe(true);
    expect(hasRole({ ...sales, effectiveRoles: ['sales'] }, ['stock'])).toBe(false);
    expect(hasRole({ collection: 'customers', roles: ['admin'], effectiveRoles: ['admin'] }, [])).toBe(false);
  });
});

describe('cleanGrants', () => {
  it('keeps known roles and areas only, never a role’s own area nor the owner’s', () => {
    expect(cleanGrants({ sales: ['stock', 'sales', 'admin', 'x'], admin: ['sales'], stock: [], foo: ['sales'], attendance: 'stock' })).toEqual({ sales: ['stock'] });
  });
});
