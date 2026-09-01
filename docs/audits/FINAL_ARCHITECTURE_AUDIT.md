# Final architecture audit (code as of 2026-09-01)

This is a **snapshot of what exists**, not a redesign proposal. Conflicts with older `docs/audit/*` and root `PHASE*_REPORT.md` are resolved in favor of **this file + freeze docs + source**.

## What exists and is used

| Area | Production path |
| --- | --- |
| Extension writing | `InputEngine` → EventBus → `startEnforceCoordinator` → `runFieldCycle` → `decideWriting` → `fulfillWritingDecision` → `commitWriteTransaction` |
| Shortcuts / Speed Box | CommandRouter + feature modules; writes still via Write Gate / tagged `manual_box` |
| Advisor | `RANK_HYPOTHESES` → `/api/ai/hypothesis-advisor` → ID ranking |
| Writing Review | `registerProductionWritingReview` → `/api/ai/writing-review` → ingest → decide → Write Gate |
| Translation | Policy + session + `/api/ai/translation` |
| Backend | `backend/src/index.ts` → `routes/http.ts` |
| Website | Vite static site; Writing Lab uses **correction API**, not `runFieldCycle` |
| Shared | `packages/shared` contracts |
| Storage | Extension chrome.storage; API JSON file `FLOWLARY_DATA_PATH` |
| Billing | Paddle webhooks → entitlement |
| Learning | Events + dashboard; not a second `decideWriting` |
| Deploy | Docker / nginx / PM2 under `deploy/` |

## Used vs dead vs legacy vs experimental vs docs-only

| Item | Class |
| --- | --- |
| Enforce coordinator + Write Gate | **Production** |
| Shadow coordinator | **Production observe-only** (must not write) |
| `CorrectionScheduler.start` / `TranslationScheduler.start` | **Retired shells** — empty EventBus writers; do not resurrect |
| `scheduleRemoteEnglishAssist` | **No-op** (absorbed by review) |
| `CORRECT_TEXT` whole-range | **Production** for Speed Box / practice / website lab only |
| Independent PIPELINE as fourth brain | **Deprecated** |
| Local SLM / Ollama | **Not implemented**; measured NO-GO |
| `docs/audit/*`, `PHASE*_REPORT.md` | **Historical documentation** |
| `tests/audit/evaluation`, live eval tests | **Test-only** (gated) |
| `/__debug/ingest` | **Dev-only** debug ingest; writes only if `FLOWLARY_AGENT_DEBUG_LOG` |
| Site denylist for Gmail/Notion | **Intentionally absent** |
| `.github` CI | **Absent** |
| Advisor apply-from-late-tick auto-write | **Not allowed** (suggestion only) |

## Duplicates (keep until proven unused)

- `ADVISOR_PROVIDER_ORDER` vs `AI_ADVISOR_PROVIDER_ORDER`
- `VITE_TRANSLATION_API_URL` / `VITE_LAYOUT_API_URL` aliases
- Dual webhook paths `/api/billing/webhook` and `/api/billing/paddle/webhook` (both exist — treat as same billing ingress)

## Partial / ops-dependent

- Gemini/OpenRouter review fallback (needs keys)
- Google Translate
- Live Paddle
- SMTP
- Chrome Web Store listing URL still `null` on website until published

## Security/privacy boundaries (actual)

- Extension never holds Groq/Gemini/OpenRouter/Paddle secrets.
- Install tokens cannot spend managed AI.
- Client entitlement header is telemetry; server recomputes.
- Review/advisor send bounded snippets; protected tokens skip review.
- Gateway must not log raw field text (usage metadata only). Debug file is opt-in.

## Cleanup performed in this freeze

- Removed temporary `/health` agent-debug payload (session id / UA).
- `appendAgentDebugLog` no longer hardcodes a developer machine path; opt-in env only.
- Shortcut `planShortcutFixes` now respects **personal layout exceptions** (engine spans previously bypassed the list).

Schedulers were **not deleted**: they are imported by feature start; emptying `start` is the retirement. Deleting classes without a full import/dynamic-string audit would risk breaking tests.
