import { headers } from 'next/headers';
import type { Payload, TypedUser } from 'payload';
import { z } from 'zod';
import { hasRole, type Role } from './access';
import { AppError, type ErrorCode } from './errors';
import { getPayloadClient } from './payload';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; message?: string; fieldErrors?: Record<string, string[]> };

type StaffUser = Extract<TypedUser, { collection: 'users' }>;
type Input<S extends z.ZodType> = FormData | z.input<S>;

const toObject = (input: unknown) => (input instanceof FormData ? Object.fromEntries(input) : input);

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>, payload: Payload, user: TypedUser | null) => Promise<T>,
  allow: (user: TypedUser | null) => boolean,
): Promise<ActionResult<T>> {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: await headers() });
  if (!allow(user)) return { ok: false, error: 'FORBIDDEN' };
  const parsed = schema.safeParse(toObject(input));
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION', fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }
  try {
    return { ok: true, data: await fn(parsed.data, payload, user) };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return {
      ok: false,
      error: error.code,
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
    };
  }
}

// Staff-only server action. Usable directly with useActionState: (prevState, formData).
export const action =
  <S extends z.ZodType, T>(
    schema: S,
    { roles }: { roles: Role[] },
    fn: (input: z.output<S>, ctx: { payload: Payload; user: StaffUser }) => Promise<T>,
  ) =>
  async (_prev: unknown, input: Input<S>) =>
    run(schema, input, (data, payload, user) => fn(data, { payload, user: user as StaffUser }), (user) =>
      hasRole(user, roles),
    );

// Public server action; `user` is whoever is signed in, if anyone.
export const publicAction =
  <S extends z.ZodType, T>(
    schema: S,
    fn: (input: z.output<S>, ctx: { payload: Payload; user: TypedUser | null }) => Promise<T>,
  ) =>
  async (_prev: unknown, input: Input<S>) =>
    run(schema, input, (data, payload, user) => fn(data, { payload, user }), () => true);
