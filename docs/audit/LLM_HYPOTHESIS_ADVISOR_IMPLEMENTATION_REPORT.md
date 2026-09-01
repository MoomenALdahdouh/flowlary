# LLM Hypothesis Advisor Implementation Report

**DATE:** 2026-08-31  
**SCOPE:** Hybrid C — local hypotheses → bounded LLM ranker → Policy → Write Gate.  
**NOT IN SCOPE:** Translation redesign, English rewrite provider, personal vocabulary, UI.

---

## 1. Current advisor architecture

The Decision Engine already generated span hypotheses (`collectHypotheses`) and `decideWriting` already accepted an optional `AdvisorVote` (hypothesis IDs only). Foundation Safety left `needsLLM` / mix-unsafe layout hypotheses in place but did not call a model.

This phase fills that hook:

1. `analyzeFieldText` + `collectHypotheses` (local, unchanged writers).
2. `shouldConsultAdvisor` — ambiguity / `needsLLM` only.
3. `consultAdvisor` → registered `AdvisorFn` → background `RANK_HYPOTHESES` → `POST /api/ai/hypothesis-advisor`.
4. `validateAdvisorVote` — IDs must belong to the current cycle; no replacement payload.
5. `decideWriting` applies the first *allowed* ranked hypothesis.
6. `mixedLayoutSafety` can skip a ranked `fix_layout` and fall through to noop.
7. Write Gate `runWritingPipeline` is the only mutation path.

There is still one Decision Engine, one Write Gate, one layout mapper (`mapLayout`).

---

## 2. Provider reused

No second HTTP client and no second Groq wrapper.

| Layer | Reuse |
| --- | --- |
| Model chat | Existing `callGroqChat` |
| Auth / entitlement | Existing `assertEntitlement` + `layout-classification` rate limit and managed usage |
| Timeout | Existing gateway `withTimeout` |
| Extension fetch | Existing `prepareManagedAiRequest` + `FLOWLARY_API_BASE` |

**Configuration**

- Provider: Groq via `callGroqChat`
- Model: `AI_MODELS.HYPOTHESIS_ADVISOR` = `allam-2-7b` (same compact model as layout classification)
- Temperature: `0`
- `maxTokens`: `180`
- `responseFormat`: `json_object`
- Snippet cap: `160` chars
- Hypothesis cap: `24`

---

## 3. Advisor registration

`startWritingRuntime` calls `registerProductionHypothesisAdvisor()` after bootstrap and before feature schedulers. That sets `productionHypothesisAdvisor`, which uses `chrome.runtime.sendMessage({ type: 'RANK_HYPOTHESES' })`.

Unit tests leave the hook `null` unless they register a mock or call the register helper. `n1-enforce-init` clears the hook in `afterEach` so production registration does not leak.

This is not a test-only mock in production boot.

---

## 4. Trigger conditions

`shouldConsultAdvisor` returns false when any of:

- `!safetyAllowed`, composing, `editorTier !== 1`, paste/drop, `helpStyle === 'shortcuts_only'`, assistant disabled
- any `user_override` hypothesis
- a **strong mechanical layout** (`fix_layout`, `risk === 'low'`, `!needsLLM`, `sequence_agreement`) with no rival write ≥ 0.5
- fewer than two hypotheses
- no `needsLLM` hypothesis
- analysis contains a sensitive `protectedKind` (password, jwt, api-key, tokens, credit-card, …)
- fewer than two conflicting *action* hypotheses **and** fewer than two `needsLLM` hypotheses

The coordinator / FieldSession debounce is unchanged. The pipeline may run every settled cycle; the model runs only when the above is true.

---

## 5. Input schema

`AdvisorPacket`:

- `cycleId`, `generation`
- `policy` (helpStyle, translation mode flag, layoutAuto, correctionEnabled)
- `allowedIntents` (canonical existing names)
- `snippet` — window around conflicting / `needsLLM` spans (±24 chars), capped at 160, secrets replaced with `[protected]`
- `hypotheses[]`: `id`, `intent`, `localScore`, `risk`, `needsLLM`, `conflicts`, evidence **kinds**, `mixUnsafe`, `hasReplacement`

No replacement text, no passwords, no cookies, no full field by default.

---

## 6. Output schema

```json
{
  "rankedHypothesisIds": ["h2", "h1"],
  "ambiguityClass": "layout_vs_spelling",
  "reasonCode": "context_supports_english"
}
```

Rejected if JSON is invalid, IDs are unknown, arrays are empty, or the object contains `replacement` / `text` / `write`.

---

## 7. Hypothesis ranking

The model may only order IDs that were supplied. `decideWriting` walks `rankedHypothesisIds`:

- `preserve` / `write_as_is` / `unknown` / `user_override` → noop
- mix-unsafe `fix_layout` → skip (veto), continue
- `needsLLM` or non-low risk or not auto-eligible → suggestion (local candidate replacement only)
- otherwise the existing candidate action (`layout_fix` / `english_correction` / `translation`)

The model cannot invent H4 or change H2’s replacement.

Canonical intents (existing names): `write_as_is`, `fix_layout`, `fix_english`, `translate`, `preserve`, `unknown`, `user_override`.

---

## 8. Validation

Client: `validateAdvisorVote`.  
Server: `parseVote` in `hypothesisAdvisorProvider`.  
Background: schema check before returning a vote.  
Pipeline: if `session.getGeneration() !== generation` after the await, result is `stale` and the vote is dropped.

---

## 9. Policy interaction

Advisor ranking cannot override helpStyle, Translation Mode, field eligibility, editor tier, composition, cooldown, excluded sites, or `mixedLayoutSafety`. `shortcuts_only` never consults. Password fields fail `safetyAllowed` and never consult.

---

## 10. Write Gate interaction

`consultAdvisor` / the provider / the background handler never call `.value =`, `setRangeText`, `textContent =`, or `execCommand`.

Automatic mutation remains:

Decision → Policy (inside `decideWriting`) → `runWritingPipeline` Write Gate.

If apply mode is `shadow`, the pipeline still records `writing.shadow_compare` and uses the **baseline** decision for writes.

Default apply mode is `apply` so a validated rank can change the decision. Shadow compare always runs when the advisor was invoked.

---

## 11. Stale response protection

- Packet carries `generation`.
- `consultAdvisor` rejects `options.generation !== context.generation`.
- After the model returns, pipeline re-checks `session.getGeneration()`.
- Write Gate re-checks generation before acquire and before mutate (pre-existing).

A late rank for `نثغ` cannot apply after the field became `نثغ اليوم`.

---

## 12. Failure fallback

Network, timeout, entitlement denial, malformed JSON, unknown IDs, empty ranks, generation mismatch, or policy/mix veto:

- vote discarded
- `advisorResult` = `unavailable` | `invalid` | `stale`
- `decideWriting` without a vote (deterministic path)
- **never** an automatic write *because* the advisor failed

---

## 13. Privacy

- Sensitive protected kinds block the call entirely.
- Password / secret fields are not eligible (`evaluateFieldSafety`).
- Snippet is a short window; known secret tokens in-window are masked.
- Analytics: `writing.shadow_compare` / `writing.decision` reason codes only — no raw field text.

---

## 14. Performance

No extra local analysis on every keystroke beyond the existing pipeline.

Advisor work is gated by `shouldConsultAdvisor`. Generated holdout **invocation rate (holdout): 1.76%** (development 3.28%, validation 3.04%).

Latency of a real Groq call was **not measured in CI** (no live key in this phase). Local consult+decide on the holdout suite completed in ~1.2s for 2500 generated cases (no network).

---

## 15. Shadow mode

`setAdvisorApplyMode('shadow' | 'apply')`.

When the advisor runs, the pipeline always computes baseline vs advised and records `writing.shadow_compare` with `shadowOnly: true`. In `shadow` apply mode, writes follow baseline only.

Default remains `apply` so a *validated, policy-allowed* rank can affect the decision. Shadow-only shipping would be a one-line default flip after live eval.

---

## 16. Tests

`tests/unit/writing-engine/advisor-layer.test.ts` covers A–T:

A Arabic-keyboard English intent (no free-form replacement)  
B English-keyboard Arabic intent (mapLayout owns text)  
C mixed language  
D spelling vs layout  
E technical vs typo  
F Arabizi  
G proper name  
H punctuation  
I capitalization  
J code  
K URL  
L email  
M user override  
N stale generation  
O malformed output  
P unknown ID  
Q unavailable  
R policy veto  
S mixedLayoutSafety veto  
T protected / password field  

Plus: no consult on strong mechanical layout; snippet bounds; production register; source scan for DOM writes.

---

## 17. Generated test methodology

`tests/unit/writing-engine/advisor-holdout.eval.test.ts` (not imported by the app):

| Family | N | Expected |
| --- | --- | --- |
| Keyboard-layout transforms (unseen/in-lex EN↔AR sentences) | 1000 | `layout_fix` |
| Mixed Arabic frames + technical Latin | 500 | not `layout_fix` |
| Spelling vs remapped-token ambiguity | 500 | English abstain or scoped layout |
| Technical / symbol / URL-like | 500 | not `layout_fix` |

Split 50% / 25% / 25% (development / validation / holdout), seed `20260831`.

**CI cannot call Groq.** Evaluation uses:

1. **Baseline** — `decideWriting` with `advisorResult: 'unused'`.
2. **Heuristic advisor** — label-free ranker that follows the *prompt policy* (prefer preserve on mix/URL/code; else spelling; else safe layout). Applied **only when `shouldConsultAdvisor` is true**.
3. **Oracle** — gold-intent best matching local ID, also only when consult is true.

A prior run that **forced** oracle votes on every case (including unambiguous mechanical layout) dropped accuracy to **~50%** by turning unique-strong auto layout into suggestion. That is why strong mechanical layout is excluded from consult. That forced-oracle number is **not** the shipping metric.

---

## 18. Holdout results

Holdout N = **625**.

| Metric | Value |
| --- | --- |
| Baseline accuracy | **68.96%** |
| Heuristic advisor accuracy | **68.96%** |
| Oracle-on-consult accuracy | **68.96%** |
| Layout false positives | 0 → 0 |
| Layout false negatives | 194 → 194 |
| LLM invocation rate | **1.76%** |
| Mixed-language layout FP | 0 → 0 |

Development 66.16% / validation 67.84% / holdout 68.96% — same for baseline and advisor.

---

## 19. Baseline vs advisor comparison

On this generated holdout, **the advisor did not change decisions** when only invoked on real ambiguity. Invocation is rare; when it fires, the heuristic rank matched the deterministic outcome.

This is **not** a live-model win. It is: the wiring is safe and, with a prompt-shaped ranker, **not harmful**.

---

## 20. False positives

Layout FP on holdout: **0** baseline, **0** with advisor. Mixed-language FP: **0** / **0**. Advisor did not make mixed-language protection worse.

---

## 21. False negatives

Layout FN on holdout: **194 / 625** (31%). Unchanged with advisor.

Root cause is **local hypothesis generation**, not ranking:

- Remapped unseen English often looks like `arabic_prose` with `layoutSuspicion === 'none'`, so **no `fix_layout` hypothesis is emitted**. The advisor cannot rank an ID that does not exist.
- Isolated / short remaps stay `needsLLM` and do not auto-write (Foundation Safety). Correct, but they count as FN against a `layout_fix` gold label.

**The current hypothesis set is too weak for an LLM ranker to recover missed mechanical layout.** Say so.

---

## 22. Remaining limitations

- Real Groq ranking quality is **unknown** (no live holdout).
- Isolated wrong-layout tokens still miss.
- Advisor cannot create layout candidates the mapper/sequence engine did not propose.
- Default apply mode is `apply`; live traffic should be watched or flipped to `shadow` until Groq eval exists.
- No UI for suggestions vs advisor (by design this phase).
- Advisor shares `layout-classification` entitlement/quota (not a dedicated SKU).
- Chrome extension manual battery (15 scenarios) was **not** run in this session.

---

## 23. Known failure cases

- Unseen Arabic-looking remaps classified as prose: no layout hyp → advisor unused → FN.
- Always-on ranking of a weak layout ID **hurts** unique-strong auto-fix (measured ~50% when forced). Do not broaden consult.
- If Groq returns a mix-unsafe layout ID first, decide skips it; if that was the only write ID, result is noop (`mixed_intent_blocks_auto_layout`). Correct.
- Entitlement / network failure → deterministic fallback; user sees no “AI error write.”

---

## 24. Files changed

**Shared**

- `packages/shared/src/ai/hypothesisAdvisor.ts` — system prompt + caps
- `packages/shared/src/ai/models.ts` — `HYPOTHESIS_ADVISOR`
- `packages/shared/src/ai/index.ts` — export

**Backend**

- `backend/src/providers/hypothesisAdvisorProvider.ts`
- `backend/src/gateway/index.ts` — `hypothesisAdvisor`
- `backend/src/routes/http.ts` — `POST /api/ai/hypothesis-advisor`

**Extension**

- `extension/src/core/engine/advisor.ts` — consult, packet, mask, apply mode
- `extension/src/core/engine/hypothesisAdvisorClient.ts` — production `AdvisorFn`
- `extension/src/core/engine/decide.ts` — mix-unsafe skip in rank loop
- `extension/src/core/writeGate/pipeline.ts` — consult + shadow_compare
- `extension/src/content/startWritingRuntime.ts` — register
- `extension/src/background/rankHypotheses.ts`
- `extension/src/background/index.ts` — `RANK_HYPOTHESES`
- `extension/src/messaging/types.ts`, `validate.ts`
- `extension/src/core/engine/index.ts` — exports

**Tests / docs**

- `tests/unit/writing-engine/advisor-layer.test.ts`
- `tests/unit/writing-engine/advisor-holdout.eval.test.ts`
- `tests/unit/writing-engine/n1-enforce-init.test.ts` — reset advisor after runtime boot
- `docs/audit/LLM_HYPOTHESIS_ADVISOR_IMPLEMENTATION_REPORT.md`

No production dictionaries for `نثغ`, `ui ux`, `pull request`, `FastAPI`, `design engain`.

---

## 25. Recommended next phase

Do **not** start UI, personal learning, or translation redesign yet.

1. **Live Groq holdout** (shadow apply mode) on a labeled unseen set — measure real `ambiguityClass` quality and latency.
2. **Hypothesis generation** for remapped prose that currently looks like Arabic/English as-is — otherwise the advisor has nothing useful to rank (this is the FN bottleneck).
3. Keep `mixedLayoutSafety` as the auto-write veto.

---

## UI gap

No new cards, popup, or settings. Users will not see an “LLM is ranking” state. Ambiguous cycles still surface as existing suggestion / noop. If product later needs an explicit “why we hesitated” line, that is a later UI phase.

---

## Manual browser tests

**Not executed** in this session (no loaded Chrome extension pass). Required later with *new* unseen examples: Arabic/English/mixed fields, wrong-layout sentence and token, spelling/layout, technical tokens, URL, email, code, paste, composition, edit-after-response, stale, Translation Mode.

---

## Test commands run

```bash
cd extension && npm run test -- ../tests/unit/writing-engine/
cd extension && npm run test -- ../tests/unit/fieldSession.test.ts ../tests/unit/layout/
```

**Results:** writing-engine **13 files, 194 passed** (includes new advisor + holdout). fieldSession + layout suite **9 files, 99 passed**. foundation-safety **25/25**.

**Not run:** full monorepo, live Groq, Chrome E2E.

---

## Verdict

LLM ADVISOR:  
**REGISTERED**

LLM DIRECT WRITE:  
**NO**

PER-KEYSTROKE LLM:  
**NO**

POLICY GUARD:  
**PASS**

WRITE GATE:  
**PASS**

STALE PROTECTION:  
**PASS**

MIXED-LANGUAGE SAFETY:  
**PASS**

PRODUCTION PROVIDER:  
**PASS** (wired; CI uses mocks / no live Groq)

BASELINE ACCURACY:  
**68.96%** (holdout N=625)

ADVISOR ACCURACY:  
**68.96%** (heuristic + oracle-on-consult; live Groq **not measured**)

FALSE POSITIVE CHANGE:  
**0**

FALSE NEGATIVE CHANGE:  
**0**

LLM INVOCATION RATE:  
**1.76%** holdout (3.28% development, 3.04% validation)

HOLDOUT RESULT:  
**Tied with baseline. Did not improve. Did not regress mixed-language FP.**

GENERALIZATION:  
**NOT IMPROVED**

FINAL STATUS:  
**READY FOR NEXT PHASE**

Ready means: the advisor is a real, bounded, registered ranker with safety intact. It is **not** ready to be sold as an accuracy upgrade. Next work should strengthen local hypotheses and run a live shadow eval — not add UI or a second writer.
