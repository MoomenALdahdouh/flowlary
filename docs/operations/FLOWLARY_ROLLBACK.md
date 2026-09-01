# Flowlary rollback

Keep this boring. No Kubernetes, no blue/green fleet.

---

## Mechanism

```
/var/www/flowlary/current  →  releases/<sha-N>
                              releases/<sha-N-1>   # kept on disk
```

JSON data lives in `shared/data/` and is **not** rolled back unless a release corrupted the file (restore from backup instead — `FLOWLARY_BACKUP_AND_RECOVERY.md`).

---

## When to roll back

- `GET http://127.0.0.1:9087/health` not 200 after restart
- `GET /ready` 503 (missing secrets or store)
- `https://api.flowlary.com/health` failing while localhost works (nginx/TLS — fix vhost, do not blindly rollback code)
- Website 500/empty after a bad `website/dist` (symlink back)

---

## Procedure (Flowlary only)

```bash
# Identify previous release
ls -lt /var/www/flowlary/releases

PREV=<previous-sha>
ln -sfn /var/www/flowlary/releases/$PREV /var/www/flowlary/current

# Restart ONLY Flowlary
sudo supervisorctl restart flowlary-api

curl -fsS http://127.0.0.1:9087/health
curl -fsS http://127.0.0.1:9087/ready
```

If nginx files were changed in the failed release, restore **only** `/etc/nginx/sites-available/flowlary` and `flowlary-api` from git/history, then `sudo nginx -t && sudo systemctl reload nginx`. Do not restore ZAIXOS files.

---

## What rollback must never do

- `supervisorctl restart laravel-worker` / `zaixos-voice-*`
- `systemctl restart php8.4-fpm` / `postgresql` / `redis` / `nginx` (restart vs reload)
- Delete `shared/data/flowlary-store.json`
- `rm -rf /var/www/zaixos` or other projects
- Switch a “global” default nginx site

---

## Failed first deploy (no previous release)

Stop the Flowlary program only:

```bash
sudo supervisorctl stop flowlary-api
```

Leave nginx Flowlary vhosts in place or disable **only** the Flowlary symlinks in `sites-enabled` (`10-flowlary`, `10-flowlary-api`), then `nginx -t` && reload. ZAIXOS `00-zaixos-*` stay enabled.
