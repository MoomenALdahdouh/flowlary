# Flowlary deployment security review

Recommendations only. **Firewall, sshd, and sudo were not changed.**

---

## Findings on the shared VPS (read-only)

| Topic | Observation | Flowlary implication |
|---|---|---|
| SSH | `PermitRootLogin yes`; `deploy` has sudo (password) | Do not use root for Flowlary deploys. Dedicated `flowlary-deploy` user is safer but not created. |
| SSH keys | Local `~/.ssh/id_ed25519` already used as `zaixos-prod` | Same principal can read `/var/www/zaixos`. Cursor must not open that tree for Flowlary work. |
| Public ports | `22`, `80`, `443` | Sufficient. Do not expose `9087`. |
| Postgres / Redis | Localhost only | Flowlary must not create users/DBs or use Redis. |
| UFW | Status unknown (sudo password) | 80/443 already serve ZAIXOS; no new port required. |
| PHP-FPM | Shared pool for all ZAIXOS sites | Flowlary stays Node+static. |
| Default nginx server | None; first vhost is ACF | Flowlary `server_name` must be exact. |
| Cursor server | `/home/deploy/.cursor-server` | Remote IDE as `deploy` has broad filesystem access. |
| `adb` on 5037 | Local | Unrelated; leave it. |

---

## Flowlary application controls

| Control | Requirement |
|---|---|
| Bind | `HOST=127.0.0.1` |
| HTTPS | Dedicated LE certs; HTTP redirect |
| CORS | Explicit origins only; no `*` |
| Auth | `FLOWLARY_ENV=production`; auth not disabled |
| Rate limits | Existing gateway middleware; do not disable |
| Body size | nginx `client_max_body_size 128k` aligned with `FLOWLARY_MAX_BODY_BYTES` |
| `.env` | mode 600, not in web root (`shared/` not under `website/dist`) |
| JSON store | not served by nginx; path outside `dist` |
| Test routes | `POST /__test/reset` only when `FLOWLARY_ENV=test` |
| Secrets in git | Forbidden |
| Website dist | no `.env`; production API URL is `api.flowlary.com` only |

---

## nginx

- New files only; no `server_name _` catch-all.
- Do not enable `sites-available/default`.
- ACME location limited to `.well-known/acme-challenge/`.
- Deny dotfiles except well-known (same as ZAIXOS PHP sites).

---

## Process user

Run `flowlary-api` as `deploy` (matches ZAIXOS workers). Do not run as `root` or `www-data` (www-data should not write the JSON store). nginx reads static files as `www-data`: `website/dist` must be world-readable or `o+rX`.

---

## SSH / Cursor rules of engagement

1. Authentication: existing key, not passwords in repo.
2. User: `deploy` until a dedicated user is approved.
3. Directory: `/var/www/flowlary` only.
4. Safe: read logs, health curls, git in Flowlary clone.
5. Sudo: nginx reload, supervisorctl `flowlary-api`, certbot for Flowlary cert-names.
6. Never: destructive `rm`, `chmod -R` on `/var/www`, firewall, ZAIXOS paths.

---

## Risks to accept or schedule

1. **Shared `deploy` user** — Flowlary operators can theoretically modify ZAIXOS. Mitigation: later `flowlary-deploy` + sudoers allowlist.
2. **`nginx reload` is global** — a bad Flowlary vhost that still `nginx -t`s can affect the master (e.g. duplicated `default_server`). Mitigation: unique `server_name`, no catch-all, always `nginx -t`.
3. **JSON store on disk** — theft of the file = accounts/password hashes/billing IDs. Backup copies need the same 600/640 perms.
4. **AI keys on the same disk as ZAIXOS** — compromise of `deploy` exposes both products' secrets. Isolation is operational, not cryptographic.
5. **Root SSH enabled** — host-level issue; out of scope to “fix” without approval.

---

## Firewall

No change recommended for launch: HTTP/HTTPS already public. Binding Node to localhost avoids a new listen on `0.0.0.0:9087` even if UFW is inactive.
