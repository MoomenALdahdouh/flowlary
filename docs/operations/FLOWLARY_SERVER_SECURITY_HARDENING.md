# Flowlary / ZAIXOS server security hardening

**Status:** AUDIT AND PLAN ONLY — **NOT YET IMPLEMENTED**  
**Date:** 2026-09-01  
**Host:** `vmi3438120` (`169.58.11.99`)  
**No changes were made** (no chmod, chown, Redis, nginx, Supervisor, SSH, or firewall).

Labels used below:

| Tag | Meaning |
|---|---|
| **CURRENT** | Observed now |
| **RECOMMENDED** | Desired end state |
| **NOT YET IMPLEMENTED** | Must not be executed until approved |

---

## 1. Current security state

Two principals already exist on one VPS:

| User | Role **CURRENT** |
|---|---|
| `deploy` | ZAIXOS owner; groups `deploy`, `sudo`, `users`; full sudo with password; writes `/var/www/zaixos` |
| `flowlary-deploy` | Isolated app user; groups `flowlary-deploy`, `users`; **no sudo**; owns `/var/www/flowlary` (`750`) |

ZAIXOS runtime **CURRENT**:

| Process | User | Needs |
|---|---|---|
| nginx | `www-data` | traverse to document roots; read static/`public` |
| php-fpm 8.4 `www` | `www-data` | traverse; read Laravel `.env` + `storage` / `bootstrap/cache` |
| Supervisor workers | `deploy` | read `.env`; `tts.env` (`600`); write logs |
| PostgreSQL | `postgres` | localhost `5432` |
| Redis 7.0.15 | `redis` | `127.0.0.1:6379`, **no password** |

`/var/www/zaixos` is **`755 deploy:deploy`**. Any local user (including `flowlary-deploy`) can traverse it. Many secrets are `664` (world-readable).

`/var/www/flowlary` is **`750 flowlary-deploy:flowlary-deploy`**. ZAIXOS users cannot write it. nginx/`www-data` also cannot read it yet (acceptable until a website `dist` is deployed; that will need a **narrow** later grant, not `755` on the whole tree).

---

## 2. Existing vulnerabilities / weaknesses

| ID | Weakness | Impact |
|---|---|---|
| W1 | `/var/www/zaixos` mode `755` | Any local account can enter the ZAIXOS tree |
| W2 | Laravel `.env` files `664` | `flowlary-deploy` can read APP_KEY, DB passwords, Paddle/Stripe/Google/Groq, mail, AWS |
| W3 | Clinic SQL dumps `664` in `storage/app/backups/` (~41 files, ~116 MB each) | Full database copies world-readable |
| W4 | `zaixos-final-before-cutover.dump` `664` at workspace root | Extra DB snapshot world-readable |
| W5 | `.env` backups under `/var/www/zaixos/.env-backups` `664` | Historical secrets |
| W6 | Redis no `requirepass` / no ACL file | Any local process can `PING`, read/write ~11k keys |
| W7 | Shared SSH key `id_ed25519` (`zaixos-production`) on both `deploy` and `flowlary-deploy` | Key theft = both identities |
| W8 | `flowlary-deploy` in group `users` | Extra group; umask often `002` → new files `664` |
| W9 | `PermitRootLogin yes` | Host-level; out of Flowlary scope |
| W10 | `deploy` `(ALL) ALL` sudo | Expected for ZAIXOS; not for Flowlary |

**CURRENT isolation that already works:** `flowlary-deploy` cannot write ZAIXOS, cannot write nginx/Supervisor configs, cannot use Supervisor socket, cannot read `/home/deploy` or `tts.env` (`600`), cannot list `storage/app/private/backups` (`700`), cannot administer Postgres/Docker, cannot `systemctl` nginx/Postgres.

---

## 3. ZAIXOS permission risks (file inventory)

**Who can read “others” (`o+r`):** `flowlary-deploy`, `ubuntu` (if they get a shell), and any future local user. Owner `deploy` and group `deploy` can also read. PHP is `www-data` (not group `deploy`) so it relies on **other-read** for `664` files unless config is cached.

Do **not** apply `chmod 600 deploy:deploy` on Laravel `.env` without also giving `www-data` read — that would **break ZAIXOS** HTTP.

Vendor / `node_modules` / `.venv` matches on names like `Dump.php` are **PUBLIC** library code — omitted.

### CRITICAL SECRET

| Path | Owner:group | Mode | Why | Who can read **CURRENT** |
|---|---|---|---|---|
| `…/zaixos-company-platform/.env` | `deploy:deploy` | `664` | APP_KEY, `DB_PASSWORD`, `REDIS_PASSWORD` key, mail, AWS, Groq | owner, group `deploy`, **world** (incl. `flowlary-deploy`); `www-data` via other-read |
| `…/dental-clinic-revenue-operating-system/.env` | `deploy:deploy` | `664` | APP_KEY, DB, Stripe, Paddle IDs/tokens, AWS | same |
| `…/zaixos-identity-platform/.env` | `deploy:deploy` | `664` | APP_KEY, DB, Paddle API/webhook, Google OAuth client secret | same |
| `…/zaixos-voice-saas/.env` | `deploy:deploy` | `664` | APP_KEY, DB, Stripe, Paddle, Google client id | same |
| `…/zaixos-voice-saas/mobile/.env` | `deploy:deploy` | `664` | Mobile client secrets | same |
| `…/zaixos-company-platform/.env.backup-*` (2 files) | `deploy:deploy` | `664` | Old production env | world |
| `…/.env-backups/zaixos-voice-saas/.env.backup.*` (5 files) | `deploy:deploy` | `664` | Historical env | world |
| `…/storage/app/backups/backup_*.sql` (**41 files**) | `deploy:deploy` | `664` | Live clinic DB dumps (PII/PHI likely) | world; Filament backup UI / `www-data` may need read |
| `…/zaixos-final-before-cutover.dump` | `deploy:deploy` | `664` | Postgres dump (~1.5 MB listed historically; file still present) | world |

**Depends on live `.env`:** php-fpm (`www-data`) for web; `deploy` for `artisan`, queue workers, cron `schedule:run`, clinic TLS cron. TTS does **not** use Laravel `.env`; it sources `tts.env`.

### SENSITIVE (protected or mixed)

| Path | Owner:group | Mode | Why | `flowlary-deploy` |
|---|---|---|---|---|
| `…/zaixos-voice-saas/storage/frames/tts.env` | `deploy:deploy` | `600` | TTS service credentials | **cannot read** (good) |
| `…/storage/app/private/backups/` | `deploy:deploy` | `700` dir | Private backup tree | **cannot list** (good) |
| `…/docs/polish/DEMO_SAUDI_ENTERPRISE_CREDENTIALS.md` | `deploy:deploy` | `664` | Demo/enterprise credential documentation | world-readable |
| `/home/deploy/.secrets` | `deploy` home `750` | n/a | Operator secrets | **cannot read** |
| `/home/deploy/.ssh/id_ed25519` | deploy home `750` | n/a | Deploy private key | **cannot read** |
| `/etc/letsencrypt/live` + `archive` + `accounts` | `root` | `700` | TLS private keys | **cannot read** |
| `/etc/redis/redis.conf` | (not readable by unprivileged) | | Redis config | `flowlary-deploy` **cannot** read the file; Redis **protocol** is still open |

### NORMAL CONFIG / PUBLIC / UNKNOWN

| Path | Class | Notes |
|---|---|---|
| `*.env.example` | NORMAL / PUBLIC | Templates; still tighten if they ever copy real values |
| Laravel `config/*.php` | NORMAL CONFIG | No secrets if env() is used; world-readable source is typical |
| `public/`, `dist/` | PUBLIC | nginx must read |
| `/var/www/html/index.nginx-debian.html` | PUBLIC | Default page |
| `/etc/nginx/sites-available/zaixos*` | NORMAL CONFIG | `644` root — **read** by anyone, **write** only root. Reading vhosts is not a secret leak comparable to `.env`. |
| `/etc/letsencrypt/ssl-dhparams.pem` | PUBLIC | Standard DH params |
| `/etc/letsencrypt/cli.ini` | UNKNOWN / low | May contain ACME email; not private keys |
| Vendor JWT/OAuth PHP | PUBLIC | Libraries |

**RECOMMENDED** per live `.env` (not applied):

- **Do not** `chmod 600` while group stays `deploy` — php-fpm would lose read.
- Minimum: `chgrp www-data` **that file only**, then `chmod 640`.
- Readers after change: `deploy` (owner), `www-data` (group). Not `flowlary-deploy`.
- Workers as `deploy` still work. nginx does not need `.env`.

Same `640 deploy:www-data` for `.env.backup*` if they remain on disk; better: move to `/home/deploy/backups/` (`750`) because **no runtime depends on them**.

Clinic `backup_*.sql`: Filament backup pages may read `storage/app/backups` as `www-data`. **Do not move** without checking `BackupService` paths. **RECOMMENDED:** directory `750 deploy:www-data` and files `640 deploy:www-data` (not `chmod -R` on all of `storage`).

---

## 4. Directory traversal

| Path | **CURRENT** | Traversal today |
|---|---|---|
| `/var/www` | `755 root:root` | Everyone (needed for nginx to reach both trees) |
| `/var/www/zaixos` | `755 deploy:deploy` | Everyone |
| `/var/www/flowlary` | `750 flowlary-deploy:flowlary-deploy` | only owner (+ root) |

**Can `/var/www/zaixos` become `750`?** Yes, **if and only if** `www-data` still has execute on that directory.

**RECOMMENDED** (directory only, **not recursive**):

```text
chgrp www-data /var/www/zaixos
chmod 750 /var/www/zaixos
```

| Actor | After `750 deploy:www-data` |
|---|---|
| `deploy` | owner `rwx` — artisan, git, cron, Supervisor workers |
| `www-data` | group `r-x` — nginx + php-fpm enter tree |
| `flowlary-deploy` | other `---` — **cannot enter**; W1–W5 become unreachable even if files stay `664` |
| `ubuntu` without sudo | cannot enter |

**Do not** use `700` or `750 deploy:deploy` without an ACL for `www-data` — nginx/PHP would 403.

ACL alternative (if you refuse to change group): `chmod 750` + `setfacl -m u:www-data:rx /var/www/zaixos`. Prefer group `www-data` (already used on `storage/`).

**Do not** `chmod 750 -R`. Nested `public/` and `dist/` stay `755`/`644` so nginx can read **after** it has traversed the parent.

`/var/www` should stay `755`. `/var/www/flowlary` should stay `750` until website files need `www-data` read on `current/website/dist` only (later deploy step).

---

## 5. Database dumps / backups

| Location | Mode | `flowlary-deploy` | Runtime? | Recommendation |
|---|---|---|---|---|
| Clinic `storage/app/backups/*.sql` (41) | dir `755`, files `664` | **read** | Yes — scheduled backups + likely Filament | **Do not move.** Tighten dir/files as in §3. Confirm path in `BackupService` before any move. |
| `storage/app/private/backups/` | `700` | **no** | Private | Keep |
| `/var/www/zaixos/zaixos-final-before-cutover.dump` | `664` | **read** | **No** (cutover artifact) | Move (later) to `/home/deploy/backups/` mode `600`; does not affect running apps |
| `/home/deploy/backups/zaixos-*` | home `750` | **no** | No | Keep; already isolated |
| `.env-backups/` | `775` + files `664` | **read** | No | Move or `750` + `640`; not required at runtime |

World-readable clinic SQL is the highest data-leak risk on the host.

---

## 6. Redis

**CURRENT** (read-only `INFO` / `CONFIG GET`; no `FLUSH`, no `SET`):

| Item | Value |
|---|---|
| Version | 7.0.15 |
| Bind | `127.0.0.1` and `-::1` (not public Internet) |
| Port | 6379 |
| `protected-mode` | yes |
| `requirepass` | **empty** |
| `aclfile` | empty |
| Unix socket | unset |
| Keyspace | `db0` ~10800 keys (almost all with TTL); `db1` ~292 keys |
| Sample key prefix | `zaixos…` |
| Clients | 3 connected |

**ZAIXOS usage (env names + drivers only):**

| App | Session | Cache | Queue |
|---|---|---|---|
| Company platform | **redis** | **redis** | **redis** |
| Clinic OS | **redis** | **redis** | database (Supervisor `queue:work database`) |
| Identity | file | file | sync |
| Voice | database | database | database |

Flowlary **does not** use Redis (JSON file store).

**Isolation goal:** `flowlary-deploy` should not talk to ZAIXOS Redis.

**RECOMMENDED** (later, high caution — **NOT YET IMPLEMENTED**):

1. **Do not** bind Redis to a public interface.
2. Prefer **ACL** (Redis 7): user `zaixos` with a password; default user disabled. Laravel `REDIS_PASSWORD` / ACL username must be updated in **ZAIXOS `.env` only**, then php-fpm/queue must pick it up. That **is** a ZAIXOS config change and can drop sessions/cache if mistyped — treat as a dedicated ZAIXOS maintenance window, not a Flowlary deploy.
3. Unix socket + `unixsocketperm 770` + group `www-data` (and `deploy`) would block `flowlary-deploy` without a password, but requires Laravel `REDIS_SCHEME`/`path` changes — same risk class.
4. **Do not** enable a password by editing Redis only without updating Laravel — company+clinic would break.

Safest **first** step that does **not** touch Redis: **directory `750` on `/var/www/zaixos`**. Redis remains reachable (W6). Redis hardening is a **separate ZAIXOS change**.

---

## 7. Other projects

| Project | Path | Sensitivity | `flowlary-deploy` **CURRENT** | Isolation |
|---|---|---|---|---|
| ZAIXOS (all apps under tree) | `/var/www/zaixos` | CRITICAL | read many files | §4 `750` |
| Default nginx page | `/var/www/html` | PUBLIC | read | none needed |
| ACME webroot | `/var/www/letsencrypt` | low | list/read | leave; not ZAIXOS secrets |
| Ubuntu home | `/home/ubuntu` | UNKNOWN | **no** (`750`) | OK |
| Deploy home / backups | `/home/deploy` | CRITICAL | **no** | OK |
| `/opt`, `/srv` | empty | n/a | list empty dirs | OK |

No third product tree besides ZAIXOS + Flowlary + html.

---

## 8. SSH key

**CURRENT:** `flowlary-deploy` `authorized_keys` is the same ed25519 key comment `zaixos-production` used by `Host zaixos-prod` → `deploy`.

**RECOMMENDED (later):**

```text
local ~/.ssh/flowlary_ed25519     →  flowlary-deploy authorized_keys only
local ~/.ssh/id_ed25519           →  deploy / zaixos-prod only
```

`Host flowlary-production` would use `IdentityFile ~/.ssh/flowlary_ed25519`. Do not put the private key in git. Do not change `sshd_config` (PasswordAuthentication is already `no`).

Until then, filesystem isolation (W1) matters more than key split.

---

## 9. Sudo — **do not grant yet**

**RECOMMENDED** later: **root-owned wrapper scripts**, not raw `ALL` or open `supervisorctl`.

| Wrapper | Allowed action |
|---|---|
| `/usr/local/sbin/flowlary-nginx-test-reload` | `nginx -t` then `systemctl reload nginx` |
| `/usr/local/sbin/flowlary-api-restart` | `supervisorctl restart flowlary-api` (start/stop/status same program only) |
| `/usr/local/sbin/flowlary-certbot-web` | `certbot certonly` with **hardcoded** `--cert-name flowlary.com` and webroot |
| `/usr/local/sbin/flowlary-certbot-api` | `--cert-name api.flowlary.com` only |

sudoers:

```text
flowlary-deploy ALL=(root) NOPASSWD: /usr/local/sbin/flowlary-nginx-test-reload
flowlary-deploy ALL=(root) NOPASSWD: /usr/local/sbin/flowlary-api-restart
flowlary-deploy ALL=(root) NOPASSWD: /usr/local/sbin/flowlary-certbot-web
flowlary-deploy ALL=(root) NOPASSWD: /usr/local/sbin/flowlary-certbot-api
```

**Never:** `(ALL) ALL`, `supervisorctl restart all`, `supervisorctl update`, `systemctl restart nginx`, `psql`, `redis-cli`, `/bin/bash`, `chmod`, `visudo`, writing `/etc/nginx/sites-available/zaixos*`.

**CURRENT:** no sudoers file for `flowlary-deploy`. First nginx/Supervisor/Certbot install should be done by `deploy` with passworded sudo, not by Flowlary.

Note: `nginx reload` is process-global even in a wrapper; safety is `nginx -t` + Flowlary-only `server_name`s.

---

## 10. Desired final model

```text
root
├── deploy          ZAIXOS admin (unchanged)
├── www-data        nginx + php-fpm (ZAIXOS web)
├── postgres/redis  system daemons
└── flowlary-deploy  /var/www/flowlary only
```

`flowlary-deploy` **CAN** (end state): deploy/build Flowlary; manage `/var/www/flowlary`; read Flowlary logs; restart **flowlary-api** via wrapper.

`flowlary-deploy` **CANNOT:** read ZAIXOS secrets; write ZAIXOS; edit ZAIXOS nginx; control ZAIXOS Supervisor programs; admin Postgres/Redis; root shell.

---

## 11. What must NOT be changed (even when implementing)

- ZAIXOS nginx `server` files, Supervisor `laravel-worker` / `zaixos-voice-*`
- Recursive `chmod`/`chown` on `/var/www/zaixos`
- Redis restart/flush as part of Flowlary work
- PHP-FPM user, pool, or socket
- Moving clinic `storage/app/backups` until the backup module is confirmed
- Granting `flowlary-deploy` sudo `ALL`
- Docker (not installed)
- Flowlary application deploy (still out of scope)

---

## 12. Exact implementation plan (**NOT YET IMPLEMENTED**)

Execute **one step per approval**, verify ZAIXOS HTTP between steps.

1. **ZAIXOS directory only:** `chgrp www-data /var/www/zaixos` && `chmod 750 /var/www/zaixos`. Immediately curl ZAIXOS HTTPS hosts (company, clinic, voice, ACF). If 403, rollback this directory (`chgrp deploy`, `chmod 755`).
2. Re-SSH as `flowlary-deploy`: `ls /var/www/zaixos` must fail.
3. **Named secrets only** (no `-R`): each live `.env` + `mobile/.env` → `chgrp www-data` && `chmod 640`. Curl again.
4. Clinic backup **directory** `chgrp www-data` && `chmod 750`; each `backup_*.sql` `640` (loop, not `chmod -R storage`). Confirm Filament backup page still lists files.
5. Relocate **only** `zaixos-final-before-cutover.dump` and `.env-backups/` into `/home/deploy/backups/` (optional; no app path).
6. `gpasswd -d flowlary-deploy users` if still a member.
7. Dedicated Flowlary SSH key (local + `authorized_keys`); keep `zaixos-prod` key on `deploy` only.
8. Redis ACL/password: **ZAIXOS ticket**, not Flowlary.
9. Sudo wrappers: only when Flowlary nginx/process deploy is approved.

---

## 13. Verification plan (after a future change)

As `flowlary-deploy`:

- `ls /var/www/zaixos` → Permission denied  
- `test -r` on former `.env` paths → false  
- `touch /var/www/zaixos/x` → denied  
- `redis-cli PING` → still PONG until Redis is hardened (document residual W6)  
- `curl -sSI https://zaixos.com` and clinic/voice/acf → 200/301 as today  

As `www-data` (e.g. `sudo -u www-data test -x /var/www/zaixos`) → success.

---

## 14. Rollback plan

| Step | Rollback |
|---|---|
| `750` on `/var/www/zaixos` | `chgrp deploy /var/www/zaixos; chmod 755 /var/www/zaixos` |
| `.env` `640` | `chgrp deploy FILE; chmod 664 FILE` (restore **CURRENT** only if needed) |
| Moved dump | move file back to original path |
| Redis ACL | restore `requirepass` empty + Laravel env (ZAIXOS runbook) |

No service restart required for directory/mode rollback.

---

## Distinguishing states

| Topic | CURRENT | RECOMMENDED | NOT YET IMPLEMENTED |
|---|---|---|---|
| `flowlary-deploy` user | exists | keep | — |
| `/var/www/flowlary` `750` | yes | keep | — |
| `/var/www/zaixos` `755` | yes | `750 deploy:www-data` | yes |
| `.env` `664` | yes | `640 deploy:www-data` | yes |
| SQL dumps world-readable | yes | `640` + dir `750` | yes |
| Redis unauthenticated | yes | ACL/password (ZAIXOS window) | yes |
| Dedicated SSH key | shared | split | yes |
| flowlary sudo | none | wrappers only | yes |
| Flowlary app deploy | not done | later | yes |
