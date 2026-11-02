import type { Access } from 'payload';

export const ROLES = ['admin', 'manager', 'sales', 'stock', 'attendance'] as const;
export type Role = (typeof ROLES)[number];

type UserLike = { collection?: unknown; roles?: unknown } | null | undefined;

// Admin is always allowed; no roles listed means any staff user.
export function hasRole(user: UserLike, roles: readonly Role[]): boolean {
  if (user?.collection !== 'users' || !Array.isArray(user.roles)) return false;
  const own: unknown[] = user.roles;
  return own.includes('admin') || roles.length === 0 || roles.some((role) => own.includes(role));
}

/** `admin.hidden` for collections and globals: hidden unless the user has one of `roles`. */
export const hiddenUnless =
  (...roles: Role[]) =>
  ({ user }: { user: UserLike }) =>
    !hasRole(user, roles);

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
