# Flowlary Phase 5 — Supervisor (`flowlary-api`)

**Date:** 2026-09-01  
**Status:** **ENABLED** (installer ran by operator). Verification: **PARTIAL** — live process/health/bind passed; `sudo supervisorctl status` not readable without a password.

ZAIXOS Supervisor programs were **not** modified. nginx was **not** modified. No `supervisorctl update`. No `systemctl restart supervisor`.

---

## Supervisor configuration path

Prepared (owned by `flowlary-deploy`):

`/var/www/flowlary/shared/supervisor/flowlary-api.conf`

Intended install location (not written yet):

`/etc/supervisor/conf.d/flowlary-api.conf`

Installer (root-only, not executed):

`/var/www/flowlary/shared/supervisor/install-flowlary-api.sh`

```bash
ssh -t zaixos-prod 'sudo bash /var/www/flowlary/shared/supervisor/install-flowlary-api.sh'
```

The installer: copies **only** this file, `chown root:root`, `chmod 644`, then `supervisorctl reread`, `add flowlary-api`, `start flowlary-api`. It does **not** `update` and does **not** restart systemd Supervisor.

---

## Exact program name

`flowlary-api`

(No existing `flowlary-api` in `/etc/supervisor/conf.d/` at inspection.)

## Process command

```
/bin/bash -c 'set -a; . /var/www/flowlary/shared/.env; set +a; export HOST=127.0.0.1 PORT=9087 FLOWLARY_ENV=production; exec /usr/bin/node --import tsx src/index.ts'
```

## User

`flowlary-deploy`

## Working directory

`/var/www/flowlary/releases/21cee1a5ddec9cf0eb8b3b15983933a383ff49f2/backend`

(`tsx` lives in the workspace `node_modules` at the release root; same pattern as the Phase 4 temp start.)

## Environment source

`/var/www/flowlary/shared/.env` (`600`, `flowlary-deploy`) plus forced `HOST=127.0.0.1`, `PORT=9087`, `FLOWLARY_ENV=production`.

## PID / port / health / readiness / logs

**Not applicable until the installer runs.** Port 9087 was **free** at pre-check. No Flowlary node process left running from Phase 4.

---

## Pre-enable inspection (before installer)

Existing Supervisor programs only:

- `laravel-worker` (user `deploy`, clinic queue)
- `zaixos-voice-tts` (user `deploy`, `127.0.0.1:8100`)
- `zaixos-voice-worker` (user `deploy`)

ZAIXOS directory: `deploy:www-data` `750`, inode `543992`.

ZAIXOS PIDs at pre-check:

- uvicorn `184711`
- clinic `queue:work` `1020241`, `1020267`
- voice `queue:work` `1020677`

nginx `sites-enabled` still only ZAIXOS symlinks (hashes recorded in the session log).

---

## Operator: after you run the installer

Verify:

```bash
sudo supervisorctl status flowlary-api
ss -tln | grep 9087          # expect 127.0.0.1:9087 only
curl -sS http://127.0.0.1:9087/health
curl -sS http://127.0.0.1:9087/ready
ps -o user,pid,cmd -C node | grep tsx
sudo supervisorctl status    # laravel-worker and zaixos-voice-* still RUNNING
```

Then reply so Phase 5 verification can be completed (still no nginx/DNS).
