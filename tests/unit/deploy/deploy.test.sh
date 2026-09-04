#!/usr/bin/env bash
# Local safety tests for deploy/production/deploy.sh (no production host).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
DEPLOY="$REPO/deploy/production/deploy.sh"
FAILS=0

assert() {
  local name="$1"
  shift
  if "$@"; then
    printf 'ok  %s\n' "$name"
  else
    printf 'FAIL  %s\n' "$name"
    FAILS=$((FAILS + 1))
  fi
}

assert_eq() {
  local name="$1" got="$2" want="$3"
  if [[ "$got" == "$want" ]]; then
    printf 'ok  %s\n' "$name"
  else
    printf 'FAIL  %s\n    got:  %s\n    want: %s\n' "$name" "$got" "$want"
    FAILS=$((FAILS + 1))
  fi
}

assert_contains() {
  local name="$1" hay="$2" needle="$3"
  if [[ "$hay" == *"$needle"* ]]; then
    printf 'ok  %s\n' "$name"
  else
    printf 'FAIL  %s\n    missing %s in:\n%s\n' "$name" "$needle" "$hay"
    FAILS=$((FAILS + 1))
  fi
}

WORKDIR="$(mktemp -d "$REPO/tests/unit/deploy/.tmp-XXXXXX")"
trap 'rm -rf "$WORKDIR"' EXIT

make_git_fixture() {
  local src="$1"
  mkdir -p "$src/backend/src" "$src/website/src" "$src/packages/shared"
  printf '%s\n' '{"name":"flowlary","private":true,"workspaces":["packages/*","backend","website"]}' >"$src/package.json"
  printf '%s\n' '{"lockfileVersion":3}' >"$src/package-lock.json"
  printf '%s\n' 'export {}' >"$src/backend/src/index.ts"
  git -C "$src" init -q --template=
  git -C "$src" config core.hooksPath /dev/null
  git -C "$src" config user.email test@example.com
  git -C "$src" config user.name Test
  git -C "$src" add .
  git -C "$src" commit -q -m 'fixture'
}

make_stubs() {
  local bin="$1"
  mkdir -p "$bin"
  cat >"$bin/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-}"
if [[ "$cmd" == ci ]]; then
  mkdir -p node_modules
  exit 0
fi
if [[ "$cmd" == run && "${2:-}" == test ]]; then
  exit 0
fi
if [[ "$cmd" == run && "${2:-}" == build ]]; then
  mkdir -p website/dist
  printf '<!doctype html><html><head><title>Flowlary · Write where you are</title></head><body>ok</body></html>\n' >website/dist/index.html
  exit 0
fi
echo "unexpected npm: $*" >&2
exit 1
EOF
  cat >"$bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${FLOWLARY_CURL_FAIL:-0}" == 1 ]]; then
  echo '{"ok":false}' 
  exit 22
fi
url="${@: -1}"
if [[ "$*" == *'-w'* && "$*" == *'%{http_code}'* ]]; then
  printf '200'
  exit 0
fi
if [[ "$url" == */health ]]; then
  printf '%s\n' '{"ok":true,"service":"flowlary-ai-gateway"}'
  exit 0
fi
if [[ "$url" == */ready ]]; then
  printf '%s\n' '{"ok":true,"ready":true,"checks":[]}'
  exit 0
fi
printf '%s\n' '<!doctype html><title>Flowlary · Write where you are</title>'
exit 0
EOF
  cat >"$bin/node" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == -p ]]; then
  echo 22
  exit 0
fi
echo v22.0.0
exit 0
EOF
  chmod +x "$bin/npm" "$bin/curl" "$bin/node"
}

run_deploy() {
  local root="$1"
  shift
  env PATH="$STUBS:/usr/bin:/bin:/usr/local/bin" \
    FLOWLARY_ROOT="$root" \
    FLOWLARY_ALLOW_NONPROD_ROOT=1 \
    FLOWLARY_SKIP_PUBLIC_HEALTH=1 \
    FLOWLARY_SKIP_RESTART=0 \
    FLOWLARY_API_RESTART_CMD="${FLOWLARY_API_RESTART_CMD:-true}" \
    FLOWLARY_HEALTH_WAIT_SECS=2 \
    FLOWLARY_NPM=npm \
    FLOWLARY_CURL=curl \
    "$DEPLOY" "$@"
}

STUBS="$WORKDIR/bin"
make_stubs "$STUBS"

echo '== syntax =='
assert 'bash -n production script' bash -n "$DEPLOY"
assert 'bash -n repo wrapper' bash -n "$REPO/deploy.sh"
assert 'bash -n restart example' bash -n "$REPO/deploy/production/flowlary-api-restart.example.sh"

echo '== help =='
help_out="$("$DEPLOY" help)"
assert_contains 'help mentions rollback' "$help_out" 'rollback'
assert_contains 'help mentions status' "$help_out" 'status'

echo '== isolation =='
zaixos="$WORKDIR/zaixos/nested"
mkdir -p "$zaixos/shared" "$zaixos/releases"
printf 'x' >"$zaixos/shared/.env"
set +e
zaix_out="$(
  env PATH="$STUBS:/usr/bin:/bin" FLOWLARY_ROOT="$zaixos" FLOWLARY_ALLOW_NONPROD_ROOT=1 \
    "$DEPLOY" status 2>&1
)"
zaix_code=$?
set -e
assert_eq 'refuse zaixos path' "$zaix_code" 1
assert_contains 'zaixos error text' "$zaix_out" 'ZAIXOS'

echo '== missing env =='
noroots="$WORKDIR/noenv"
mkdir -p "$noroots/shared" "$noroots/releases"
set +e
env_out="$(
  env PATH="$STUBS:/usr/bin:/bin" FLOWLARY_ROOT="$noroots" FLOWLARY_ALLOW_NONPROD_ROOT=1 \
    "$DEPLOY" status 2>&1
)"
env_code=$?
set -e
assert_eq 'missing .env fails' "$env_code" 1
assert_contains 'missing env message' "$env_out" 'missing production env'

echo '== deploy + status + rollback =='
ROOT="$WORKDIR/prod"
mkdir -p "$ROOT/shared/data" "$ROOT/shared/logs" "$ROOT/releases"
printf 'SECRET=do-not-print\n' >"$ROOT/shared/.env"
chmod 600 "$ROOT/shared/.env"

SRC="$WORKDIR/src"
make_git_fixture "$SRC"
git clone --bare "$SRC" "$ROOT/repo.git" >/dev/null
SHA="$(git --git-dir="$ROOT/repo.git" rev-parse HEAD)"

RESTART_LOG="$WORKDIR/restarts"
: >"$RESTART_LOG"
export FLOWLARY_API_RESTART_CMD="printf restart >>'$RESTART_LOG'"

out="$(run_deploy "$ROOT" "$SHA" 2>&1)"
assert_contains 'deploy logs sha' "$out" "$SHA"
assert_eq 'current symlink' "$(basename "$(readlink "$ROOT/current")")" "$SHA"
assert 'website dist exists' test -f "$ROOT/current/website/dist/index.html"
assert 'backend .env is symlink' test -L "$ROOT/current/backend/.env"
assert_eq 'env target' "$(readlink "$ROOT/current/backend/.env")" "$ROOT/shared/.env"
assert 'did not copy secrets into release' test ! -f "$ROOT/releases/$SHA/.env"
assert_contains 'did not print secret' "$out" 'deploying'
if [[ "$out" == *SECRET* ]]; then
  printf 'FAIL  leaked secret into deploy output\n'
  FAILS=$((FAILS + 1))
else
  printf 'ok  no secret leak\n'
fi
assert 'restart invoked' test -s "$RESTART_LOG"

st="$(run_deploy "$ROOT" status 2>&1)"
assert_contains 'status current' "$st" "$SHA"

# Second commit so rollback has a distinct previous
git --git-dir="$SRC/.git" --work-tree="$SRC" commit --allow-empty -q -m 'second'
git --git-dir="$ROOT/repo.git" fetch -q "$SRC" HEAD:refs/heads/main 2>/dev/null \
  || git --git-dir="$ROOT/repo.git" fetch -q "$SRC" '+refs/heads/*:refs/heads/*'
SHA2="$(git --git-dir="$SRC/.git" rev-parse HEAD)"
git --git-dir="$ROOT/repo.git" fetch -q "$SRC" "$SHA2:refs/heads/main"

out2="$(run_deploy "$ROOT" "$SHA2" 2>&1)"
assert_eq 'current after second deploy' "$(basename "$(readlink "$ROOT/current")")" "$SHA2"
assert_eq 'previous file' "$(tr -d '[:space:]' <"$ROOT/shared/previous")" "$SHA"

rb="$(run_deploy "$ROOT" rollback 2>&1)"
assert_eq 'current after rollback' "$(basename "$(readlink "$ROOT/current")")" "$SHA"
assert_contains 'rollback message' "$rb" "rolling back $SHA2 -> $SHA"
assert_eq 'previous after rollback is failed/new' "$(tr -d '[:space:]' <"$ROOT/shared/previous")" "$SHA2"

echo '== concurrency =='
LOCK="$ROOT/shared/deploy.lock"
mkdir "$LOCK"
printf '%s\n' "$$" >"$LOCK/pid"
set +e
lock_out="$(run_deploy "$ROOT" "$SHA2" 2>&1)"
lock_code=$?
set -e
assert_eq 'busy lock fails deploy' "$lock_code" 1
assert_contains 'busy lock message' "$lock_out" 'another deploy is running'
rm -rf "$LOCK"

echo '== stale lock =='
mkdir "$LOCK"
printf '1\n' >"$LOCK/pid"
# pid 1 may be alive; use a definitely dead pid
printf '999999\n' >"$LOCK/pid"
if kill -0 999999 2>/dev/null; then
  printf 'skip stale-lock (pid unexpectedly alive)\n'
else
  out_stale="$(run_deploy "$ROOT" "$SHA2" 2>&1)"
  assert_contains 'stale lock recovered' "$out_stale" "$SHA2"
  assert_eq 'current after stale-lock deploy' "$(basename "$(readlink "$ROOT/current")")" "$SHA2"
fi
rm -rf "$LOCK" 2>/dev/null || true

echo '== auto-rollback on health failure =='
ROOT2="$WORKDIR/prod2"
mkdir -p "$ROOT2/shared" "$ROOT2/releases"
printf 'x\n' >"$ROOT2/shared/.env"
git clone --bare "$SRC" "$ROOT2/repo.git" >/dev/null
# Seed a previous complete release without going through health
OLD="$(git --git-dir="$ROOT2/repo.git" rev-parse HEAD)"
# Use first SHA from original fixture — repo.git HEAD may be SHA2
# Create old release dir from a successful extract of HEAD~ if exists
FIRST="$(git --git-dir="$ROOT2/repo.git" rev-list --max-parents=0 HEAD | tail -1)"
mkdir -p "$ROOT2/releases/$FIRST/backend/src" "$ROOT2/releases/$FIRST/website/dist" "$ROOT2/releases/$FIRST/node_modules"
printf 'ok\n' >"$ROOT2/releases/$FIRST/website/dist/index.html"
printf 'lock\n' >"$ROOT2/releases/$FIRST/package-lock.json"
ln -sfn "$ROOT2/shared/.env" "$ROOT2/releases/$FIRST/backend/.env"
ln -sfn "$ROOT2/releases/$FIRST" "$ROOT2/current"
printf '%s\n' "$FIRST" >"$ROOT2/shared/previous"

set +e
fail_out="$(
  env PATH="$STUBS:/usr/bin:/bin:/usr/local/bin" \
    FLOWLARY_ROOT="$ROOT2" \
    FLOWLARY_ALLOW_NONPROD_ROOT=1 \
    FLOWLARY_SKIP_PUBLIC_HEALTH=1 \
    FLOWLARY_API_RESTART_CMD=true \
    FLOWLARY_HEALTH_WAIT_SECS=1 \
    FLOWLARY_CURL_FAIL=1 \
    FLOWLARY_SKIP_TESTS=1 \
    "$DEPLOY" HEAD 2>&1
)"
fail_code=$?
set -e
assert_eq 'failed health exits non-zero' "$fail_code" 1
assert_contains 'auto rollback mentioned' "$fail_out" 'auto-rollback'
assert_eq 'current restored after failed deploy' "$(basename "$(readlink "$ROOT2/current")")" "$FIRST"

echo '== tmp cleanup =='
mkdir -p "$ROOT/shared/tmp/deploy-junk"
run_deploy "$ROOT" status >/dev/null
# status does not clean; deploy does
run_deploy "$ROOT" "$SHA2" >/dev/null
assert 'tmp deploy-* removed after success' test ! -e "$ROOT/shared/tmp/deploy-junk" -o ! -d "$ROOT/shared/tmp/deploy-junk"
# deploy cleanup only removes deploy-* names; junk without prefix remains — check deploy-* gone
leftover="$(find "$ROOT/shared/tmp" -name 'deploy-*' | wc -l | tr -d ' ')"
assert_eq 'no deploy-* leftovers' "$leftover" 0

echo '== never start dev server =='
if grep -n "dev:api\|npm run dev\|vite " "$DEPLOY" | grep -v 'never starts a dev'; then
  # allow comment mentions only
  if grep -E 'npm run dev|dev:api' "$DEPLOY" | grep -v '#'; then
    printf 'FAIL  production script invokes a dev server\n'
    FAILS=$((FAILS + 1))
  else
    printf 'ok  no dev-server invocation\n'
  fi
else
  printf 'ok  no dev-server invocation\n'
fi

if grep -E 'pm2|docker compose|supervisorctl restart all' "$DEPLOY"; then
  printf 'FAIL  forbidden process manager usage\n'
  FAILS=$((FAILS + 1))
else
  printf 'ok  no docker/pm2/restart-all\n'
fi

if (( FAILS > 0 )); then
  printf '\n%d test(s) failed\n' "$FAILS"
  exit 1
fi
printf '\nall deploy tests passed\n'
exit 0
