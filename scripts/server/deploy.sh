#!/usr/bin/env bash
# Builds `main` from GitHub on this server and releases it. Installed as /usr/local/bin/gg-deploy.
#   gg-deploy         deploy now (from your machine: npm run deploy)
#   gg-deploy --auto  run every minute by /etc/cron.d/golden-grape: deploys a new commit once its CI run passed
export HOME=/root NVM_DIR=/root/.nvm
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
set -euo pipefail

BASE=/opt/golden-grape
REPO=Aniket-Subudh1/golden-grape
FAILED="$BASE/last-failed-sha"

exec 8>/run/gg-build.lock
flock -n 8 || { [ "${1:-}" = "--auto" ] && exit 0; echo "a deployment is already running"; exit 1; }

cd "$BASE/source"
SHA="$(git ls-remote origin refs/heads/main | cut -f1)"

if [ "${1:-}" = "--auto" ]; then
  DEPLOYED="$(basename "$(readlink -f "$BASE/current")")"
  [ "${DEPLOYED%%-*}" != "$SHA" ] || exit 0
  [ "$(cat "$FAILED" 2>/dev/null)" != "$SHA" ] || exit 0
  # Only once this commit's CI run has passed. No run (docs-only push): nothing to deploy.
  CI="$(curl -fsS -m 15 "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA&event=push&per_page=1" | grep -m1 '"conclusion"' || true)"
  [[ "$CI" == *'"success"'* ]] || exit 0
fi

echo "$(date -u +%FT%TZ) deploying $SHA"
trap 'echo "$SHA" > "$FAILED"; echo "deployment of $SHA FAILED, the site keeps running the previous release" >&2' ERR
git fetch -q origin main
git reset -q --hard "$SHA"
install -m 755 scripts/server/deploy.sh /usr/local/bin/gg-deploy
install -m 755 scripts/server/receive-release.sh /usr/local/bin/gg-receive-release
npm ci --no-audit --no-fund --loglevel=error
NODE_OPTIONS=--max-old-space-size=2048 npm run build >/tmp/gg-build.log 2>&1 || { tail -30 /tmp/gg-build.log >&2; false; }
cp -r .next/static .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r public .next/standalone/public
tar -C .next/standalone --exclude='./.env*' -czf /tmp/gg-release.tgz .
SSH_ORIGINAL_COMMAND="$SHA" gg-receive-release </tmp/gg-release.tgz
rm -f /tmp/gg-release.tgz "$FAILED"
