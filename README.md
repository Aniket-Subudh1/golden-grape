# Golden Grape Luxembourg

Multilingual website, webshop and back office for Golden Grape Luxembourg (Bissen).
Next.js 16 + Payload CMS 3 + MongoDB in one app.

## Setup

Requires Node `^22.23.4` or `>=24.22.1`.

1. `cp .env.example .env` and set `PAYLOAD_SECRET` (`openssl rand -hex 32`).
2. `docker compose up -d` (MongoDB replica set, Mailpit, MinIO), or run a local `mongod --replSet rs0`.
3. `npm ci && npm run dev`
4. Open http://localhost:3000/admin and create the first admin. Health check: http://localhost:3000/api/health

Before writing code, read `docs/00-START-HERE.md`.

## Scheduled jobs

The host's cron calls `GET /api/cron/<job>` with `Authorization: Bearer $CRON_SECRET` (`scripts/server/gg-job.sh`, installed as `/usr/local/bin/gg-job`). The schedule is `scripts/server/golden-grape-jobs.cron`, copied by hand to `/etc/cron.d/golden-grape-jobs`; it assumes the server runs on Europe/Luxembourg time.

| Job | When | What |
|---|---|---|
| `quotations-expire` | daily 02:30 | sent catering quotations past their validity become "Expiré" |
| `low-stock-digest` | daily 07:00 | one e-mail to Réglages › Modules et alertes › "E-mail du stock bas" listing every size at or below its level; nothing is sent when nothing is low |

Run one by hand on the server: `gg-job low-stock-digest`.
