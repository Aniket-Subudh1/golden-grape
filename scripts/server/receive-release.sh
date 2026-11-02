#!/usr/bin/env bash
# Called by gg-deploy: `SSH_ORIGINAL_COMMAND=<git-sha> gg-receive-release < release.tgz`.
# Unpacks a release, switches to it with no downtime, and rolls back if it is not healthy.
# Installed as /usr/local/bin/gg-receive-release (see docs/02-ARCHITECTURE.md §9).
export HOME=/root NVM_DIR=/root/.nvm
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
set -euo pipefail

BASE=/opt/golden-grape
KEEP=3
SHA="${SSH_ORIGINAL_COMMAND:-}"
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "expected a git sha, got: '$SHA'" >&2; exit 64; }

# One deployment at a time.
exec 9>/run/gg-deploy.lock
flock 9

mkdir -p "$BASE/releases" "$BASE/shared/next-cache"
INCOMING="$(mktemp -d "$BASE/releases/.incoming.XXXXXX")"
trap 'rm -rf "$INCOMING"' EXIT
tar -xz -C "$INCOMING"
[ -f "$INCOMING/server.js" ] || { echo "not a release: server.js missing" >&2; exit 65; }
rm -f "$INCOMING"/.env*                                      # secrets live only in $BASE/.env
chmod 755 "$INCOMING"                                        # nginx serves .next/static from here
rm -rf "$INCOMING/.next/cache"
ln -s "$BASE/shared/next-cache" "$INCOMING/.next/cache"      # optimised images survive deployments

RELEASE="$BASE/releases/$SHA"
# Re-running a deployment of the same commit must not touch the release that is serving.
[ -e "$RELEASE" ] && RELEASE="$RELEASE-$(date +%s)"
PREVIOUS="$(readlink -f "$BASE/current" 2>/dev/null || true)"
mv "$INCOMING" "$RELEASE"

switch_to() {
  ln -sfn "$1" "$BASE/current.new"
  mv -Tf "$BASE/current.new" "$BASE/current"
  pm2 reload "$BASE/ecosystem.config.cjs" --update-env >/dev/null
}

# Healthy = the running process really is this release, and it serves the database check and a page.
healthy() {
  local i pid
  for i in $(seq 1 30); do
    pid="$(pm2 pid golden-grape 2>/dev/null | tail -1)"
    if [ -n "$pid" ] && [ "$pid" != "0" ] \
      && [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$1" ] \
      && curl -fsS -m 5 -o /dev/null http://127.0.0.1:3000/api/health \
      && curl -fsS -m 15 -o /dev/null http://127.0.0.1:3000/fr; then
      return 0
    fi
    sleep 2
  done
  return 1
}

switch_to "$RELEASE"
if ! healthy "$RELEASE"; then
  echo "release $SHA is NOT healthy" >&2
  pm2 logs golden-grape --lines 20 --nostream 2>&1 | tail -25 >&2 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "rolling back to $(basename "$PREVIOUS")" >&2
    switch_to "$PREVIOUS"
    healthy "$PREVIOUS" && echo "rollback OK" >&2 || echo "ROLLBACK ALSO UNHEALTHY" >&2
  fi
  rm -rf "$RELEASE"
  exit 1
fi
pm2 save --force >/dev/null

# Keep the newest releases (always including the current one).
cd "$BASE/releases"
ls -1dt -- */ | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$(readlink -f "$old")" = "$RELEASE" ] || rm -rf -- "$old"
done

echo "deployed $SHA"
