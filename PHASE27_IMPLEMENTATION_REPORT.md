# PHASE 27 — IMPLEMENTATION REPORT

**Status:** Implementation complete against Phase 26 decisions.  
**Verdict:** **NOT PRODUCTION READY**

Phase 26 defined the product. Phase 27 implements it across backend, shared, extension, popup, dashboard, website, and tests.

---

## 1. Reconciliation (before coding)

### Already existed
- Account JWT auth, Paddle billing webhooks, server entitlement endpoints
- Local keyboard layout / Speed Box / privacy / pause
- Learning events, practice sessions, progress metrics, data export/import
- Glass Blur Snow popup/dashboard/website surfaces

### Must change
- Free AI from latency `usageBalanceMs` → **daily weighted credits**
- Trial **7 days** → **30 days** (canonical `ACCOUNT_TRIAL_DURATION_MS`)
- Install-token managed AI → **denied** (`account_required`)
- Website/extension copy: Lemon / “1 month free” / “2h” → Phase 26 language
- Entitlement: explicit **capabilities** + credit fields on account views

### Must remove / retire
- User-facing “2h AI”, remaining-milliseconds UX as the primary meter
- Install-auth AI bypass (no account debit)
- Lemon Squeezy marketing claims
- Client-invented Free AI without server mirror

### Must add
- Credit weights, daily/monthly windows, capability sets
- Sign-in UX for Flowlary AI; calm exhaustion UX
- Free vs Pro learning/practice/export gates
- Migrations that **zero** legacy latency balances (do not convert ms → credits)

### Contradictions resolved (Phase 26 wins)
| Topic | Old code | Phase 26 / Phase 27 |
| --- | --- | --- |
| Trial | 7 days | 30 days |
| Free AI | 2h latency budget | 40 credits/day UTC |
| Pro AI | Often uncapped | 200/day + soft 1500/month |
| Install auth AI | Allowed | Denied |
| Billing copy | Lemon Squeezy | Payment partner / Paddle backend |

---

## 2. What changed

### Entitlement architecture
- Server is the only billing/usage authority.
- Capabilities (examples): `keyboard.unlimited`, `ai.correction`, `learning.full`, `practice.full`, `learning.export`, …
- Plans / lifecycle: `free`, `trial`, `pro`, plus `suspended` / subscription-driven past-due / cancelled via existing billing map.
- Client entitlement **mirrors** server cache for UI only.

### Usage model
| Operation | Weight |
| --- | --- |
| Correction | 1 |
| Layout AI classify | 1 |
| Practice check | 1 |
| Translation | 2 |
| Live translation | 2 |

| Plan | Daily | Monthly soft |
| --- | --- | --- |
| Free | 40 | — |
| Trial / Pro | 200 | 1500 |

- Reset: **00:00 UTC** (no rollover).
- Debit only on **successful** AI.
- Rate limits remain separate.
- Structured entitlement/usage: `creditsRemaining`, `creditsUsed`, `dailyLimit`, `resetAt`, `capabilities`.

### Trial
- One constant: `ACCOUNT_TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000`
- Starts on registration; full Pro capability set; credit-metered at Pro daily/monthly.
- Expiry → Free with daily credits (legacy `usageBalanceMs` ignored).

### Free forever (never AI-gated)
- Keyboard Layout Repair, Speed Box, local spell assist, pause, privacy, reset, safety.

### Pro / Trial value
- High AI limits, full learning, advanced progress, full practice, learning export/import.

### Install-auth AI bypass
- Install token authenticates install identity but `allowed: false`, reason `account_required`.
- UX: “Sign in to use Flowlary AI” while local tools stay ready.

### Learning / practice / progress
- Learning still from correction/practice only (not translation/layout).
- Free: basic progress + practice teaser.
- Trial/Pro: recurring mistakes, full practice, export/import.
- Insufficient data copy preserved (“collecting enough writing data…”).

### Pricing website
- FREE / PRO, 30-day Trial, $9/month · $90/year, 40 daily Free credits.
- Honest billing: payment partner; no fake checkout activation.
- SEO tests updated (no Lemon / “1 month free”).

### Migrations
- Local `usageBalanceMs` always normalized to **0** (v2 usage state).
- Server accounts seed credit windows; old ms balance not converted to credits.

### Security
- Client cannot unlock Pro / inflate credits / invent trial / bypass quota via headers.
- Install token cannot use managed AI.
- Export still excludes API keys / secrets (existing export deny-list).

### Observability
- Usage rows can record `creditsCharged` + `mode`; no writing content / JWTs / keys logged.

---

## 3. Files changed (high level)

**Shared:** `packages/shared/src/credits.ts`, `capabilities.ts`, `account/types.ts`, `entitlement/index.ts`, `index.ts`, `events.ts`

**Backend:** `accountService.ts`, `db/store.ts`, `middleware/auth.ts`, `gateway/*`, `routes/http.ts`, `services/usage.ts`

**Extension:** entitlement storage/service, popup `status.ts` + i18n, account auth cache, background status, dashboard Account/Overview/Progress/Practice/DataControl, correction/practice mode plumbing

**Website:** pricing i18n (en/ar), Account usage display, PricingShowcase typing, SEO honesty tests, account client types

**Tests:** phase16/17, popup status, entitlement service, credits-capabilities unit, mock account auth helper, phase12/14 transport fixtures, schemas migration expectations

**Report:** this file

---

## 4. Tests

- Full suite: **630 passed** / 89 files (after `npm run build:release` so phase23 scans release `dist`).
- New/updated coverage: credit weights, 30-day trial, install AI deny, daily debit weight 2 for translation, account-required entitlement, pricing honesty, popup credit UX.

---

## 5. Build + release audit

| Command | Result |
| --- | --- |
| `npm test` | Pass (630) |
| `npm run build` (extension) | Pass (dev host permissions expected) |
| `npm run build:release` | Pass — `host_permissions` = `https://api.flowlary.com/*` only |
| Website `tsc` + build | Pass |
| Release scan | No `GROQ_API_KEY` / `localhost` / `127.0.0.1` in release dist |

**Note:** Running non-release `npm run build` for the extension reintroduces localhost host permissions into `extension/dist`. Always re-run `build:release` before shipping or phase23.

---

## 6. UI / UX changes

- Popup: plan + daily credits + reset countdown; exhaustion is warn-not-error; layout stays ready.
- Dashboard Account: credit fraction display.
- Settings → Data: export/import upgrade state for Free.
- Progress: advanced recurring section gated; Free sees upgrade teaser.
- Practice: Pro/Trial full; Free sees full-practice teaser banner.
- Pricing: Trial-first Pro card, Free forever keyboard/Speed Box emphasis.

---

## 7. Known limitations

1. **Paddle checkout / live billing** may still be environment-gated — website stays honest when checkout is not ready.
2. **Live API / production infrastructure** verification is outside this phase’s automated gate.
3. **`remainingMs`** retained as transitional mirror of credit remaining for older clients — UI prefers `creditsRemaining`.
4. Free practice is a **teaser**, not a separate miniature engine.
5. Multi-account trial abuse controls beyond registration-bound trial are still limited (same as Phase 26 risk notes).

---

## 8. External blockers

- Production Paddle catalog / webhook / portal readiness for real paid Pro.
- Live `api.flowlary.com` verification with account JWT + credit debit in staging/prod.
- Chrome Web Store listing copy alignment with 30-day Trial + daily credits (docs may still mention install auth historically).

---

## 9. Product QA checklist

| Question | Result |
| --- | --- |
| Free clear in ~5s? | Yes — Free forever local + 40 credits/day |
| Pro clear in ~5s? | Yes — higher AI + full learning/practice/export |
| Why Pro better? | Yes — grouped comparison + Pro emphasis |
| Free forever tools? | Yes — Keyboard + Speed Box called out |
| AI usage / reset? | Yes — credits + UTC reset copy |
| Trial? | Yes — 30-day full experience |
| Learning / Practice? | Yes — basic vs full gates |
| Upgrade without confusion? | Yes — account + pricing honesty |
| Local after AI exhaustion? | Yes — layout/Speed Box remain |

---

## FINAL VERDICT

**NOT PRODUCTION READY**

Implementation matches Phase 26 product decisions and the automated suite is green, but production readiness still depends on live billing enablement and live API verification — do not claim production ready until those external blockers clear.
