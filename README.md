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
