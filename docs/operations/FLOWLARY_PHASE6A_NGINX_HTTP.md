# Phase 6A — nginx HTTP only (not enabled)

**Status:** Configs prepared under `/var/www/flowlary/shared/nginx/`. **Not installed** into `/etc/nginx`. `nginx -t` **not run**. nginx **not reloaded**.

## Blockers

1. **www-data cannot traverse** `/var/www/flowlary` or `/var/www/flowlary/releases` (`750` `flowlary-deploy:flowlary-deploy`). `dist` itself is readable (`775` / `664`) once parents allow execute.
2. **Installing** into `sites-available` / `sites-enabled` and **`nginx -t`** require root.

## Minimal permission change (not applied)

Do **not** recurse. Do **not** `chown`. Other-execute only on two directories (`751` = `rwxr-x--x`):

```bash
chmod 751 /var/www/flowlary
chmod 751 /var/www/flowlary/releases
```

`flowlary-deploy` owns both; no sudo. www-data can traverse to `dist` without listing `/var/www/flowlary`.

## Install + `nginx -t` (no reload)

```bash
ssh -t zaixos-prod 'sudo bash /var/www/flowlary/shared/nginx/install-flowlary-http.sh'
```

That script copies **only** `10-flowlary` and `10-flowlary-api`, enables those two names, runs `nginx -t`, and **does not** reload nginx.
