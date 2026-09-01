# Live API Verification

**Date:** 2026-08-28  
**Status:** **VERIFIED (local staging)** — all `verify-live-api.mjs` checks pass with `GROQ_API_KEY` in `backend/.env`. Production DNS still blocked.

## How to verify locally

1. Copy env template (never commit `.env`):

```bash
cp backend/.env.example backend/.env
```

2. Add your Groq key **only** in `backend/.env`:

```
GROQ_API_KEY=your_key_here
FLOWLARY_JWT_SECRET=change-me-in-staging-production
```

3. Run verification (starts local server on port **8791** with auth enabled via `FLOWLARY_ENV=staging`):

```bash
node scripts/verify-live-api.mjs
```

Avoid port 8787 if a stale `dev:api` server is running — the script uses 8791 by default.

4. Optional — verify against deployed production (when DNS/TLS ready):

```bash
FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs
```

The script registers an install token, creates an account, checks entitlement, calls correction / translation / layout endpoints, and verifies anonymous install denial — **without logging user text or secrets**.

## Expected output (when key is valid)

```
VERIFIED       server — health OK
VERIFIED       install_auth — install registered
VERIFIED       account_auth — plan=trial
VERIFIED       entitlement — plan=trial
VERIFIED       correction — model=llama-3.1-8b-instant
VERIFIED       translation — model=openai/gpt-oss-120b
VERIFIED       layout — kind=VALID|LAYOUT_MISMATCH
VERIFIED       entitlement_denial — install+anonymous denied
```

## Production host

Production verification against `https://api.flowlary.com` requires:

- Gateway deployed with Phase 16–17 routes
- Production `GROQ_API_KEY` on server
- Valid DNS + TLS

**Status:** ⚠️ **BLOCKED_EXTERNAL** — `api.flowlary.com` does not resolve (2026-08-25)

## Security

If a Groq API key was pasted into chat or committed accidentally:

1. **Rotate the key** in the Groq console immediately
2. Revoke the old key
3. Never commit `backend/.env`

## Chrome E2E

Manual unpacked extension testing: ⚠️ **NOT VERIFIED**

Load `extension/dist/` after `npm run build` and exercise correction, translation, layout on real pages.
