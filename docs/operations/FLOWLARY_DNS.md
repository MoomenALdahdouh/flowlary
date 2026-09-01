# Flowlary DNS (Namecheap)

**Registrar:** Namecheap (`dns1.registrar-servers.com` / `dns2.registrar-servers.com`)  
**Do not change DNS until nginx vhosts for Flowlary exist** (see architecture: unmatched hosts currently fall through to ZAIXOS `acf.zaixos.com`).

This document does **not** modify Namecheap. There is no authenticated Namecheap integration in this session.

---

## Discovered current records (2026-09-01)

Queried from the developer machine:

| Name | Type | Current value | Meaning |
|---|---|---|---|
| `flowlary.com` | A | `162.255.119.176` | **Namecheap parking / parking page**, not the Contabo VPS |
| `www.flowlary.com` | CNAME | `parkingpage.namecheap.com` | Parking |
| `api.flowlary.com` | A/AAAA | *(none)* | Does not resolve |
| NS | | Namecheap registrar servers | Domain is on BasicDNS |
| MX | | `eforward*.registrar-servers.com` | Namecheap email forwarding |
| TXT | SPF | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Forwards |

ZAIXOS DNS is independent (`zaixos.com` and subdomains). Flowlary records must never point at ZAIXOS hostnames.

---

## Required production records

Target IPv4: **`169.58.11.99`**

In Namecheap Advanced DNS for **flowlary.com**:

### 1. Apex website

| Type | Host | Value | TTL |
|---|---|---|---|
| **A Record** | `@` | `169.58.11.99` | Automatic or 5 min while launching, then 30 min |

**Remove or disable** the parking A record (`162.255.119.176`) and any URL redirect / parking page that Namecheap enabled for `@`.

### 2. www

Either:

| Type | Host | Value |
|---|---|---|
| **A Record** | `www` | `169.58.11.99` |

or:

| Type | Host | Value |
|---|---|---|
| **CNAME** | `www` | `flowlary.com.` |

nginx will serve both `flowlary.com` and `www.flowlary.com` (see SSL doc). Prefer two A records (simple, no extra lookup).

**Delete** the CNAME to `parkingpage.namecheap.com`.

### 3. API (required for the extension and website)

| Type | Host | Value | TTL |
|---|---|---|---|
| **A Record** | `api` | `169.58.11.99` | same as above |

Shipped extension host_permissions are `https://api.flowlary.com/*`. A path like `flowlary.com/api` **cannot** replace this without a new extension release.

### 4. Do not create

| Record | Why |
|---|---|
| CNAME `api` → `zaixos.com` or any ZAIXOS host | Would mix products |
| A `flowlary.com` → ZAIXOS-only hostname | Same |
| Wildcard `*.flowlary.com` | Unnecessary; increases cert/nginx scope |
| AAAA | No IPv6 observed on this VPS nginx listen set for a dedicated IPv6 plan; skip until Contabo IPv6 is confirmed and vhosts listen on it |

### 5. Email (leave unless you are changing mail)

Existing MX + SPF are Namecheap forwarding. Keep them if `admin@` / `support@` still use Namecheap forwarding.

When production SMTP is a real provider (not forwarding), update SPF **then**, in a separate change. SMTP for the API (`EMAIL_FROM`) can be a transactional provider without changing MX.

---

## Suggested Namecheap order of operations

1. Approve and add **HTTP** Flowlary nginx vhosts (ACME webroot) on the VPS.
2. Point `@`, `www`, `api` A records to `169.58.11.99`.
3. Wait for resolution: `dig +short A flowlary.com` → `169.58.11.99`.
4. Issue Let's Encrypt certs (HTTP-01).
5. Enable HTTPS server blocks + redirect.

If DNS is switched **before** step 1, `https://flowlary.com` can show ZAIXOS ACF or a certificate name mismatch.

---

## Verification (after you change DNS — not now)

```bash
dig +short A flowlary.com          # 169.58.11.99
dig +short A www.flowlary.com      # 169.58.11.99
dig +short A api.flowlary.com      # 169.58.11.99
curl -sSI --resolve flowlary.com:443:169.58.11.99 https://flowlary.com
```
