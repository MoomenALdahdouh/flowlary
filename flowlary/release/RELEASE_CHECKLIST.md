# Flowlary Release Checklist (v1.0.0)

Generated during Phase 15 packaging. Do not publish until blockers are resolved.

## Version & build

- [x] Version verified (1.0.0 — manifest, package.json, BRAND)
- [x] Production manifest (`manifest.prod.json`) — no localhost hosts
- [x] Production API defaults (HTTPS) in release build
- [x] `npm test` passing
- [x] `npm run build:release` passing
- [x] Release ZIP created (`release/flowlary-v1.0.0.zip`)
- [x] SHA-256 hash generated
- [x] ZIP validated (manifest, paths, no localhost in prod manifest)

## Security & privacy

- [x] Phase 13 security tests passing
- [x] No API keys in build artifacts
- [x] Privacy documentation reviewed (`docs/privacy/`)
- [x] Security documentation reviewed (`docs/security/`)
- [ ] Public privacy policy URL published — **BLOCKER**
- [ ] Support contact published — **BLOCKER**

## Manifest & permissions

- [x] Permissions reviewed (storage, activeTab, clipboardWrite)
- [x] Host permissions reviewed (Groq + production APIs only in release)
- [x] CSP present
- [x] Icons present (16/32/48/128)

## Features (manual QA recommended)

- [ ] Chrome installation tested — NOT AVAILABLE in CI
- [ ] Popup tested manually
- [ ] Layout / Speed Box tested manually
- [ ] Translation tested against live API
- [ ] Live translation tested
- [ ] Correction BYOK tested
- [ ] History tested
- [ ] Safety on protected fields tested

## Store submission

- [x] Store description draft prepared
- [x] Store privacy draft prepared
- [ ] Screenshots (1280×800 or 640×400) — **MISSING**
- [ ] Promotional tile (440×280) — **MISSING**
- [ ] Privacy policy URL — **MISSING**
- [ ] Support URL/email — **MISSING**
- [ ] Production API uptime verified — **VERIFY BEFORE SUBMIT**

## Do not do in this phase

- [ ] Upload to Chrome Web Store
- [ ] Publish or deploy backend automatically

## Integrity

See `flowlary-v1.0.0.zip.sha256` for SHA-256 of the release ZIP.
