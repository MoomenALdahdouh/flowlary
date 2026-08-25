# Phase 15 Report — Release Packaging & Chrome Web Store Readiness

**Date:** 2026-08-25  
**Prerequisite:** Phase 14 classification **B** (Release Candidate — minor issues) — packaging proceeded  
**Status:** **COMPLETE**

## Version

**1.0.0** (bumped from 0.1.0 for first store-ready package)

Consistent across:

- `package.json` (root, extension, shared)
- `extension/manifest.json` (dev)
- `extension/manifest.prod.json` (release)
- `packages/shared` `BRAND.version`

## Tests

**458 / 458 passing** (+5 Phase 15 tests)

## Build

| Command | Result |
|---------|--------|
| `npm run build` | PASS (dev manifest + localhost defaults) |
| `npm run build:release` | PASS (prod manifest + HTTPS API defaults) |

## Production configuration

| Item | Dev | Release |
|------|-----|---------|
| Manifest | `manifest.json` + localhost hosts | `manifest.prod.json` — HTTPS only |
| Translation API | `http://127.0.0.1:8004` | `https://lingo-api.zaixos.com` |
| Layout API | `http://127.0.0.1:8003` | `https://flowlary-api.zaixos.com` |
| Groq | `https://api.groq.com` | unchanged (BYOK) |

Build flag: `FLOWLARY_RELEASE=1` selects production manifest via `vite.config.ts`.

Centralized in `extension/src/config/endpoints.ts`.

## Manifest

**Release manifest:** PASS

- Name: Flowlary
- Version: 1.0.0
- Permissions: storage, activeTab, clipboardWrite (documented)
- Host permissions (release): Groq + flowlary-api + lingo-api (HTTPS only)
- CSP: strict extension_pages
- Icons: 16/32/48/128 present

## Security

**PASS** — Phase 13 tests re-run; no API keys in release `dist/`; no localhost in release manifest.

## Privacy

**PASS** — `PRIVACY.md` and `DATA_FLOW.md` updated for dev vs release builds and production URLs.

## Chrome package

**Created:** `release/flowlary-v1.0.0.zip` (132 KB)

Contents: `extension/dist/` only (manifest, SW, content script, popup, icons, assets).

Excluded: node_modules, tests, docs, source repos, .git.

## Package validation

**PASS**

- ZIP extracted and validated
- manifest.json valid MV3
- All referenced assets exist
- No localhost in release host_permissions

## Chrome installation

**NOT AVAILABLE** — no Chrome/Chromium automation in CI environment.

## End-to-end user flow

**NOT AVAILABLE** — browser manual QA recommended before store submit.

## SHA-256

```
8000323b67cd31e26cd460bba86f7b2d12e6e6e4bfe80df4776cfbf6d1d1b303  flowlary-v1.0.0.zip
```

Recorded in `release/flowlary-v1.0.0.zip.sha256`

## Store description

**Prepared:** `docs/release/CHROME_WEB_STORE_DESCRIPTION.md`

## Store privacy draft

**Prepared:** `docs/release/CHROME_WEB_STORE_PRIVACY.md`

## Missing store assets

| Asset | Status |
|-------|--------|
| Store screenshots (1280×800 / 640×400) | **MISSING** |
| Promotional tile (440×280) | **MISSING** |
| Public privacy policy URL | **MISSING** |
| Support email / support page URL | **MISSING** |
| Verified production API deployment | **UNVERIFIED** |

Icons exist in-repo (16–128 px PNG). No separate marketing logo beyond extension icons.

## Release blockers (store submission)

1. Publish privacy policy at a stable HTTPS URL
2. Define support contact (email or page)
3. Create store screenshots
4. Verify `lingo-api.zaixos.com` and `flowlary-api.zaixos.com` are deployed and serving `/api/translate` and `/api/analyze-word`
5. Manual Chrome install + feature QA on target Chrome version

## Known limitations

- Backend monorepo package remains placeholder
- No Playwright E2E
- BYOK Groq required for correction
- Live translation default OFF
- Client-side entitlement not server-verified
- **Not uploaded to Chrome Web Store** (by design for Phase 15)

## Files created / modified

**Created:**

- `extension/manifest.prod.json`
- `extension/src/config/endpoints.ts`
- `extension/.env.example`
- `scripts/package-release.mjs`
- `RELEASE_NOTES.md`
- `docs/release/CHROME_WEB_STORE_DESCRIPTION.md`
- `docs/release/CHROME_WEB_STORE_PRIVACY.md`
- `release/RELEASE_CHECKLIST.md`
- `release/flowlary-v1.0.0.zip.sha256`
- `tests/integration/phase15-release-manifest.test.ts`
- `tests/unit/endpoints.test.ts`
- `PHASE15_REPORT.md`

**Modified:**

- Version bump to 1.0.0 (manifests, packages, BRAND)
- `vite.config.ts`, `translate.ts`, `classify.ts`
- `package.json` scripts (`build:release`, `package:release`)
- `docs/privacy/PRIVACY.md`, `DATA_FLOW.md`
- `docs/development/PHASES.md`, `README.md`, `.gitignore`

## Original repositories

- `english-writing-assistant` — untouched
- `ai-writing-translator` — untouched
- `autofix-layout` — untouched

## Final verdict

**RELEASE PACKAGE READY**

The Chrome Web Store upload package is built, validated, and checksummed. Store submission remains blocked until privacy URL, support contact, screenshots, and production API verification are completed.

**Not published. Not deployed.**
