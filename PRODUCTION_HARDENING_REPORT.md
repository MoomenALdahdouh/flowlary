# Flowlary Production Hardening / Real-World Verification

**Date:** 2026-08-31  
**Scope:** Real Chrome extension, real local writing path, paced live advisor probes. Provider architecture left frozen except a measured Groq token-budget correction.

---

## A. Executive Verdict

**READY FOR PRIVATE BETA**

Not **PRODUCTION READY**. Core writing now has real Chrome evidence. Groq and Gemini received real contract-valid requests with token usage. OpenRouter was not live-tested (no local key; a previously committed example key was treated as compromised and not reused). Production fallback remains off. Advisor apply remains shadow-only.

---

## B. Real-World Score

| Area | Score | Evidence |
|------|-------|----------|
| Core writing | **PASS** | Chrome input/textarea layout correction, offline typing, reload |
| Browser compatibility | **PASS with policy** | textarea/input auto-write; contenteditable verified as no auto-write |
| Local engine | **PASS** | Works with network off and without advisor apply |
| Groq | **PASS at 512** | 3/3 SUCCESS after budget fix; 3/3 CONTRACT_FAILURE at 180 |
| Gemini | **PASS (adapter)** | 3/3 SUCCESS + usage; production flag still off |
| OpenRouter | **NOT VERIFIED** | No local `OPENROUTER_API_KEY` / model |
| Fallback | **PASS (injected)** | Groq RATE_LIMITED → Gemini SUCCESS; production fallback still disabled |
| Safety | **PASS after fix** | Chrome originally corrupted `https`; fixed and re-verified |
| Performance | **PASS** | Keystroke p95 &lt; 250ms in Chrome; local decide &lt; 50ms |
| UX | **PARTIAL** | Popup/onboarding not driven in E2E; no provider names in product UI |
| Reliability | **PARTIAL** | Core path solid; legacy integration suite still dirty |

---

## C. Real Provider Evidence

### Groq — `openai/gpt-oss-20b`

| Check | Result |
|-------|--------|
| Real HTTP request | **PASS** (request IDs present) |
| Real response | **PASS** at `max_tokens=512` |
| Contract valid | **FAIL at 180** (3/3 `CONTRACT_FAILURE`); **PASS at 512** (3/3) |
| Usage evidence | **YES** at 512: ~374 in / ~212–237 out / reasoning **172–198** |
| Dashboard evidence | **NOT AVAILABLE** programmatically. **REAL API RESPONSE CONFIRMED; DASHBOARD VERIFICATION MANUAL.** |
| Latency | 494–598ms |
| Error rate | 100% at 180; 0% at 512 (n=3 each) |
| Current limitation | Reasoning tokens (~185+) exceed 180. Default is now **512**, env-overridable. Advisor still **shadow-only** in the extension. |

### Gemini — `gemini-3.5-flash-lite`

| Check | Result |
|-------|--------|
| Real HTTP request | **PASS** |
| Real response | **PASS** |
| Contract valid | **PASS** 3/3 |
| Usage evidence | **YES** (~272 in / 27–53 out / ~299–325 total) |
| Dashboard evidence | **NOT AVAILABLE** programmatically. **REAL API RESPONSE CONFIRMED; DASHBOARD VERIFICATION MANUAL.** |
| Latency | 743–940ms |
| Error rate | 0% (n=3) |
| Current limitation | `GEMINI_ADVISOR_ENABLED=0` in local production config. Probe enabled the adapter only. |

### OpenRouter

| Check | Result |
|-------|--------|
| Real HTTP request | **FAIL / SKIPPED** |
| Real response | **NOT RUN** |
| Contract valid | **NOT RUN** |
| Usage evidence | **NO** |
| Dashboard evidence | **NO** |
| Current limitation | No key in `backend/.env`. A key that appeared in tracked `.env.example` was **stripped** and **not reused**. **Rotate that key.** Model still unset. |

---

## D. Fallback Evidence

Production `ADVISOR_FALLBACK_ENABLED` remains **0**. Live chain was not forced against real quotas.

**Injected failure-only sequence (real manager, fake adapters):**

1. Groq → `RATE_LIMITED` (12ms)  
2. Gemini → `SUCCESS` (8ms)  
3. OpenRouter → **not called**  
4. `fallbackUsed: true`, `localDecisionAuthoritative` preserved on total failure (existing unit/integration coverage)

**Expected live production behavior today:** Groq only (if enabled). Gemini/OpenRouter are not attempted unless fallback is explicitly enabled.

---

## E. Browser E2E Evidence

Harness: Playwright + built `extension/dist` loaded into Chromium (`--load-extension`, headed). Fixture: `tests/e2e/fixtures/writing-lab.html`.

| Scenario | Result |
|----------|--------|
| Extension service worker loads | PASS |
| textarea layout mismatch (`اثممخ حمثشسث ` → `hello please`) | PASS |
| input layout mismatch | PASS |
| contenteditable: no auto-write | PASS |
| URLs / emails / JWT / API-key stay intact | PASS (after URL-scheme fix) |
| Mixed Arabic + API + URL + email | PASS (after URL-scheme fix) |
| Rapid typing, Space/Enter/Tab, paste, selection | PASS |
| Continue typing after a correction | PASS |
| Offline typing | PASS |
| Page reload still types | PASS |
| Popup / first-win / settings | **NOT RUN** |
| Gmail/Notion/Slack composers | **NOT RUN** (contenteditable policy only) |
| Disconnect mid-advisor apply | **N/A** (shadow mode; local path tested offline) |

First Chrome run caught two real bugs: leftover second-word layout dropped; `https` incrementally rewritten to Arabic. Both were fixed and the suite re-run to **10/10 PASS**.

---

## F. Bugs Found

### P0 — Tracked example secrets

- **Root cause:** `backend/.env.example` contained live-looking Gemini and OpenRouter keys.  
- **File:** `backend/.env.example`  
- **Fix:** Values cleared.  
- **Regression:** Do not commit secrets into examples.  
- **Verification:** Example keys empty. **Rotate any key that was ever committed.**

### P0 — Incremental `https` layout corruption (Chrome)

- **Root cause:** URL schemes were only protected after `://` existed. Mid-type `https` / `https:` was treated as a layout token and rewritten (`https` → `اففحس`).  
- **File:** `extension/src/core/safety/tokenKind.ts`, `extension/src/core/engine/hypotheses.ts`  
- **Fix:** Protect `http(s)`, `https:`, and block Latin→Arabic layout next to English prose.  
- **Tests:** characterization + product-readiness + Chrome E2E  
- **Verification:** Chrome protected-token and mixed-language tests PASS

### P1 — Groq `max_tokens=180` incompatible with gpt-oss-20b

- **Root cause:** Reasoning tokens (~172–198 observed) consume the 180 completion budget; Groq returns `json_validate_failed` / `CONTRACT_FAILURE`.  
- **File:** `backend/src/config/env.ts` default **512** (still `GROQ_ADVISOR_MAX_TOKENS` overridable; Gemini/OpenRouter budgets unchanged)  
- **Fix:** Default 512 — smallest previously measured working JSON budget. Not 1024.  
- **Verification:** Live probe 3/3 SUCCESS with usage + request IDs

### P1 — First layout word blocked remaining words

- **Root cause:** After `hello` was written, leftover `حمثشسث` was high-risk isolated layout; `write_as_is` on `hello` vetoed the next fix. Write cooldown also dropped the follow-up cycle.  
- **Files:** `decide.ts`, `hypotheses.ts`, `enforceCoordinator.ts`  
- **Fix:** Leftover known-English layout after an English neighbor; cooldown reschedule.  
- **Verification:** Unit leftover test + Chrome textarea/input PASS

### P1 — Shadow advisor blocked local decisions (prior phase)

- Already fixed in `pipeline.ts`. Reconfirmed: production apply mode is still `shadow`.

---

## G. Remaining Risks

1. **OpenRouter never received a real request in this session.** Enable only after a new key + explicit model.  
2. **Production fallback is off.** Gemini works as an adapter but is not in the live production chain.  
3. **Advisor remains shadow-only.** Users get local decisions only.  
4. **Popup/onboarding/settings** were not Chrome-driven.  
5. **Rich editors** stay suggestion/shortcut-only by design.  
6. **Legacy integration failures** (phase6 live translation, wl4d timeouts, etc.) were not cleaned. They are outside the enforce writing path.  
7. **Rotate compromised example keys** if they ever left the machine.

---

## H. Final Architecture

```
USER KEYSTROKE
  → InputEngine (never waits on network)
  → enforceCoordinator (retry after write cooldown)
  → local analyzeFieldText / collectHypotheses / decideWriting
  → optional async advisor (shadow, non-blocking)
       → background RANK_HYPOTHESES
       → AdvisorProviderManager (sequential, failure-only if enabled)
       → Groq | Gemini | OpenRouter
       → validateAdvisorProviderContent (IDs only)
  → Write Gate (generation / mutex / cooldown / tier)
  → DOM write
```

No LLM replacement text. No voting. No model routing. Write Gate remains the only mutator.

---

## I. Exact Commands

```bash
npm run build:ext
npm run test -w @flowlary/extension -- writing-engine
npm run test -w @flowlary/backend -- advisorValidation advisorConfig advisorProviderManager ai-provider-fallback
node --import tsx scripts/advisor-live-probe.ts
npx playwright test --config tests/e2e/playwright.config.ts
```

Results recorded this session:

- Writing engine: **234 passed**
- Backend advisor/fallback/config: **58 passed**
- Live probe: `tests/e2e/results/provider-probe.json` (sanitized; gitignored)
- Chrome E2E: **10/10 passed**
- Extension build: **PASS** (`extension/dist`)

---

## J. Final Release Decision

A real Chromium instance loaded the built extension, typed into input/textarea/contenteditable, corrected Arabic-keyboard English, left protected URLs/emails/JWTs/keys intact, stayed usable offline, and never waited on an LLM.

Groq and Gemini were called for real. Groq is unusable at 180 and usable at 512. Gemini ranked valid IDs with token usage. OpenRouter was not exercised. Fallback is proven only with injected failures because production fallback is still disabled.

That is enough for a **private beta** on standard text fields. It is not enough to call the product production-ready until OpenRouter is proven or formally disabled, fallback policy is an explicit launch decision, and a human walks popup/onboarding plus one real website composer.
