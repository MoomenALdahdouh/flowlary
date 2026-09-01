# Flowlary Pre-Publish Compliance Checklist

Use before publishing website legal pages and submitting browser store listings.

## Website

- [x] Privacy accessible at `/privacy`
- [x] Terms accessible at `/terms`
- [x] Cookie policy at `/cookies` (storage-focused; no tracking cookies)
- [x] Contact accessible at `/contact`
- [x] Support expanded at `/support`
- [x] Footer links: Privacy, Terms, Cookies, Support, Contact
- [ ] HTTPS on production (ops)
- [x] No `LEGAL INPUT REQUIRED` strings in public UI
- [x] No `review-flag` spans in public UI
- [x] No localhost in production build output (security tests)
- [ ] Lawyer review complete

## Chrome Web Store

- [x] Privacy URL ready (`https://flowlary.com/privacy`)
- [x] Data disclosures documented
- [x] Permission justification written
- [x] Host permissions match release manifest
- [x] Single purpose documented
- [ ] Listing text matches website
- [ ] Support email in listing
- [ ] CWS URL configured in `website/src/config.ts`
- [ ] Submission package from `package:release`

## Microsoft Edge Add-ons

- [x] Privacy URL ready
- [x] Data usage disclosure aligned with Chrome
- [x] Permission justification shared
- [x] Paid features documented
- [ ] Partner Center account
- [ ] Support contact in listing

## Billing

- [x] Pricing $0 / $4.99 / $39 on site
- [x] Trial 30 days / 1000 checks documented
- [x] Paddle disclosure in Privacy/Terms
- [x] No card storage claim
- [ ] Refund policy confirmed with legal/Paddle
- [ ] Live checkout verified

## Student

- [x] Academic email verification disclosed
- [x] Not enrollment verification — explicit
- [x] 12-month benefit documented
- [ ] Program eligibility legal review

## AI

- [x] Provider disclosure (Groq, Google)
- [x] Writing processing disclosed
- [x] Translation routing disclosed
- [x] AI limitations in Terms
- [x] No “AI never sees your data” claims

## Engineering verification

- [ ] `npm run test:web` pass
- [ ] `npm run build:web` pass
- [ ] Production dist scan: no placeholders/TODO/legal markers
- [ ] Extension `phase23-security` pass

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product | | | |
| Engineering | | | |
| Legal counsel | | | |
| Ops | | | |
