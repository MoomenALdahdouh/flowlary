# Flowlary deployment architecture

**Status:** Discovery and plan only. Nothing has been deployed.  
**Date:** 2026-09-01  
**VPS:** Contabo Cloud VPS 10 NVMe — `169.58.11.99` (`vmi3438120`)  
**Canonical product domain:** `flowlary.com`  
**Canonical API domain:** `api.flowlary.com`

This document describes what must run in production and how it must sit beside ZAIXOS without sharing configuration, processes, data, or nginx server blocks.

Related product-domain notes (not VPS-specific): `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md`, `docs/production/PRODUCTION_DEPLOYMENT.md`.

---

## Isolation principle

Flowlary and ZAIXOS share a physical machine. They must not share:

- directory tree
- environment files
- nginx `server` blocks
- TLS certificates
- process names
- ports
- JSON/database files
- log files
- Supervisor programs
- cron jobs
- Redis keys or PostgreSQL databases

If a change cannot be proven isolated from `/var/www/zaixos`, `/etc/nginx/sites-available/zaixos*`, and `/etc/supervisor/conf.d/zaixos*` / `laravel-worker.conf`, it must not be executed.

---

## Local product: what actually needs to run

Flowlary is an npm workspaces monorepo (`package-lock.json`, Node `>=20`). Production on this VPS needs **two public surfaces** and **one Node process**.

| Surface | Runs on VPS? | Runtime |
|---|---|---|
| Chrome / Edge extension | No | Built locally / CI; users install from stores. Talks to `https://api.flowlary.com`. |
| Marketing + account website | Yes | **Static prerendered files** (`website/dist`). nginx only. No Node website process. |
| AI gateway / API | Yes | **Single Node process** (`backend/src/index.ts` via `tsx`). HTTP only. |
| `packages/shared` | Build-time | TypeScript imported by backend and website. Not a separate service. |

### What does **not** run in production

- No WebSockets.
- No Redis, PostgreSQL, or MySQL for Flowlary.
- No background workers, queues, or cron (Laravel-style). Email, billing, and AI are request-driven.
- No Docker on this host (and Docker must not be introduced for convenience).
- No PM2 (not installed; Supervisor is the host convention).
- No local SLM / Ollama.

The repo `deploy/docker-compose.yml` and `deploy/ecosystem.config.cjs` are **not** the production path for this VPS. They bind `0.0.0.0:8787` and/or publish `8080`, which would conflict with isolation and with the existing host nginx.

### Backend runtime facts

- Process: Node HTTP server (`backend/src/index.ts`).
- Default listen: `HOST` defaults to `0.0.0.0`, `PORT` defaults to `8787`. Production **must** set `HOST=127.0.0.1` and an unused port (planned: **9087**).
- `npm run build` in `@flowlary/backend` is `tsc --noEmit` only. There is **no emit to `dist/`**. The `start` script (`node dist/index.js`) is not a viable production path unless a compile step is added later. Production must run:

  `node --import tsx src/index.ts` (cwd: backend), same as `deploy/Dockerfile` / `deploy/ecosystem.config.cjs`.

- Storage: **one JSON file**, single-writer. `instances` must remain **1**. Clustering or multiple API processes would race the store.
- Health: `GET /health` (liveness). `GET /ready` (secrets + store writable). `/ready` does not probe Groq/Gemini/OpenRouter.
- Auth: production **must** set `FLOWLARY_ENV=production` (development disables auth).
- Billing: Paddle webhooks at `POST /api/billing/webhook`.
- AI: Writing Review Groq → Gemini → OpenRouter (failure-only). Advisor ranking is a **separate** flag set. Do not merge them.

### Website runtime facts

- Build: `npm run build -w @flowlary/website` (client + SSR prerender).
- Production API URL is hardcoded to `https://api.flowlary.com` (`website/src/config.ts`). Do not point the marketing site at a ZAIXOS host or at a path on `zaixos.com`.
- SPA + prerendered routes under `website/dist`. nginx `try_files` + `/index.html` fallback.

### Extension (not deployed to VPS)

Release builds already require `https://api.flowlary.com/*` (`extension/manifest.prod.json`). The API hostname is not optional for shipped builds.

---

## Target layout on this VPS

Existing convention: applications live under `/var/www/<project>`, owned by `deploy`. ZAIXOS already occupies `/var/www/zaixos`. Flowlary must use a **sibling** directory:

```
/var/www/
├── html/                 # Ubuntu default — do not use
├── letsencrypt/          # ACME webroot used by ZAIXOS tooling — do not reuse
├── zaixos/               # DO NOT TOUCH
└── flowlary/             # NEW — isolated
    ├── current -> releases/<git-sha>
    ├── releases/
    ├── shared/
    │   ├── data/         # JSON store (persists across releases)
    │   ├── logs/         # API stdout/stderr
    │   └── .env          # secrets, mode 600, not in git
    └── deploy/           # optional copies of nginx/supervisor snippets
```

Proposed release tree (inside `current/`):

```
/var/www/flowlary/current/
├── backend/
├── website/dist/         # nginx document root for flowlary.com
├── packages/shared/
├── package.json
└── package-lock.json
```

Never place `FLOWLARY_DATA_PATH` inside `releases/` or `current/`.

---

## Traffic path

```
INTERNET
   │
   ├─ https://flowlary.com  (+ www)
   │         │
   │         ▼
   │   nginx server_name flowlary.com www.flowlary.com
   │   TLS: /etc/letsencrypt/live/flowlary.com/
   │   root: /var/www/flowlary/current/website/dist
   │
   └─ https://api.flowlary.com
             │
             ▼
       nginx server_name api.flowlary.com
       TLS: /etc/letsencrypt/live/api.flowlary.com/
             │
             ▼
       127.0.0.1:9087   # Flowlary API only
             │
             ▼
       JSON store  /var/www/flowlary/shared/data/flowlary-store.json
             │
             ▼
       Groq / Gemini / OpenRouter / Paddle / SMTP  (external)
```

ZAIXOS continues:

```
*.zaixos.com  → existing nginx sites-enabled/zaixos* → PHP-FPM / static / uvicorn:8100
```

---

## Process manager

| Option | On this VPS today | Decision |
|---|---|---|
| Docker / Compose | **Not installed** | Do not introduce. |
| PM2 | **Not installed** | Do not introduce. |
| Supervisor | **In use** for ZAIXOS workers | Use a **new** program file: `/etc/supervisor/conf.d/flowlary-api.conf` with program name `flowlary-api`. |
| systemd | nginx, php-fpm, postgres, redis | Acceptable alternative; Supervisor matches existing app convention. |

Restart command (Flowlary only): `sudo supervisorctl restart flowlary-api`  
Never run `supervisorctl restart all`.

---

## Port allocation (planned)

Occupied today (see `FLOWLARY_SERVER_SETUP.md`): `22`, `80`, `443`, `5432`, `6379`, `5037`, `8100`, plus local DNS stub.

| Service | Bind | Notes |
|---|---|---|
| `flowlary-api` | `127.0.0.1:9087` | Unused. Not 8787. Not published on the public interface. |

`8787` is free today but is the development default and appears in repo Docker/PM2 samples. Using **9087** avoids accidental collision with those configs and with anyone later binding 8787.

---

## Server map (discovered)

```
SERVER  vmi3438120  Ubuntu 24.04.4  Node 22.23.1  nginx 1.24  no Docker  no PM2
│
├── ZAIXOS   /var/www/zaixos
│   ├── nginx: zaixos.com, www, chat, console, blog, clinic, id, account, voice, acf, …
│   ├── PHP 8.4-FPM unix socket
│   ├── Supervisor: laravel-worker, zaixos-voice-tts (127.0.0.1:8100), zaixos-voice-worker
│   ├── PostgreSQL 16: at least databases `zaixos`, `zaixos_voice` (process list)
│   ├── Redis 127.0.0.1:6379
│   └── Let's Encrypt: zaixos.com (shared SAN) + dedicated acf.zaixos.com
│
├── Other host services
│   ├── sshd (PermitRootLogin yes)
│   ├── adb 127.0.0.1:5037 (deploy user)
│   └── certbot.timer / clinic tenant TLS cron
│
└── FLOWLARY  (proposed — not created)
    ├── /var/www/flowlary
    ├── Supervisor: flowlary-api
    ├── nginx: flowlary + flowlary-api (new files only)
    ├── TLS: dedicated certs, not zaixos.com
    └── JSON file store (no Postgres/Redis)
```

---

## Deployment workflow (conceptual)

```
Developer machine
    → GitHub  github.com/MoomenALdahdouh/flowlary
    → git fetch on VPS (deploy user, Flowlary directory only)
    → install + build in a new release directory
    → tests (backend + shared; website typecheck as needed)
    → health check 127.0.0.1:9087
    → atomically point `current` + reload nginx **only if Flowlary nginx files changed**
    → `supervisorctl restart flowlary-api`
    → verify https://api.flowlary.com/health and https://flowlary.com
    → rollback symlink if health fails
```

Simplest reliable approach: **git clone/fetch + release directories + Supervisor**. Not GitHub Actions on first launch (adds CI secrets and a second failure mode). Actions can be added later.

---

## Cursor ↔ server

The local machine already has:

```
Host zaixos-prod
    HostName 169.58.11.99
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

SSH as `deploy` succeeded in discovery (key auth, BatchMode). Cursor Remote / `cursor-server` is already present under `/home/deploy/.cursor-server` from ZAIXOS work.

**Do not** put private keys in the Flowlary repo. **Do not** change `~/.ssh/config` or create `flowlary-deploy` until approved (see `FLOWLARY_SERVER_SETUP.md` and `FLOWLARY_SECURITY.md`).

---

## Stop condition (still in force)

This discovery pass did **not**: deploy Flowlary, restart services, change nginx, change firewall, modify DNS, create databases/users, install packages, change SSH, or modify ZAIXOS.
