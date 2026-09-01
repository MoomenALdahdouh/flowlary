# Flowlary server setup (discovered + proposed)

**Status:** Discovery complete. Dedicated `flowlary-deploy` user is **not** live until the operator runs `sudo bash /tmp/create-flowlary-deploy-user.sh` (passworded sudo). Local SSH config was not modified.  
**SSH used:** `ssh zaixos-prod` → `deploy@169.58.11.99` (existing alias; key `~/.ssh/id_ed25519`).

---

## Discovered host

| Item | Value |
|---|---|
| Provider | Contabo |
| Hostname | `vmi3438120` |
| Public IP | `169.58.11.99` |
| OS | Ubuntu 24.04.4 LTS (Noble) |
| Kernel | `6.8.0-136-generic` x86_64 |
| CPU | 4 × AMD EPYC (IBPB) |
| RAM | 7.8 GiB total, ~6.5 GiB available at discovery (used ~1.3 GiB) |
| Swap | none |
| Disk | `/dev/sda1` 72G, **20G used / 52G free (28%)** |
| Uptime at discovery | ~42 days |
| Login user | `deploy` (uid 1001), groups: `deploy`, `sudo`, `users` |
| Root | Contabo default user exists; `sshd` has `PermitRootLogin yes` |

Resources are sufficient for a single Node API plus static nginx. PHP-FPM already uses most of the active CPU. Flowlary must stay single-process and localhost-bound so it cannot starve ZAIXOS.

---

## Discovered software

| Software | Present | Version / notes |
|---|---|---|
| Node | Yes | **v22.23.1** (`/usr/bin/node`) — satisfies `engines.node >= 20` |
| npm | Yes | **10.9.8** |
| pnpm / yarn / nvm | No | Use npm + `package-lock.json` |
| Docker / Compose | **No** | Do not install for Flowlary |
| nginx | Yes | **1.24.0 (Ubuntu)**, systemd `nginx.service` |
| Apache | No | |
| PM2 | **No** | |
| Supervisor | Yes | `supervisor.service`; ZAIXOS programs only |
| Certbot | Yes | **2.9.0** |
| PHP | Yes | **8.4-FPM** (ZAIXOS). 8.3 logrotate remnant present |
| PostgreSQL | Yes | **16**, `127.0.0.1:5432` |
| Redis | Yes | `127.0.0.1:6379` |
| Python | Yes | 3.12.3 (Voice TTS venv) |
| Git | Yes | 2.43.0 |
| UFW | Binary present | Status **not readable** without sudo password |
| fail2ban / netdata / prometheus | Not found | |
| Monitoring | None dedicated | journald + nginx/php logs |

---

## Occupied ports (do not reuse)

| Port | Bind | Owner |
|---|---|---|
| 22 | `*:22` | sshd |
| 80 / 443 | `*:80`, `*:443` | nginx (public) |
| 53 | localhost stub | systemd-resolved |
| 5432 | `127.0.0.1` | PostgreSQL 16 |
| 6379 | `127.0.0.1` / `::1` | Redis |
| 8100 | `127.0.0.1` | ZAIXOS Voice TTS (`uvicorn`) |
| 5037 | `127.0.0.1` | `adb` (deploy) |

**Planned Flowlary API:** `127.0.0.1:9087` (free).

Public internet should only reach Flowlary via nginx `:443` / `:80`. Do not open a new firewall port.

---

## Existing application directories

| Path | Role |
|---|---|
| `/var/www/zaixos` | Entire ZAIXOS workspace (owner `deploy`) |
| `/var/www/html` | Default nginx placeholder |
| `/var/www/letsencrypt` | ACME-related (www-data) |
| `/opt`, `/srv` | Empty |
| `/home/deploy` | Deploy home, backups, Cursor server, `.secrets`, Android SDK |
| `/home/ubuntu` | Present; unused by this plan |

ZAIXOS subprojects under `/var/www/zaixos` include (among others): `dental-clinic-revenue-operating-system`, `zaixos-company-platform`, `zaixos-identity-platform`, `zaixos-voice-saas`, `adaptive-content-filter-website`, plus additional platforms not all fronted by nginx.

---

## Existing nginx domains (do not edit these files)

Enabled sites (all ZAIXOS):

| File | `server_name` (HTTPS unless noted) | Root / upstream |
|---|---|---|
| `00-zaixos-acf` | `acf.zaixos.com` | static `adaptive-content-filter-website/dist` |
| `00-zaixos-company` | `zaixos.com`, `www.zaixos.com`, `chat.zaixos.com`, `blog.zaixos.com`, `blog.clinic.zaixos.com` | PHP company platform |
| `00-zaixos-console` | `console.zaixos.com` | PHP company platform |
| `00-zaixos-icp` | `id.zaixos.com`, `account.zaixos.com` | PHP identity |
| `00-zaixos-voice` | `voice.zaixos.com` | PHP voice SaaS |
| `zaixos` | HTTP→HTTPS for many `*.zaixos.com` names | redirect only |
| `zaixos-clinic` | `clinic.zaixos.com`, `*.clinic.zaixos.com` | PHP clinic OS |

`conf.d/` is empty. Ubuntu `default` site is **not** enabled (good — no catch-all HTML site). There is **no `default_server`**. Unmatched `Host` headers fall through to the **first** loaded `listen 80/443` block (`00-zaixos-acf`). Therefore Flowlary vhosts **must** exist before DNS for `flowlary.com` points at this IP, or visitors can be redirected to `acf.zaixos.com`.

TLS: ZAIXOS uses `/etc/letsencrypt/live/zaixos.com/` (shared) and `/etc/letsencrypt/live/acf.zaixos.com/` (dedicated). Live cert directory was not listable without sudo. Flowlary must **not** expand the `zaixos.com` certificate.

---

## Existing process managers

Supervisor programs (do not modify):

| Program | Command | Port |
|---|---|---|
| `laravel-worker` ×2 | Clinic `artisan queue:work` | none (DB) |
| `zaixos-voice-tts` | uvicorn TTS | `127.0.0.1:8100` |
| `zaixos-voice-worker` | Voice `artisan queue:work` | none |

`supervisorctl` as `deploy` without sudo: permission denied. Restarts need `sudo` (password required for this user).

PHP-FPM `www` pool is shared by all ZAIXOS PHP apps. Flowlary must **not** use PHP-FPM.

Cron (do not modify):

- `deploy` crontab: clinic + company `artisan schedule:run` every minute
- `/etc/cron.d/zaixos-clinic-tenant-tls` every 5 minutes
- certbot package cron (systemd timer takes precedence)

---

## Proposed Flowlary setup (not executed)

### Directory

```bash
# AFTER APPROVAL ONLY — illustrative
sudo mkdir -p /var/www/flowlary/{releases,shared/data,shared/logs}
sudo chown -R deploy:deploy /var/www/flowlary
chmod 750 /var/www/flowlary
chmod 700 /var/www/flowlary/shared
chmod 600 /var/www/flowlary/shared/.env   # after creation
```

Do **not** create this until the plan is approved.

### Supervisor snippet (new file only)

File: `/etc/supervisor/conf.d/flowlary-api.conf`

```
[program:flowlary-api]
command=node --import tsx src/index.ts
directory=/var/www/flowlary/current/backend
user=deploy
numprocs=1
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stopwaitsecs=20
stdout_logfile=/var/www/flowlary/shared/logs/api.stdout.log
stderr_logfile=/var/www/flowlary/shared/logs/api.stderr.log
environment=NODE_ENV=production
```

Secrets stay in `/var/www/flowlary/shared/.env` (loaded by the backend from cwd / `backend/.env` — see `FLOWLARY_ENVIRONMENT.md`). Prefer a symlink:

`/var/www/flowlary/current/backend/.env` → `/var/www/flowlary/shared/.env`

Reload Supervisor **config only for the new program** after approval (`supervisorctl reread` + `add flowlary-api`), never `restart all`.

### nginx

New files only:

- `/etc/nginx/sites-available/flowlary`
- `/etc/nginx/sites-available/flowlary-api`

Enable as `sites-enabled/10-flowlary` and `10-flowlary-api` (prefix `10-` so they do not replace `00-zaixos-*`). See `FLOWLARY_SSL.md`.

`nginx -t` then `systemctl reload nginx` (reload, not restart) after approval. Reload is the least disruptive way to add a vhost; it still affects the master process globally, so it must be done only with a proven-good `nginx -t` and new files that cannot match ZAIXOS `server_name`s.

### Node modules

`npm ci` from the release root with workspaces. Production API needs `@flowlary/backend`, `@flowlary/shared`, and `tsx` (devDependency of backend — required at runtime). Do not use `--omit=dev` until a compile-to-dist path exists.

Website build can be performed on the VPS (Node 22 is already there) or built CI-side and rsynced. First launch: **build on VPS** to keep one toolchain.

---

## SSH / Cursor (proposed, not applied)

Preferred local alias (add only after approval):

```
Host flowlary-production
    HostName 169.58.11.99
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    AddKeysToAgent yes
    UseKeychain yes
```

This is the **same** user and key as `zaixos-prod`. Isolation is by **directory and commands**, not by OS user.

### Dedicated user `flowlary-deploy`

Safer long-term (cannot write `/var/www/zaixos`). **Not created.** Requires approval: new user, sudoers limited to nginx reload + supervisorctl for `flowlary-api`, plus a dedicated SSH key.

Until then, Cursor must treat `/var/www/zaixos` as out of bounds.

### Root

Do not use `root` for routine deploys. Implications of the current host: root SSH is allowed; `deploy` has full sudo (password). Routine Flowlary work should stay as `deploy` with explicit sudo only for nginx/supervisor/certbot.

---

## GitHub access on the server

Repo: `https://github.com/MoomenALdahdouh/flowlary.git`

If the repository is private, add a **read-only deploy key** on the server (`/home/deploy/.ssh/flowlary_deploy_ed25519`) used only for this repo. Do not reuse ZAIXOS deploy keys in documentation or scripts by name. Do not commit keys.
