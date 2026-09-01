# Flowlary Release Readiness

> **HISTORICAL (2026-08-25, NOT PRODUCTION READY).** Current checklist: [../audits/FINAL_RELEASE_REPORT.md](../audits/FINAL_RELEASE_REPORT.md).

**Last updated:** 2026-08-25  
**Overall status:** **NOT PRODUCTION READY**

See [PRODUCTION_READINESS_AUDIT.md](../production/PRODUCTION_READINESS_AUDIT.md) for full analysis.

## Checklist

### Build & tests

- [x] `npm test` passes (481)
- [x] `npm run build` passes
- [x] `npm run build:release` passes
- [x] Release manifest has no localhost permissions
- [x] No API keys in release `dist/`

### AI / API

- [x] Local AI gateway implemented (Phase 16)
- [x] Separate correction / translation / layout contracts
- [x] Managed Groq on server; BYOK opt-in
- [x] Production domain configured: `https://api.flowlary.com` (Phase 16.1)
- [ ] Production API deployed and verified — **DNS REQUIRED**
- [ ] Live Groq end-to-end (all three operations) — **see LIVE_API_VERIFICATION.md**

### Entitlement & billing

- [x] Client fail-closed AI gating (EntitlementService)
- [x] Server ignores client billing header; free-tier server boundary only
- [ ] Server-verified entitlement (account/billing) — **Phase 17**
- [ ] License activation — **NOT IMPLEMENTED**
- [ ] Payment / checkout — **NOT IMPLEMENTED**

### Product UX

- [x] Popup (home / settings / history)
- [ ] Control Center / Writing Lab — **NOT IN REPO**
- [ ] Onboarding — **NOT IMPLEMENTED**
- [ ] Arabic UI + RTL — **NOT IMPLEMENTED**

### Security & privacy

- [x] Safety gate + Phase 13 tests
- [x] CSP + prod host permissions reviewed
- [ ] Public privacy policy URL — **MISSING**
- [ ] Terms of service — **MISSING**

### Store submission

- [ ] Support URL/email — **MISSING**
- [ ] Screenshots — **MISSING**
- [ ] Chrome manual E2E — **NOT VERIFIED**
- [ ] No placeholder production flows — **partial** (license/payment stubs)

### Legal / ops

- [ ] Production payment provider configured
- [ ] Key rotation if secrets were exposed in chat
- [ ] Do not publish until P0 blockers resolved

## Commands

```bash
npm test
npm run build:release
npm run dev:api    # local gateway :8787
```

Load unpacked: `extension/dist/` after build.
