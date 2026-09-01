# Flowlary SSH identity

**Status:** `flowlary-deploy` is **not** created until the operator runs the create-user script with sudo (see below). Local `~/.ssh/config` was **not** modified.

---

## Recommended local SSH config (add yourself)

Do not replace `zaixos-prod`. Add a second host:

```
Host flowlary-production
    HostName 169.58.11.99
    User flowlary-deploy
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    AddKeysToAgent yes
    UseKeychain yes
```

This uses the same key already authorized for `deploy` / `zaixos-prod`. That is convenient and was requested; it is **not** cryptographic isolation (see security notes).

Test after the user exists:

```bash
ssh -o BatchMode=yes flowlary-production 'whoami; id; ls -ld /var/www/flowlary'
```

---

## Create-user script (server)

Copied to the VPS as `/tmp/create-flowlary-deploy-user.sh` (also in git as `deploy/production/create-flowlary-deploy-user.sh`).

On the VPS, as `deploy`, in an **interactive** session (sudo password required):

```bash
sudo bash /tmp/create-flowlary-deploy-user.sh
```

The script:

- creates `flowlary-deploy` with a locked password (`!`)
- does not add `sudo`, `docker`, `postgres`, `redis`, or `www-data`
- installs the existing ed25519 public key in `~/.ssh/authorized_keys`
- creates `/var/www/flowlary` owned `flowlary-deploy:flowlary-deploy` mode `750`
- does not install sudoers, nginx, certbot, or Supervisor access
- does not restart services

Host SSH already has `PasswordAuthentication no` (`/etc/ssh/sshd_config.d/60-cloudimg-settings.conf`). No sshd reload is required.

---

## Sudo to grant later (not granted)

| Action | Why later | Suggested later form |
|---|---|---|
| `nginx -t` + `systemctl reload nginx` | Add Flowlary vhosts | sudoers allowlist, those two commands only |
| `supervisorctl reread/add/restart flowlary-api` | Process control | allowlist `flowlary-api` only — never `restart all` |
| `certbot certonly` / `renew` for `flowlary.com` and `api.flowlary.com` | TLS | allowlist certbot with those `--cert-name`s |

Do **not** grant `(ALL) ALL`.
