import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('mongodb'),
  PAYLOAD_SECRET: z.string().min(32),
  APP_URL: z.url(),
});

type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

// Parsed on first property access, never at import, so `next build` works with no env set.
export const env = new Proxy({} as Env, {
  get(_, key: string) {
    parsed ??= schema.parse(process.env);
    return parsed[key as keyof Env];
  },
});

// `next build` evaluates payload.config.ts while collecting page data; it must not read env then.
export const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
