# Flowlary backup and recovery

**Do not alter ZAIXOS backup files** under `/home/deploy/backups` (existing `zaixos-*-2026-07-21*` archives).

---

## What Flowlary actually persists

| Data | Path | Backup? |
|---|---|---|
| Accounts, sessions, usage, billing mapping, learning slices, feedback, testimonials | `shared/data/flowlary-store.json` | **Yes — primary** |
| Secrets | `shared/.env` | **Yes** (restricted copies) |
| Google ADC JSON | `shared/google-adc.json` (if used) | **Yes** |
| TLS material | Let's Encrypt live dirs | Covered by host Certbot; optional copy |
| Website/API code | git | GitHub is source of truth; keep last 3 release dirs |
| Uploaded user files | None in current architecture | N/A |
| PostgreSQL / Redis | Unused by Flowlary | **Do not dump ZAIXOS DBs as a Flowlary backup** |
| Extension | Not on VPS | N/A |

The JSON store is the product database. Treat it like a SQLite file: copy consistently, restore as a whole file.

---

## Concurrency / copy method

Single Node process, atomic rename in the store implementation. For backups:

```bash
# conceptual
cp -a /var/www/flowlary/shared/data/flowlary-store.json \
  /var/www/flowlary/shared/data/backups/flowlary-store-$(date -u +%Y%m%dT%H%M%SZ).json
```

Optional: `flock` around copy if a backup cron is added later. Do not snapshot while two API processes exist (they must not).

---

## Proposed backup location and cadence

| Item | Where | Frequency | Retention |
|---|---|---|---|
| JSON store | `/var/www/flowlary/shared/data/backups/` on-box | hourly in cron **owned by Flowlary** (new crontab lines only) | 7 days hourly + 30 days daily |
| `.env` | `/home/deploy/backups/flowlary/` mode 700 | after each secret change + weekly | 30 days |
| Off-box | Operator download or object storage **separate from ZAIXOS tarballs** | daily | 30 days |

Do not write Flowlary dumps into `/home/deploy/backups/zaixos-*` names.

A Flowlary cron, if approved, would be **additional lines** in `deploy`'s crontab or a new `/etc/cron.d/flowlary-backup` — never edit the clinic `schedule:run` lines.

---

## Restore (JSON)

1. `sudo supervisorctl stop flowlary-api`
2. Copy current file aside.
3. Restore `flowlary-store.json` to `FLOWLARY_DATA_PATH`.
4. `chown deploy:deploy` and mode `640`.
5. `sudo supervisorctl start flowlary-api`
6. `curl /ready`

Do not restore into `/var/www/zaixos`.

---

## Disaster recovery

| Scenario | Action |
|---|---|
| VPS lost | New host + DNS A records + new LE certs + restore JSON + `.env` from off-box. ZAIXOS rebuild is a separate company procedure. |
| Flowlary directory deleted | Reclone git, restore `shared/` from backup |
| Bad release | `FLOWLARY_ROLLBACK.md` |
| Corrupt JSON | Restore last good backup; accept possible loss of sessions (users sign in again) |

---

## ZAIXOS backups (untouched)

Existing: `/home/deploy/backups/ZAIXOS-full-backup-2026-07-21.tar.gz` and related nginx/ssl/db tarballs; `/var/www/zaixos/zaixos-final-before-cutover.dump`. Flowlary ops must not rotate, prune, or “include in” those files.
