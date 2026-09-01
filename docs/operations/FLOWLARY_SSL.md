# Flowlary TLS

**Status:** Design only. Certbot was not run. Existing ZAIXOS certificates were not modified.

---

## Policy

- Dedicated Let's Encrypt certificates for Flowlary hostnames.
- **Never** add `flowlary.com` to `/etc/letsencrypt/live/zaixos.com/`.
- **Never** point Flowlary `ssl_certificate` at ZAIXOS live paths.
- **Never** run `certbot --expand` on the ZAIXOS lineage.
- Prefer the same pattern already used for `acf.zaixos.com`: a **dedicated** cert directory.

---

## Certificates to issue (after DNS + HTTP vhosts)

| Lineage (live dir) | Names | Used by nginx file |
|---|---|---|
| `/etc/letsencrypt/live/flowlary.com/` | `flowlary.com`, `www.flowlary.com` | `sites-available/flowlary` |
| `/etc/letsencrypt/live/api.flowlary.com/` | `api.flowlary.com` | `sites-available/flowlary-api` |

Two lineages keep website and API independent (revocation, nginx `server` isolation, SANs).

HTTP-01 via nginx (host already has certbot 2.9.0). Do **not** use `--nginx` in a way that rewrites ZAIXOS files. Prefer:

```bash
# AFTER APPROVAL — conceptual
sudo certbot certonly --webroot \
  -w /var/www/flowlary/shared/acme \
  -d flowlary.com -d www.flowlary.com \
  --cert-name flowlary.com

sudo certbot certonly --webroot \
  -w /var/www/flowlary/shared/acme \
  -d api.flowlary.com \
  --cert-name api.flowlary.com
```

Each Flowlary HTTP `server` must include:

```
location ^~ /.well-known/acme-challenge/ {
    root /var/www/flowlary/shared/acme;
    default_type text/plain;
    allow all;
}
```

Do not reuse `/var/www/zaixos/...` or `/var/www/letsencrypt` as the Flowlary webroot.

---

## nginx HTTPS shape (conceptual)

Website (`flowlary.com` / `www`):

```
server {
    listen 80;
    listen [::]:80;
    server_name flowlary.com www.flowlary.com;
    location ^~ /.well-known/acme-challenge/ { root /var/www/flowlary/shared/acme; ... }
    location / { return 301 https://flowlary.com$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name flowlary.com www.flowlary.com;
    ssl_certificate     /etc/letsencrypt/live/flowlary.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowlary.com/privkey.pem;
    root /var/www/flowlary/current/website/dist;
    index index.html;
    access_log /var/log/nginx/flowlary_access.log;
    error_log  /var/log/nginx/flowlary_error.log;
    client_max_body_size 128k;
    location / { try_files $uri $uri/ $uri/index.html /index.html; }
}
```

Optional: `www` → apex 301. CORS already allows both origins.

API:

```
server {
    listen 80;
    listen [::]:80;
    server_name api.flowlary.com;
    location ^~ /.well-known/acme-challenge/ { ... }
    location / { return 301 https://api.flowlary.com$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.flowlary.com;
    ssl_certificate     /etc/letsencrypt/live/api.flowlary.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.flowlary.com/privkey.pem;
    access_log /var/log/nginx/flowlary_api_access.log;
    error_log  /var/log/nginx/flowlary_api_error.log;
    client_max_body_size 128k;

    location / {
        proxy_pass http://127.0.0.1:9087;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
```

**Do not** `proxy_pass` to PHP-FPM, `8100`, or any ZAIXOS root.

Repo file `deploy/nginx/flowlary-api.conf` is a **Docker** template (`upstream api:8787`, `server_name _`). It must **not** be copied onto this host as-is (catch-all `_` would steal traffic).

---

## Renewal

Existing host: `certbot.timer` (systemd) + `/etc/cron.d/certbot` (inactive when systemd is init).

New certs are renewed by the **same** Certbot timer. Renewal deploys into the same live directories. nginx already uses those paths, so **no ZAIXOS cert files are rewritten**.

After first certificates exist, verify:

```bash
sudo certbot certificates   # should list flowlary.com and api.flowlary.com as separate lineages
sudo certbot renew --dry-run
```

Deploy a **deploy hook only if needed** (nginx reload). If added, the hook must be a new file (e.g. `/etc/letsencrypt/renewal-hooks/deploy/flowlary-reload.sh`) that only runs `nginx -t && systemctl reload nginx`. Do not replace ZAIXOS clinic TLS cron.

---

## HTTP → HTTPS

Flowlary HTTP servers redirect to their own HTTPS names. They must not `return 301 https://zaixos.com`.

---

## Isolation check

| Action | Interferes with ZAIXOS? |
|---|---|
| New files under `sites-available/flowlary*` | No, if `server_name` is only Flowlary hosts |
| `nginx -t && reload` | Shared master process, but config files are additive |
| `certbot certonly --cert-name flowlary.com` | New lineage |
| `certbot --expand -d zaixos.com -d flowlary.com` | **FORBIDDEN** |
