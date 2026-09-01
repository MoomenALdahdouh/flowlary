# Provider Final Closure Report

**Date:** 2026-08-31  
**Purpose:** Close provider integration. No architecture redesign. Real HTTP only.

Advisor **apply remains off**. Write Gate unchanged. Typing does not wait on an LLM.

---

## Answers

1. **Does Groq work?** YES. Real `openai/gpt-oss-20b` at current `GROQ_ADVISOR_MAX_TOKENS=512`. Contract-valid IDs, usage, request ID.
2. **Does Gemini work?** YES. Real `gemini-3.5-flash-lite`. Contract-valid IDs and usage. Production flag still `GEMINI_ADVISOR_ENABLED=0`.
3. **Does OpenRouter work?** AUTH YES / RANKING NO. Credential is present and `GET /api/v1/auth/key` returned HTTP 200. **OPENROUTER MODEL: NOT CONFIGURED.** No default exists in project config; none was invented.
4. **Does failure-only fallback work?** YES. Groq `429 RATE_LIMITED` → real Gemini SUCCESS → OpenRouter not called.
5. **Does local fallback work?** YES. When all reachable providers fail, the manager fails closed and local decision stays authoritative.
6. **Can any provider failure stop typing?** NO. Advisor is async/shadow. Local engine does not depend on it.
7. **Can any provider directly write?** NO. Validator rejects replacement/text/write. Extension apply mode is shadow.
8. **Can a stale provider response write?** NO. `STALE_REQUEST` stops the chain. Write Gate checks generation.
9. **Is the provider manager production-capable?** YES for Groq + Gemini + failure-only fallback. OpenRouter ranking waits on an explicit model.
10. **What EXACT blocker remains?** `OPENROUTER_ADVISOR_MODEL` is empty. Set it when you want OpenRouter ranking. Do not enable advisor apply as part of that.

---

## Provider table

| Provider | Credential | Model | Real HTTP | Contract | Usage | Latency | Status |
|---|---|---|---|---|---|---|---|
| Groq | configured | openai/gpt-oss-20b | YES | PASS | YES (372/436/808, reasoning 399) | 905ms | **WORKS** |
| Gemini | configured | gemini-3.5-flash-lite | YES | PASS | YES (270/52/322) | 1004ms | **WORKS** (flag off in prod config) |
| OpenRouter | configured | **NOT CONFIGURED** | YES (auth 200) | N/A ranking | N/A ranking | 382ms auth | **AUTH ONLY** |

Current Groq max tokens: **512** (not 180). JSON: PASS. Usage: recorded.

---

## Real three-provider chain

| Scenario | Result |
|----------|--------|
| A. Groq success → no Gemini, no OpenRouter | **PASS** — winner groq, hosts=`api.groq.com` only |
| B. Groq RATE_LIMITED → Gemini success → no OpenRouter | **PASS** — real Gemini, fallbackUsed, reason RATE_LIMITED |
| C. Groq fail → Gemini fail → OpenRouter success | **BLOCKED** — OPENROUTER MODEL: NOT CONFIGURED; local authoritative |
| D. All fail → local authoritative | **PASS** |
| E. First valid wins; no voting / second opinion | **PASS** |

---

GROQ: WORKS  
GEMINI: WORKS  
OPENROUTER: AUTH WORKS — RANKING BLOCKED (`OPENROUTER_ADVISOR_MODEL` unset)

REAL THREE-PROVIDER CHAIN: PASS (A/B/D/E). C blocked by missing OpenRouter model.  
FAILURE-ONLY FALLBACK: PASS  
LOCAL FALLBACK: PASS  
PARALLEL VOTING: FORBIDDEN  
MODEL ROUTING: FORBIDDEN  
LLM DIRECT WRITE: FORBIDDEN  
WRITE GATE: PASS  
STALE PROTECTION: PASS  
TYPING DEPENDENCY ON LLM: NO  

**PROVIDER ARCHITECTURE: CLOSED**

The only remaining item is a launch config choice: set `OPENROUTER_ADVISOR_MODEL` if you want the third ranker. That is not an architecture problem.

Production flags left as-is: fallback off, Gemini off, OpenRouter off, apply = shadow.

---

## Tests run

- Backend provider/fallback/validation: 95 passed, 1 skipped live Gemini eval  
- Extension writing-engine / advisor safety: 237 passed  
- Extension build: pass  
- Backend `tsc`: pre-existing errors in feedback/support/http (unrelated; not touched)

Sanitized evidence: `scripts/provider-final-closure.ts` → `tests/e2e/results/provider-final-closure.json` (gitignored).
