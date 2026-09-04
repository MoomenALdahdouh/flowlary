# Flowlary deployment procedure

**Status:** Operational. Use [`FLOWLARY_DEPLOY.md`](./FLOWLARY_DEPLOY.md) and `/var/www/flowlary/deploy.sh`.

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

## Script: `deploy/production/deploy.sh`

Implemented. Copy to `/var/www/flowlary/deploy.sh` on the VPS. It:

1. Refuses to run unless `FLOWLARY_ROOT=/var/www/flowlary` (tests may set `FLOWLARY_ALLOW_NONPROD_ROOT=1`).
2. Refuses if the root path is under `/var/www/zaixos`.
3. Never calls `pm2`, `docker`, `supervisorctl restart all`, or `systemctl restart nginx`.
4. Never `rm -rf` anything outside `shared/tmp/deploy-*` and pruned `releases/<sha>`.
5. Keeps the previous release directory for `./deploy.sh rollback`.

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

```bash
ssh flowlary-deploy@169.58.11.99
cd /var/www/flowlary
./deploy.sh
```

nginx reload **only** if Flowlary vhost files changed (this script does not reload nginx).

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
