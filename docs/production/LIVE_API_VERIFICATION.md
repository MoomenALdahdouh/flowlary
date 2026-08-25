# Live API Verification

**Date:** 2026-08-25  
**Status:** ⚠️ **NOT VERIFIED in automated session** (credential handling policy — set key locally)

## How to verify locally

1. Copy env template (never commit `.env`):

```bash
cp backend/.env.example backend/.env
```

2. Add your Groq key **only** in `backend/.env`:

```
GROQ_API_KEY=your_key_here
```

3. Run verification:

```bash
node scripts/verify-live-api.mjs
```

The script starts the local gateway, calls correction / translation / layout endpoints, and prints status lines **without logging user text or secrets**.

## Expected output (when key is valid)

```
VERIFIED       server — health OK
VERIFIED       auth — install registered
VERIFIED       correction — model=llama-3.1-8b-instant
VERIFIED       translation — model=openai/gpt-oss-120b
VERIFIED       layout — kind=VALID|LAYOUT_MISMATCH
```

## Production host

Production verification against `https://flowlary-api.zaixos.com` requires:

- Gateway deployed with Phase 16 routes
- Production `GROQ_API_KEY` on server
- Valid TLS

**Status:** ⚠️ NOT VERIFIED (not tested from this environment)

## Security

If a Groq API key was pasted into chat or committed accidentally:

1. **Rotate the key** in the Groq console immediately
2. Revoke the old key
3. Never commit `backend/.env`

## Chrome E2E

Manual unpacked extension testing: ⚠️ **NOT VERIFIED**

Load `extension/dist/` after `npm run build` and exercise correction, translation, layout on real pages.
