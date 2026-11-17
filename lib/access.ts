import type { Access } from 'payload';

export const ROLES = ['admin', 'manager', 'sales', 'stock', 'attendance'] as const;
export type Role = (typeof ROLES)[number];

type UserLike = { collection?: unknown; roles?: unknown; effectiveRoles?: unknown } | null | undefined;

/** The roles the owner can widen (Team & access): each may be given the areas of the others. The owner has all. */
export const GRANTABLE = ['manager', 'sales', 'stock', 'attendance'] as const satisfies readonly Role[];
export type Grantable = (typeof GRANTABLE)[number];
/** Extra areas per role, as saved on Team & access (`BusinessSettings.access.grants`). */
export type Grants = Partial<Record<Grantable, Grantable[]>>;

/** A person's roles plus the areas their roles were given: what every access check reads (sorted, no duplicates). */
export function effectiveRoles(roles: readonly string[] | null | undefined, grants: Grants | null | undefined): Role[] {
  const own = (roles ?? []).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const extra = own.flatMap((r) => (r in (grants ?? {}) ? (grants?.[r as Grantable] ?? []) : []));
  return ROLES.filter((r) => own.includes(r) || (extra as string[]).includes(r));
}

// Admin is always allowed; no roles listed means any staff user. The roles checked are the person's effective roles
// (their own and the areas the owner gave those roles, kept on the account by modules/settings), else their own.
export function hasRole(user: UserLike, roles: readonly Role[]): boolean {
  if (user?.collection !== 'users' || !Array.isArray(user.roles)) return false;
  const own: unknown[] = Array.isArray(user.effectiveRoles) && user.effectiveRoles.length ? user.effectiveRoles : user.roles;
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
