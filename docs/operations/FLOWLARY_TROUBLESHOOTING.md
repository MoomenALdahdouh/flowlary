# Flowlary troubleshooting

Isolation first: if ZAIXOS is broken, **do not** restart Flowlary as a guess, and vice versa.

---

## Flowlary API down, ZAIXOS up

1. `curl -sS http://127.0.0.1:9087/health`  
   - Connection refused → Supervisor `flowlary-api` not running or wrong port.  
   - 200 → problem is nginx/DNS/TLS, not Node.
2. `curl -sS http://127.0.0.1:9087/ready` — 503 lists missing `secrets` / `store`.
3. `sudo supervisorctl status flowlary-api` and `shared/logs/api.stderr.log`.
4. Confirm `ss -tlnp | grep 9087` is `127.0.0.1`. If it is `0.0.0.0`, `HOST` is wrong — fix `.env`, restart **flowlary-api only**.

---

## Website wrong or shows ZAIXOS ACF

DNS pointed at `169.58.11.99` but Flowlary vhost missing → first HTTP server is `acf.zaixos.com`. Add/enable `10-flowlary` or revert DNS to parking until vhosts exist.

Certificate name mismatch: browser shows `acf.zaixos.com` or `zaixos.com` cert → FlowlARY HTTPS `server_name` not matching SNI. Do not “fix” by attaching the ZAIXOS cert.

---

## 502 / 504 on `api.flowlary.com`

- Upstream `127.0.0.1:9087` down.
- `proxy_read_timeout` too low for slow Groq (90s in plan).
- Accidentally proxied to `:8100` or PHP — check **only** `sites-available/flowlary-api`.

---

## `/ready` 503 `store`

- `FLOWLARY_DATA_PATH` directory not writable by `deploy`.
- Path still inside a deleted release directory (symlink `current` moved; data must stay in `shared/data`).

---

## `/ready` 503 `secrets`

- `FLOWLARY_ENV` not `production`, or missing Groq/JWT/auth/CORS/web origin.
- `.env` not loaded (cwd not `backend`, missing symlink).

---

## AI errors but `/health` ok

Expected: readiness does not probe providers. Check Groq/Gemini/OpenRouter dashboards and `groqConfigured` / advisor `state` on `/health`. Do not restart nginx or PHP.

---

## Deploy seems to restart ZAIXOS

Stop. Commands that affect ZAIXOS:

- `supervisorctl restart all`
- `systemctl restart php8.4-fpm` / `postgresql` / `redis-server` / `supervisor`
- Editing `sites-enabled/00-zaixos-*`
- `certbot --expand` on `zaixos.com`

Rollback Flowlary only (`FLOWLARY_ROLLBACK.md`).

---

## Disk full

JSON + logs. Truncate **Flowlary** logs first. ZAIXOS `storage/logs` and Postgres are not Flowlary's to vacuum without a ZAIXOS incident process.

---

## SSH from Cursor fails

- Use `Host zaixos-prod` or proposed `flowlary-production` (same IP/user/key).
- `BatchMode` requires the key loaded (`ssh-add`).
- Do not fall back to password in git or docs.
