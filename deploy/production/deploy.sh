#!/usr/bin/env bash
# Flowlary production deploy: immutable releases + current symlink + Supervisor.
# Run on the VPS as flowlary-deploy. Never against ZAIXOS.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./deploy.sh                 Deploy origin/main (or FLOWLARY_GIT_REF)
  ./deploy.sh <git-ref>       Deploy an exact tag, branch, or SHA
  ./deploy.sh rollback        Point current at the previous release and restart
  ./deploy.sh status          Show current/previous releases and health
  ./deploy.sh help            Show this help

This script must run on the Flowlary production tree (/var/www/flowlary).
It never writes into the live release, never starts a dev server, and never
touches ZAIXOS, nginx, TLS, or production secrets files.
EOF
}

log() { printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

is_full_sha() {
  [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]]
}

script_dir() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L $src ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ $src == /* ]] || src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}

default_root() {
  local here parent
  here="$(script_dir)"
  parent="$(cd "$here/../.." && pwd)"
  if [[ -d /var/www/flowlary/shared && -d /var/www/flowlary/releases ]]; then
    printf '%s\n' /var/www/flowlary
    return
  fi
  # Copied to $FLOWLARY_ROOT/deploy.sh
  if [[ -d "$(cd "$here/.." && pwd)/shared" && -d "$(cd "$here/.." && pwd)/releases" ]]; then
    cd "$here/.." && pwd
    return
  fi
  # Git clone: deploy/production/deploy.sh — still default to production path
  if [[ "$(basename "$here")" == production && "$(basename "$(dirname "$here")")" == deploy ]]; then
    printf '%s\n' /var/www/flowlary
    return
  fi
  printf '%s\n' "$parent"
}

ROOT="${FLOWLARY_ROOT:-$(default_root)}"
REMOTE="${FLOWLARY_GIT_REMOTE:-https://github.com/MoomenALdahdouh/flowlary.git}"
KEEP="${FLOWLARY_KEEP_RELEASES:-5}"
HEALTH_LOCAL="${FLOWLARY_HEALTH_LOCAL:-http://127.0.0.1:9087}"
HEALTH_PUBLIC_API="${FLOWLARY_HEALTH_PUBLIC_API:-https://api.flowlary.com}"
HEALTH_PUBLIC_WEB="${FLOWLARY_HEALTH_PUBLIC_WEB:-https://flowlary.com}"
HEALTH_WAIT_SECS="${FLOWLARY_HEALTH_WAIT_SECS:-45}"
NPM_BIN="${FLOWLARY_NPM:-npm}"
GIT_BIN="${FLOWLARY_GIT:-git}"
CURL_BIN="${FLOWLARY_CURL:-curl}"
SKIP_TESTS="${FLOWLARY_SKIP_TESTS:-0}"
SKIP_BUILD="${FLOWLARY_SKIP_BUILD:-0}"
SKIP_PUBLIC="${FLOWLARY_SKIP_PUBLIC_HEALTH:-0}"
ALLOW_NONPROD="${FLOWLARY_ALLOW_NONPROD_ROOT:-0}"
SKIP_RESTART="${FLOWLARY_SKIP_RESTART:-0}"

SHARED="$ROOT/shared"
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
PREV_FILE="$SHARED/previous"
LOCKDIR="$SHARED/deploy.lock"
TMP_BASE="$SHARED/tmp"
ENV_FILE="$SHARED/.env"

CMD="${1:-deploy}"
REF="${FLOWLARY_GIT_REF:-origin/main}"
case "$CMD" in
  help|-h|--help) usage; exit 0 ;;
  rollback|status) ;;
  deploy) ;;
  *)
    if [[ "$CMD" == -* ]]; then
      die "unknown option: $CMD"
    fi
    REF="$CMD"
    CMD=deploy
    ;;
esac

assert_isolation() {
  local resolved
  resolved="$(cd "$ROOT" 2>/dev/null && pwd || printf '%s' "$ROOT")"
  case "$resolved" in
    */zaixos|*/zaixos/*)
      die "refusing to run under ZAIXOS path: $resolved"
      ;;
  esac
  if [[ "$resolved" != /var/www/flowlary && "$ALLOW_NONPROD" != 1 ]]; then
    die "FLOWLARY_ROOT must be /var/www/flowlary (got $resolved). For tests set FLOWLARY_ALLOW_NONPROD_ROOT=1."
  fi
  if [[ ${EUID} -eq 0 ]]; then
    die "refuse to run as root; use flowlary-deploy"
  fi
}

assert_preflight() {
  require_cmd "$GIT_BIN"
  require_cmd "$NPM_BIN"
  require_cmd "$CURL_BIN"
  require_cmd tar
  require_cmd node
  [[ -d $ROOT ]] || die "missing FLOWLARY_ROOT: $ROOT"
  mkdir -p "$SHARED" "$RELEASES" "$TMP_BASE"
  [[ -d $SHARED && -d $RELEASES ]] || die "expected $SHARED and $RELEASES"
  [[ -f $ENV_FILE ]] || die "missing production env $ENV_FILE (not created by this script)"
  if [[ ! -r $ENV_FILE ]]; then
    die "cannot read $ENV_FILE"
  fi
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "${node_major:-0}" -lt 20 ]]; then
    die "Node >= 20 required (found $(node -v))"
  fi
}

current_sha() {
  if [[ -L $CURRENT ]]; then
    basename "$(readlink "$CURRENT")"
  elif [[ -d $CURRENT ]]; then
    basename "$(cd "$CURRENT" && pwd)"
  else
    printf ''
  fi
}

previous_sha() {
  if [[ -f $PREV_FILE ]]; then
    tr -d '[:space:]' <"$PREV_FILE"
  fi
}

release_path() {
  printf '%s/%s\n' "$RELEASES" "$1"
}

acquire_lock() {
  mkdir -p "$SHARED"
  if mkdir "$LOCKDIR" 2>/dev/null; then
    printf '%s\n' "$$" >"$LOCKDIR/pid"
    return 0
  fi
  local old
  old="$(cat "$LOCKDIR/pid" 2>/dev/null || true)"
  if [[ -n ${old:-} ]] && ! kill -0 "$old" 2>/dev/null; then
    log "removing stale deploy lock (pid $old)"
    rm -rf "$LOCKDIR"
    mkdir "$LOCKDIR"
    printf '%s\n' "$$" >"$LOCKDIR/pid"
    return 0
  fi
  die "another deploy is running (lock $LOCKDIR pid=${old:-unknown})"
}

release_lock() {
  if [[ -d $LOCKDIR ]]; then
    local owner
    owner="$(cat "$LOCKDIR/pid" 2>/dev/null || true)"
    if [[ "$owner" == "$$" ]]; then
      rm -rf "$LOCKDIR"
    fi
  fi
}

cleanup_tmp() {
  if [[ -d $TMP_BASE ]]; then
    find "$TMP_BASE" -mindepth 1 -maxdepth 1 -name "deploy-*" -exec rm -rf {} + 2>/dev/null || true
  fi
}

on_exit() {
  local code=$?
  release_lock
  if [[ $code -ne 0 ]]; then
    cleanup_tmp
  fi
  return $code
}

git_dir() {
  if [[ -d $ROOT/repo/.git ]]; then
    printf '%s\n' "$ROOT/repo/.git"
  elif [[ -d $ROOT/repo.git ]]; then
    printf '%s\n' "$ROOT/repo.git"
  else
    printf '%s\n' "$ROOT/repo.git"
  fi
}

ensure_git() {
  local gdir
  gdir="$(git_dir)"
  if [[ ! -d $gdir ]]; then
    log "cloning bare repo $REMOTE"
    "$GIT_BIN" clone --bare "$REMOTE" "$ROOT/repo.git"
    gdir="$ROOT/repo.git"
  fi
  log "fetching origin"
  if [[ -d $ROOT/repo/.git ]]; then
    "$GIT_BIN" -C "$ROOT/repo" fetch --prune origin
  else
    "$GIT_BIN" --git-dir="$gdir" fetch --prune origin
  fi
}

git_exec() {
  local gdir
  gdir="$(git_dir)"
  if [[ -d $ROOT/repo/.git ]]; then
    "$GIT_BIN" --git-dir="$gdir" --work-tree="$ROOT/repo" "$@"
  else
    "$GIT_BIN" --git-dir="$gdir" "$@"
  fi
}

resolve_sha() {
  local want="$1" sha
  if is_full_sha "$want"; then
    git_exec rev-parse --verify "${want}^{commit}"
    return
  fi
  if sha="$(git_exec rev-parse --verify "${want}^{commit}" 2>/dev/null)"; then
    printf '%s\n' "$sha"
    return
  fi
  if [[ "$want" != origin/* ]] && sha="$(git_exec rev-parse --verify "origin/${want}^{commit}" 2>/dev/null)"; then
    printf '%s\n' "$sha"
    return
  fi
  die "cannot resolve git ref: $want"
}

atomic_current() {
  local target="$1"
  [[ -d $target ]] || die "release directory missing: $target"
  ln -sfn "$target" "$CURRENT"
  local now
  now="$(readlink "$CURRENT")"
  [[ "$now" == "$target" ]] || die "failed to switch current to $target (now $now)"
}

link_env() {
  local dest="$1/backend/.env"
  [[ -d $1/backend ]] || die "release has no backend/: $1"
  ln -sfn "$ENV_FILE" "$dest"
  if [[ "$(readlink "$dest")" != "$ENV_FILE" ]]; then
    die "failed to link backend/.env -> $ENV_FILE"
  fi
}

make_dist_readable() {
  local dist="$1/website/dist"
  [[ -d $dist ]] || die "website dist missing after build: $dist"
  chmod -R a+rX "$dist" 2>/dev/null || true
}

release_complete() {
  local dir="$1"
  [[ -f $dir/package-lock.json ]] \
    && [[ -d $dir/node_modules ]] \
    && [[ -f $dir/website/dist/index.html ]] \
    && [[ -d $dir/backend/src ]] \
    && [[ -L $dir/backend/.env || -f $dir/backend/.env ]]
}

run_npm() {
  local dir="$1"
  shift
  (cd "$dir" && "$NPM_BIN" "$@")
}

build_release() {
  local sha="$1"
  local dest staging
  dest="$(release_path "$sha")"
  if [[ -d $dest ]] && release_complete "$dest"; then
    log "reusing existing complete release $sha"
    link_env "$dest"
    return 0
  fi
  if [[ -d $dest ]]; then
    log "incomplete release $sha — rebuilding in staging (existing dir left untouched until success)"
  fi
  staging="$TMP_BASE/deploy-$sha-$$"
  rm -rf "$staging"
  mkdir -p "$staging"
  log "extracting $sha"
  git_exec archive --format=tar "$sha" | tar -x -C "$staging"
  [[ -f $staging/package-lock.json ]] || die "archive missing package-lock.json"
  [[ -f $staging/backend/src/index.ts ]] || die "archive missing backend/src/index.ts"
  link_env "$staging"
  log "npm ci --include=dev"
  run_npm "$staging" ci --include=dev --no-audit --no-fund
  if [[ "$SKIP_TESTS" != 1 ]]; then
    log "tests: shared + backend"
    run_npm "$staging" run test -w @flowlary/shared
    run_npm "$staging" run test -w @flowlary/backend
  else
    log "skipping tests (FLOWLARY_SKIP_TESTS=1)"
  fi
  if [[ "$SKIP_BUILD" != 1 ]]; then
    log "building website"
    run_npm "$staging" run build -w @flowlary/website
  else
    mkdir -p "$staging/website/dist"
    printf '<!doctype html><title>Flowlary</title>\n' >"$staging/website/dist/index.html"
    log "skipping website build (FLOWLARY_SKIP_BUILD=1)"
  fi
  make_dist_readable "$staging"
  release_complete "$staging" || die "staging release incomplete"
  mkdir -p "$RELEASES"
  if [[ -d $dest ]]; then
    local bak="$TMP_BASE/replace-$sha-$$"
    mv "$dest" "$bak"
    if ! mv "$staging" "$dest"; then
      mv "$bak" "$dest"
      die "failed to replace release directory $sha"
    fi
    rm -rf "$bak"
  else
    mv "$staging" "$dest"
  fi
  log "release ready $dest"
}

ensure_restart_possible() {
  if [[ "$SKIP_RESTART" == 1 || -n ${FLOWLARY_API_RESTART_CMD:-} ]]; then
    return 0
  fi
  if sudo -n -l /usr/local/sbin/flowlary-api-restart >/dev/null 2>&1; then
    return 0
  fi
  if sudo -n -l supervisorctl restart flowlary-api >/dev/null 2>&1; then
    return 0
  fi
  die "cannot restart flowlary-api (current was NOT switched). Install NOPASSWD sudo for /usr/local/sbin/flowlary-api-restart — docs/operations/FLOWLARY_DEPLOY.md"
}

restart_api() {
  if [[ "$SKIP_RESTART" == 1 ]]; then
    log "skipping API restart (FLOWLARY_SKIP_RESTART=1)"
    return 0
  fi
  if [[ -n ${FLOWLARY_API_RESTART_CMD:-} ]]; then
    log "restarting API via FLOWLARY_API_RESTART_CMD"
    eval "$FLOWLARY_API_RESTART_CMD"
    return
  fi
  if sudo -n /usr/local/sbin/flowlary-api-restart >/dev/null 2>&1; then
    log "restarted flowlary-api via /usr/local/sbin/flowlary-api-restart"
    return
  fi
  if sudo -n supervisorctl restart flowlary-api >/dev/null 2>&1; then
    log "restarted flowlary-api via supervisorctl"
    return
  fi
  die "cannot restart flowlary-api after switch; run: $0 rollback"
}

curl_ok() {
  local url="$1"
  "$CURL_BIN" -fsS --max-time 10 "$url" >/dev/null 2>&1
}

curl_body() {
  local url="$1"
  "$CURL_BIN" -fsS --max-time 10 "$url" 2>/dev/null || true
}

health_local_ok() {
  local health ready
  health="$(curl_body "$HEALTH_LOCAL/health")"
  ready="$(curl_body "$HEALTH_LOCAL/ready")"
  [[ "$health" == *'"ok":true'* ]] || return 1
  [[ "$ready" == *'"ok":true'* && "$ready" == *'"ready":true'* ]] || return 1
  return 0
}

wait_health() {
  local deadline=$((SECONDS + HEALTH_WAIT_SECS))
  while (( SECONDS < deadline )); do
    if health_local_ok; then
      return 0
    fi
    sleep 1
  done
  return 1
}

verify_public() {
  if [[ "$SKIP_PUBLIC" == 1 ]]; then
    log "skipping public health (FLOWLARY_SKIP_PUBLIC_HEALTH=1)"
    return 0
  fi
  local api_body web_code
  api_body="$(curl_body "$HEALTH_PUBLIC_API/health")"
  [[ "$api_body" == *'"ok":true'* ]] || die "public API health failed: $HEALTH_PUBLIC_API/health"
  web_code="$("$CURL_BIN" -sS -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_PUBLIC_WEB" || true)"
  [[ "$web_code" == 200 ]] || die "public website HTTP $web_code from $HEALTH_PUBLIC_WEB"
  log "public checks ok ($HEALTH_PUBLIC_WEB $web_code, $HEALTH_PUBLIC_API/health)"
}

verify_website_files() {
  local sha="$1" dist
  dist="$(release_path "$sha")/website/dist/index.html"
  [[ -f $dist ]] || die "website index missing for $sha"
}

record_previous() {
  local prev="$1"
  if is_full_sha "$prev"; then
    printf '%s\n' "$prev" >"$PREV_FILE"
  fi
}

switch_release() {
  local sha="$1"
  local dest prev
  dest="$(release_path "$sha")"
  prev="$(current_sha)"
  ensure_restart_possible
  if [[ "$prev" == "$sha" ]]; then
    log "current already $sha"
  else
    if is_full_sha "$prev"; then
      record_previous "$prev"
      log "previous release recorded: $prev"
    fi
    log "switching current -> $dest"
    atomic_current "$dest"
  fi
  verify_website_files "$sha"
  restart_api
  if ! wait_health; then
    printf 'ERROR: health/ready failed after switch to %s\n' "$sha" >&2
    local restore=""
    if [[ "$prev" != "$sha" ]]; then
      restore="$prev"
    else
      restore="$(previous_sha)"
    fi
    if is_full_sha "$restore" && [[ "$restore" != "$sha" && -d $(release_path "$restore") ]]; then
      log "auto-rollback to $restore"
      atomic_current "$(release_path "$restore")"
      record_previous "$sha"
      restart_api || true
      wait_health || die "rollback health also failed; inspect $SHARED/logs"
      die "deploy of $sha failed health checks; rolled back to $restore"
    fi
    die "deploy of $sha failed health checks and no previous release to restore"
  fi
  verify_public
  log "deployed $sha"
}

prune_releases() {
  local keep="$KEEP" current previous
  current="$(current_sha)"
  previous="$(previous_sha)"
  [[ "$keep" =~ ^[0-9]+$ ]] || keep=5
  local -a dirs=()
  local d sha
  shopt -s nullglob
  for d in "$RELEASES"/*; do
    [[ -d $d ]] || continue
    sha="$(basename "$d")"
    is_full_sha "$sha" || continue
    dirs+=("$d")
  done
  shopt -u nullglob
  ((${#dirs[@]} == 0)) && return 0
  local -a sorted=()
  local line
  while IFS= read -r line; do
    [[ -n $line ]] && sorted+=("$line")
  done < <(ls -1dt "${dirs[@]}" 2>/dev/null || true)
  local kept=0
  for d in "${sorted[@]}"; do
    sha="$(basename "$d")"
    if [[ "$sha" == "$current" || "$sha" == "$previous" ]]; then
      continue
    fi
    kept=$((kept + 1))
    if (( kept > keep )); then
      log "pruning old release $sha"
      rm -rf "$d"
    fi
  done
}

cmd_status() {
  assert_isolation
  assert_preflight
  local cur prev
  cur="$(current_sha)"
  prev="$(previous_sha)"
  printf 'root:            %s\n' "$ROOT"
  printf 'current:         %s\n' "${cur:-none}"
  printf 'previous:        %s\n' "${prev:-none}"
  printf 'env:             %s (%s)\n' "$ENV_FILE" "$(test -r "$ENV_FILE" && echo present || echo missing)"
  printf 'releases:\n'
  shopt -s nullglob
  local d
  for d in "$RELEASES"/*; do
    [[ -d $d ]] || continue
    printf '  %s\n' "$(basename "$d")"
  done
  shopt -u nullglob
  if health_local_ok; then
    printf 'local health:    ok (%s)\n' "$HEALTH_LOCAL"
  else
    printf 'local health:    FAIL (%s)\n' "$HEALTH_LOCAL"
  fi
  if [[ "$SKIP_PUBLIC" != 1 ]]; then
    local api_body web_code
    api_body="$(curl_body "$HEALTH_PUBLIC_API/health")"
    web_code="$("$CURL_BIN" -sS -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_PUBLIC_WEB" || true)"
    if [[ "$api_body" == *'"ok":true'* ]]; then
      printf 'public API:      ok\n'
    else
      printf 'public API:      FAIL\n'
    fi
    printf 'public website:  HTTP %s\n' "${web_code:-none}"
  fi
}

cmd_rollback() {
  assert_isolation
  assert_preflight
  acquire_lock
  local prev cur
  prev="$(previous_sha)"
  cur="$(current_sha)"
  is_full_sha "$prev" || die "no previous release recorded at $PREV_FILE"
  [[ -d $(release_path "$prev") ]] || die "previous release directory missing: $(release_path "$prev")"
  ensure_restart_possible
  log "rolling back $cur -> $prev"
  atomic_current "$(release_path "$prev")"
  if is_full_sha "$cur"; then
    record_previous "$cur"
  fi
  restart_api
  if ! wait_health; then
    die "rollback health failed for $prev"
  fi
  verify_website_files "$prev"
  verify_public
  log "rollback complete: current=$prev"
  cleanup_tmp
}

cmd_deploy() {
  assert_isolation
  assert_preflight
  acquire_lock
  ensure_git
  local sha
  sha="$(resolve_sha "$REF")"
  is_full_sha "$sha" || die "resolved ref is not a full SHA: $sha"
  log "deploying $REF -> $sha"
  build_release "$sha"
  switch_release "$sha"
  prune_releases
  cleanup_tmp
}

trap on_exit EXIT

case "$CMD" in
  status) cmd_status ;;
  rollback) cmd_rollback ;;
  deploy) cmd_deploy ;;
  *) die "unknown command: $CMD" ;;
esac
