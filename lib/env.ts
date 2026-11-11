import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { z } from 'zod';

const optional = z.string().optional();

const schema = z.object({
  DATABASE_URL: z.string().startsWith('mongodb'),
  PAYLOAD_SECRET: z.string().min(32),
  APP_URL: z.url(),
  // S3-compatible media storage. Unset → uploads go to the local `media/` folder.
  S3_ENDPOINT: z.url().optional(),
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
  S3_REGION: z.string().default('auto'),
  // SMTP. Unset → e-mails are logged instead of sent.
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  SMTP_SECURE: z.stringbool().default(false),
  MAIL_FROM: z.string().default('Golden Grape <hello@goldengrape.lu>'),
  MAIL_STAFF_TO: z.email().optional(),
  // Scheduled jobs (app/api/cron/[job]): the host's cron sends it as a Bearer token. Unset → the jobs refuse every call.
  CRON_SECRET: z.string().min(24).optional(),
});

type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

// Parsed on first property access, never at import, so `next build` works with no env set.
// Empty values (`S3_BUCKET=`) count as unset.
export const env = new Proxy({} as Env, {
  get(_, key: string) {
    parsed ??= schema.parse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')));
    return parsed[key as keyof Env];
  },
});

// `next build` evaluates payload.config.ts while collecting page data; it must not read env then.
export const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

// Prerendered pages bake absolute canonical/hreflang URLs, so APP_URL is also read at build time.
export const appUrl = () => (isBuildPhase ? (process.env.APP_URL ?? 'http://localhost:3000') : env.APP_URL);

export const s3Configured = () => !isBuildPhase && Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
export const smtpConfigured = () => !isBuildPhase && Boolean(env.SMTP_HOST);
