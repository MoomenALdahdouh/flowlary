# Flowlary deployment state

**Phase:** 5 — Supervisor `flowlary-api`  
**Date:** 2026-09-01  
**Status:** Phase 4 complete. Phase 5 unit **prepared**, **not enabled** (root sudo required). See `FLOWLARY_PHASE5_SUPERVISOR.md`.

## Release

| Item | Value |
|---|---|
| Path | `/var/www/flowlary/releases/21cee1a5ddec9cf0eb8b3b15983933a383ff49f2` |
| Tag | `v1.1.0` |
| Commit | `21cee1a5ddec9cf0eb8b3b15983933a383ff49f2` |
| Tracked files | 1194 (matches local `git ls-tree -r v1.1.0`) |
| Tree | **complete** — reused existing rsync; not overwritten |
| `origin` on server | still points at a local path (not used this phase) |
| `current` symlink | **not created** |

## Server

Node **v22.23.1**, npm **10.9.8**. User `flowlary-deploy`.

## Environment

| Item | Value |
|---|---|
| Path | `/var/www/flowlary/shared/.env` |
| Owner/mode | `flowlary-deploy:flowlary-deploy` **600** |
| In git | no (outside release) |
| JWT/auth | newly generated (local placeholders not copied) |

**Missing (not invented):** `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN`, production `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

`/ready` does **not** require those; API started with `billingConfigured: false`. Checkout and transactional email will not work until they are set.

## Build / tests

| Step | Result |
|---|---|
| `npm ci --include=dev` | success |
| website `npm run build:web` | success — `website/dist` (27 files, `index.html`, prerendered routes) |
| `npm run test:web` | success (140 tests) |
| `npm run typecheck` | **fail** exit 2 (TS5097 and related — v1.1.0 tree; not patched) |
| `npm run test` | **fail** exit 1 — shared+backend ran then extension: **37 failed / 1586 passed** |

## Health (temporary process, then stopped)

Bind **127.0.0.1:9087** only. `/health` **200**. `/ready` **200**. Process SIGTERM’d. Port free afterward.

## Data / logs

`shared/data` and `shared/logs` `750`. `flowlary-store.json` created by readiness probe (empty store), mode **600**.

## ZAIXOS

Unchanged: `deploy:www-data` `750`, inode `543992`, ctime still `2026-09-01 03:20:46`. uvicorn `:8100` pid `184711`, redis pid `4163717`.

## Not changed

Supervisor, nginx, DNS, SSL, firewall, Redis, PostgreSQL, SSH, ZAIXOS application files.
