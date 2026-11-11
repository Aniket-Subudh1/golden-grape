#!/bin/sh
# Installed on the server as /usr/local/bin/gg-job (mode 755). `gg-job <job>` runs one scheduled job of the app
# (app/api/cron/[job]) on the local port, with the CRON_SECRET of /opt/golden-grape/.env.
# Called by /etc/cron.d/golden-grape-jobs (scripts/server/golden-grape-jobs.cron); output in /var/log/gg-jobs.log.
set -eu
SECRET=$(grep '^CRON_SECRET=' /opt/golden-grape/.env | tail -1 | cut -d= -f2-)
printf '%s %s ' "$(date -u +%Y-%m-%dT%H:%MZ)" "$1"
curl -fsS --max-time 60 -H "Authorization: Bearer $SECRET" "http://127.0.0.1:3000/api/cron/$1"
echo
