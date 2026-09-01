# Flowlary monitoring and logging

No dedicated monitoring stack was found on the VPS (no Netdata, Prometheus, or fail2ban). Use existing OS logs plus Flowlary-specific files.

---

## Log locations (proposed)

| Stream | Path | Owner |
|---|---|---|
| API stdout/stderr | `/var/www/flowlary/shared/logs/api.stdout.log` / `api.stderr.log` | Supervisor |
| nginx website | `/var/log/nginx/flowlary_access.log` / `flowlary_error.log` | www-data / nginx |
| nginx API | `/var/log/nginx/flowlary_api_access.log` / `flowlary_api_error.log` | nginx |
| JSON store | file mtime / size under `shared/data/` | deploy |

Do not write Flowlary logs into ZAIXOS clinic/voice `storage/logs`.

---

## What to watch

| Signal | How | Action |
|---|---|---|
| Process up | `supervisorctl status flowlary-api` (sudo) | restart that program only |
| Liveness | `curl -fsS http://127.0.0.1:9087/health` | 200 `ok: true` |
| Readiness | `curl -fsS http://127.0.0.1:9087/ready` | 503 ⇒ secrets or store |
| Public API | `curl -fsSI https://api.flowlary.com/health` | nginx/TLS |
| Disk | `df -h /` | JSON store + logs grow |
| Memory / CPU | `free -h`, `ps` for `tsx src/index.ts` | single process; if RSS climbs, inspect leak — do not kill PHP-FPM |
| Provider failures | `/health` advisor snapshots (`state`, `cooldownUntil`); application logs | keys/quota; no process restart required (`/ready` does not probe AI) |
| Disk inode | `df -i` | logrotate |

Host load at discovery was ~1.0 on 4 CPUs (PHP-FPM). Flowlary AI latency is dominated by Groq/Gemini/OpenRouter, not local CPU, but concurrent reviews can spike Node event-loop delay.

---

## Log hygiene (must not appear)

- API keys, SMTP passwords, JWT, Paddle secrets
- Authorization headers
- Full user field contents (writing text)
- Email verification / reset raw tokens

If a log line contains a secret, rotate the secret and truncate that log file (Flowlary files only).

---

## Logrotate

Host already has `/etc/logrotate.d/nginx`. Add a **new** file `/etc/logrotate.d/flowlary` (after approval) for `shared/logs/*.log`. Do not edit ZAIXOS app logrotate if any exists.

---

## Health payload (sanitized)

`GET /health` returns flags such as `groqConfigured` (boolean), advisor provider **state**, billing configured — not key material. Safe to scrape.

`GET /ready` lists check names (`secrets`, `store`, `advisor_providers`).

---

## Alerting (later)

Minimum viable: a cron that curls localhost `/health` and `/ready` and writes to `shared/logs/watchdog.log`. Not installed. Must not page ZAIXOS on Flowlary failure or vice versa.
