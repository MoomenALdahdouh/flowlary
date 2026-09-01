# Flowlary deployment procedure

**Status:** Plan only. Do not run these commands until approved step by step.

This is independent of ZAIXOS deploy scripts under `/var/www/zaixos/*/deploy`.

---

## Strategy

| Choice | Decision |
|---|---|
| Source | `git fetch` + checkout of a **tag or SHA** from `https://github.com/MoomenALdahdouh/flowlary.git` |
| Layout | Release directories + `current` symlink |
| Build | On the VPS (Node 22 already installed) |
| Process | Supervisor program `flowlary-api` only |
| Website | Static files from `current/website/dist` |
| CI | Not required for first production; optional later |

Do not `git pull` into a hot directory. Always build a new `releases/<sha>` then switch the symlink.

---

## Preconditions (every deploy)

- Working tree on the operator machine is the intended commit.
- `/var/www/flowlary/shared/.env` exists and is not a ZAIXOS file.
- `flowlary-api` is the only process that will be restarted.
- `nginx -t` if nginx files changed; only Flowlary `sites-available` files may change.
- Disk has headroom (`df -h` — host had ~52G free at discovery).

---

## Proposed script: `deploy/production/deploy.sh`

Not added to the repo in this pass (avoid an executable that someone might run against the VPS accidentally). When implemented, it must:

1. Refuse to run unless `FLOWLARY_ROOT=/var/www/flowlary`.
2. Refuse if cwd is under `/var/www/zaixos`.
3. Never call `pm2`, `docker`, `supervisorctl restart all`, or `systemctl restart nginx` (reload only).
4. Never `rm -rf` anything outside `releases/`.
5. Keep at least the previous release directory.

Conceptual steps:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT=/var/www/flowlary
SHA="${1:?git sha or tag}"
# 1. verify env file exists
# 2. git fetch in $ROOT/repo
# 3. git archive or checkout-index into $ROOT/releases/$SHA
# 4. ln -sfn $ROOT/shared/.env $ROOT/releases/$SHA/backend/.env
# 5. npm ci
# 6. npm run typecheck -w @flowlary/shared && npm run test -w @flowlary/backend (subset)
# 7. npm run build -w @flowlary/website
# 8. curl -fsS http://127.0.0.1:9087/health  (if already running, skip until switch)
# 9. ln -sfn $ROOT/releases/$SHA $ROOT/current
# 10. sudo supervisorctl restart flowlary-api
# 11. curl -fsS --max-time 10 http://127.0.0.1:9087/health
# 12. curl -fsS --max-time 10 http://127.0.0.1:9087/ready
# 13. curl -fsSI https://api.flowlary.com/health
# 14. curl -fsSI https://flowlary.com
# 15. on failure: relink previous SHA and restart flowlary-api
```

---

## First-time sequence (after approval, one step at a time)

1. Create `/var/www/flowlary` owned by `deploy` (not inside `zaixos/`).
2. Clone repo into `/var/www/flowlary/repo`.
3. Write `shared/.env` (see `FLOWLARY_ENVIRONMENT.md`).
4. Create first release, `npm ci`, website build.
5. Add Supervisor `flowlary-api` (listen 127.0.0.1:9087). Confirm with `ss -tlnp | grep 9087` and `curl 127.0.0.1:9087/health`.
6. Add **HTTP-only** nginx vhosts + ACME webroot.
7. Operator sets Namecheap A records (`FLOWLARY_DNS.md`).
8. `certbot certonly --webroot` for Flowlary names only.
9. Add HTTPS server blocks; `nginx -t`; `systemctl reload nginx`.
10. Verify domains. Paddle webhook URL last.

Never start at step 7 before step 6.

---

## Subsequent deploys

Only steps: fetch SHA → new release → tests → symlink → `supervisorctl restart flowlary-api` → health.

nginx reload **only** if Flowlary vhost files changed.

---

## Tests on the server

Minimum:

```bash
npm run test -w @flowlary/shared
npm run test -w @flowlary/backend
```

Do **not** run Playwright E2E or live Groq probes on the production host as part of every deploy (keys, cost, load). Optional operator-side:

```bash
FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs
```

Sanitized health (no keys in output): `curl -sS https://api.flowlary.com/health` — expect `groqConfigured: true`, never the key.

---

## Cursor remote workflow (controlled)

```
Cursor  →  SSH flowlary-production (or zaixos-prod until alias exists)
        →  /var/www/flowlary
```

**Allowed without extra approval:** read logs under `shared/logs`, `curl` localhost health, `git log` in the Flowlary repo clone.

**Requires sudo (password):** `nginx -t`, `systemctl reload nginx`, `supervisorctl` for `flowlary-api`, certbot.

**Forbidden:** anything under `/var/www/zaixos`, `/etc/nginx/sites-available/zaixos*`, `/etc/supervisor/conf.d/zaixos*`, `laravel-worker.conf`, PostgreSQL/Redis CLI against ZAIXOS DBs, `ufw`, `iptables`, `reboot`, `docker`, `pm2`.
