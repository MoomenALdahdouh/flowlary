# Flowlary Legal, Privacy & Trust Implementation Report

**Date:** 30 August 2026  
**Verdict:** **ENGINEERING READY — LEGAL REVIEW REQUIRED**

---

## 1. Executive summary

Flowlary’s public legal, privacy, trust, support, and contact surfaces were rebuilt from a **forensic repository audit** of the website, extension, backend, and shared packages. Privacy and Terms now accurately disclose that **writing text is transmitted** for AI features, that **learning data syncs to the server** when signed in, and that **Groq, Google Translate, Paddle, and SMTP** process data as configured.

Implemented: comprehensive Privacy, Terms, Cookie Policy, Contact page, expanded Support topics, legal footer links, EN + AR legal content, sticky section navigation, and nine audit/compliance documents under `docs/legal/`.

**Not done (requires legal/ops):** legal entity name, registered address, governing law, public support/privacy email, refund policy, account deletion self-service, lawyer sign-off, live store submission.

---

## 2. Actual data flows

See [`FLOWLARY_DATA_PROCESSING_AUDIT.md`](./FLOWLARY_DATA_PROCESSING_AUDIT.md).

**Critical facts:**
- Correction/translation text → `api.flowlary.com` → Groq and/or Google
- Learning events (512-char pairs) sync server-side when signed in
- Usage logs exclude user text; IP used only for auth rate limits
- No full account deletion API

---

## 3. Third-party services

| Provider | Purpose | Conditional |
|----------|---------|-------------|
| Groq | AI inference | When `GROQ_API_KEY` set |
| Google Cloud Translation | Translation | When `GOOGLE_TRANSLATE_ENABLED=1` |
| Paddle | Billing | When Paddle env configured |
| SMTP | Transactional email | When SMTP configured |
| Hosting provider | Infrastructure | Deployment-specific |

---

## 4. Browser permissions

See [`FLOWLARY_EXTENSION_PRIVACY_DISCLOSURE.md`](./FLOWLARY_EXTENSION_PRIVACY_DISCLOSURE.md).

Release: `storage`, `activeTab`, `clipboardWrite`, host `https://api.flowlary.com/*`, content scripts `<all_urls>` + Flowlary website bridge.

---

## 5. Chrome compliance

See [`FLOWLARY_CHROME_STORE_COMPLIANCE.md`](./FLOWLARY_CHROME_STORE_COMPLIANCE.md). **READY FOR SUBMISSION** preparation; CWS URL still null.

---

## 6. Edge compliance

See [`FLOWLARY_EDGE_ADDONS_COMPLIANCE.md`](./FLOWLARY_EDGE_ADDONS_COMPLIANCE.md). Aligned with Chrome package; Partner Center ops pending.

---

## 7. Privacy implementation

- Route: `/privacy`
- 22 sections with TOC navigation
- EN + AR (`website/src/content/legal/`)
- Fixed prior contradiction (learning sync)
- Effective date: 30 August 2026

---

## 8. Terms implementation

- Route: `/terms`
- 24 sections covering Free/Trial/Pro/Student/Billing/AI limits
- No fake governing law — states not specified
- No public `review-flag` UI

---

## 9. Cookie decision

**Separate Cookie Policy created** (`/cookies`) because:
- Website localStorage (theme, locale, AI consent)
- Extension storage (significant user data)
- Paddle cookies during checkout

**No cookie consent banner** — no third-party analytics cookies on marketing site; EU/UK assessment LEGAL INPUT REQUIRED.

---

## 10. Contact implementation

- Route: `/contact`
- Topic-based routing to Support, Account, Pricing, Privacy, Terms
- Honest note: dedicated inbox not published yet
- No invented email addresses

---

## 11. Support implementation

Expanded topics: Trial, Pro, Student, Billing, Troubleshooting (`#troubleshooting`). Contact section links to `/contact`.

---

## 12. Arabic implementation

Full Arabic Privacy, Terms, Cookies, Contact in `website/src/content/legal/ar.ts`. Professional MSA — not mechanical paste of English. RTL via existing site i18n.

---

## 13. Store consistency

See [`FLOWLARY_STORE_DISCLOSURE_MATRIX.md`](./FLOWLARY_STORE_DISCLOSURE_MATRIX.md).

---

## 14. Security claim audit

| Claim | Action |
|-------|--------|
| "sent securely" (Writing Lab) | Changed to "over HTTPS" |
| Old privacy "not uploaded" learning | Removed |
| "For legal review" UI badges | Removed from public pages |
| GDPR/CCPA compliant | Never added |
| BYOK in public copy | Already absent |

---

## 15. Legal input register

See [`FLOWLARY_LEGAL_INPUT_REGISTER.md`](./FLOWLARY_LEGAL_INPUT_REGISTER.md) — 25+ items requiring owner/lawyer input.

---

## 16. Accepted risks

- `<all_urls>` content script scope (industry-standard for writing tools; requires store justification)
- No self-service account deletion
- No public privacy/support email until ops publishes
- Groq/Google processor retention not contract-documented in repo

---

## 17. Unresolved legal questions

1. Who is the legal operator?
2. Which governing law applies?
3. Is a cookie banner required for target markets?
4. What is the refund policy?
5. How are data subject access/deletion requests handled without account deletion API?

---

## 18. Tests

```
npm run test:web → 133 passed (19 files)
```

Updated: `routes.test.tsx`, `seo.test.tsx`, `buttons.test.tsx`

---

## 19. Build

```
npm run build:web → success
Prerendered 17 routes + 404.html
```

New prerender routes: `/cookies`, `/contact`, `/guide`

Production dist scan: no `LEGAL INPUT REQUIRED`, `localhost`, or `For legal review` in output.

---

## 20. Final publication readiness

| Area | Status |
|------|--------|
| Engineering accuracy | Ready |
| UX/design (legal pages) | Ready |
| Arabic legal content | Ready for lawyer review |
| Lawyer review | **Required** |
| Ops (email, entity, CWS) | **Required** |
| Store submission | Blocked on CWS URL + support email |

**Overall:** ENGINEERING READY — LEGAL REVIEW REQUIRED
