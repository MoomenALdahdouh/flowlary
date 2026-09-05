# Flowlary production deploy

**Canonical command:** `/var/www/flowlary/deploy.sh` (copy of [`deploy/production/deploy.sh`](../../deploy/production/deploy.sh)).

This is the VPS path: versioned releases, `current` symlink, Supervisor program `flowlary-api`, static website under `current/website/dist`. It is **not** Docker, PM2, or `deploy/docker-compose.yml`.

Do not run this against ZAIXOS. Do not start `npm run dev` / `dev:api` on the server.

---

## Layout

```text
/var/www/flowlary/
  deploy.sh                 # this script (copy from git)
  current -> releases/<sha> # nginx website root + Supervisor cwd …/backend
  releases/<40-char-sha>/   # immutable trees (never edit current in place)
  repo.git                  # bare GitHub clone (or existing repo/)
  shared/
    .env                    # secrets; mode 600; never copied into a release
    data/                   # JSON store (survives deploys)
    logs/
    previous                # last current SHA (rollback target)
    tmp/                    # deploy staging; deleted after success/failure
    deploy.lock             # exclusive deploy/rollback
```

Secrets stay in `shared/.env`. Each release gets `backend/.env` → that file (symlink only).

---

## Normal deploy

SSH as `flowlary-deploy`, then:

```bash
cd /var/www/flowlary
./deploy.sh
```

That deploys **`origin/main`** as an exact 40-character SHA.

```bash
./deploy.sh v1.4.0
./deploy.sh 5cf09e91f6fd0882a49c711c0386741ae516bf12
```

What it does:

1. Refuses ZAIXOS paths, root user, and missing `shared/.env`.
2. Takes `shared/deploy.lock` (one deploy at a time; stale PID locks are dropped).
3. Fetches GitHub into `repo.git` (or `repo/` if that clone already exists).
4. Resolves the ref to a full SHA.
5. Extracts **`git archive`** into staging (not `git pull` into `current`).
6. `npm ci --include=dev`, then `npm run test -w @flowlary/shared` and `@flowlary/backend`.
7. `npm run build -w @flowlary/website` (prerendered `website/dist`).
8. Symlinks `backend/.env` → `shared/.env`.
9. Moves staging to `releases/<sha>`.
10. Records the previous SHA, confirms API restart is possible, then points `current` at the new release.
11. Restarts **only** `flowlary-api`.
12. Waits for `http://127.0.0.1:9087/health` and `/ready`.
13. Checks `https://api.flowlary.com/health` and `https://flowlary.com` (HTTP 200).
14. If local health fails after the switch, **auto-rollback** to the previous release, restart, re-check, then exit non-zero.
15. Prunes old SHA directories (keeps current, previous, and `FLOWLARY_KEEP_RELEASES` extras; default 5). Never deletes `shared/`.

Playwright, live Groq probes, and the Chrome extension are **not** part of this deploy.

---

## Rollback

```bash
./deploy.sh rollback
```

Points `current` at the SHA in `shared/previous`, restarts `flowlary-api`, and repeats health/website checks. The SHA you left becomes the new `previous` (you can roll forward once). Release directories are not deleted.

---

## Status

```bash
./deploy.sh status
```

Prints `current`, `previous`, release names, local health, and public API/website codes. It does not change anything.

---

## Permissions

Run as **`flowlary-deploy`**, which owns `/var/www/flowlary`.

| Action | Who | Notes |
| --- | --- | --- |
| Fetch, extract, `npm ci`, website build, switch `current` | `flowlary-deploy` | No extra privileges |
| Read `shared/.env` | `flowlary-deploy` | Script never prints it |
| Restart API | root via **one** wrapper | See below |
| nginx / TLS / DNS / ZAIXOS | not this script | Never |

`flowlary-deploy` cannot restart Supervisor today unless you add a **narrow** sudo rule. Do **not** grant `(ALL) ALL` or `supervisorctl restart all`.

Install the wrapper as root (once):

```bash
sudo install -o root -g root -m 755 \
  /var/www/flowlary/current/deploy/production/flowlary-api-restart.example.sh \
  /usr/local/sbin/flowlary-api-restart
```

sudoers drop-in (operator-edited; this repo does not change sudoers):

```text
flowlary-deploy ALL=(root) NOPASSWD: /usr/local/sbin/flowlary-api-restart
```

The wrapper runs only `supervisorctl restart flowlary-api`.

Until that exists, `./deploy.sh` will **fail before relying on a silent API** if it cannot restart the process. You can temporarily set `FLOWLARY_API_RESTART_CMD` only in a break-glass shell; do not put secrets there.

Supervisor must keep:

```text
directory=/var/www/flowlary/current/backend
```

so a restart picks up the new release. Do not hard-code a SHA in `directory=`.

---

## First copy of the script onto the VPS

The app tree does not need a permanent Git working copy. You do need this script outside `current` so you can deploy even when `current` is old:

```bash
# from a machine that has the repo, or after cloning once:
git --git-dir=/var/www/flowlary/repo.git archive origin/main deploy/production/deploy.sh \
  | tar -x -O > /tmp/deploy.sh
# or: scp deploy/production/deploy.sh flowlary-deploy@host:/var/www/flowlary/deploy.sh
install -m 755 /tmp/deploy.sh /var/www/flowlary/deploy.sh
```

Create `shared/.env` yourself (`docs/operations/FLOWLARY_ENVIRONMENT.md`). This script will not write secrets.

Website nginx `root` must remain `/var/www/flowlary/current/website/dist` (already true in production). Parents need `www-data` traverse (`751` on `/var/www/flowlary` and `releases`); the script sets `a+rX` on `website/dist` after build.

---

## Failure and recovery

| Failure | Result |
| --- | --- |
| Lock held | Exit 1; live `current` unchanged |
| Fetch / archive / `npm ci` / tests / website build | Staging deleted; `current` unchanged |
| Cannot restart API | Exit 1 (after switch only if restart is attempted post-switch; then use `./deploy.sh rollback`) |
| `/health` or `/ready` fail after switch | Auto-rollback + restart + health; exit 1 |
| Public HTTPS check fails | Exit 1 (local already green). Re-run `status`. Rollback if the site is wrong: `./deploy.sh rollback` |
| Rollback health fails | Exit 1; inspect `shared/logs` |

Never `git pull` inside `current`. Never `rm -rf` anything except `shared/tmp/deploy-*` and pruned `releases/<sha>` directories whose names are 40 hex characters.

---

## Environment overrides (operators / tests)

| Variable | Default | Purpose |
| --- | --- | --- |
| `FLOWLARY_ROOT` | `/var/www/flowlary` | App root |
| `FLOWLARY_GIT_REMOTE` | GitHub `MoomenALdahdouh/flowlary.git` | Clone URL |
| `FLOWLARY_GIT_REF` | `origin/main` | Default ref for `./deploy.sh` |
| `FLOWLARY_KEEP_RELEASES` | `5` | Extra SHA dirs to keep |
| `FLOWLARY_HEALTH_LOCAL` | `http://127.0.0.1:9087` | Liveness/readiness |
| `FLOWLARY_HEALTH_PUBLIC_API` | `https://api.flowlary.com` | Public API |
| `FLOWLARY_HEALTH_PUBLIC_WEB` | `https://flowlary.com` | Public website |
| `FLOWLARY_SKIP_TESTS` | `0` | Emergency only |
| `FLOWLARY_SKIP_PUBLIC_HEALTH` | `0` | Tests / offline |
| `FLOWLARY_API_RESTART_CMD` | (wrapper / supervisorctl) | Test stub |
| `FLOWLARY_ALLOW_NONPROD_ROOT` | `0` | Local tests only |

---

## Local check (not a production deploy)

```bash
bash -n deploy/production/deploy.sh
bash tests/unit/deploy/deploy.test.sh
```

Those tests use a temporary directory and stub `npm`/`curl`. They do **not** deploy to the VPS.
