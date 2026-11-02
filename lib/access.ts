import type { Access, TypedUser } from 'payload';

export const ROLES = ['admin', 'manager', 'sales', 'stock', 'attendance'] as const;
export type Role = (typeof ROLES)[number];

// Admin is always allowed; no roles listed means any staff user.
export function hasRole(user: TypedUser | null | undefined, roles: readonly Role[]): boolean {
  if (user?.collection !== 'users') return false;
  return user.roles.includes('admin') || roles.length === 0 || roles.some((role) => user.roles.includes(role));
}

export const isStaff =
  (...roles: Role[]): Access =>
  ({ req }) =>
    hasRole(req.user, roles);

// Staff see everything; any other signed-in user sees only documents whose `field` points at them.
export const staffOrSelf =
  (field: string): Access =>
  ({ req: { user } }) => {
    if (!user) return false;
    if (user.collection === 'users') return true;
    return { [field]: { equals: user.id } };
  };

export const publicRead: Access = () => true;

export const published: Access = ({ req: { user } }) =>
  user?.collection === 'users' ? true : { _status: { equals: 'published' } };

export const none: Access = () => false;
