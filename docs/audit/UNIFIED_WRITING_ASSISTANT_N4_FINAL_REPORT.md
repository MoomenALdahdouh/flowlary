# UNIFIED WRITING ASSISTANT — N4 FINAL REPORT

Date: 2026-08-31  
Scope: N4 only (N1–N3 assumed complete).  
This report does not claim Chrome-extension browser acceptance. Those cases were not executed in this environment.

---

## 1. N4 implementation summary

N4 finished the remaining core gaps so mixed text is analyzed as **chunks**, decisions are **scoped**, and the existing pipeline stays:

USER → OBSERVE → SHARED ANALYSIS → ONE DECISION → ONE WRITE GATE → COOLDOWN → ANALYTICS

Implemented without a new classifier, writer, translation stack, or orchestration layer.

| Area | What landed |
| --- | --- |
| Mixed chunks | `analyzeFieldText` roles: Arabic prose, English prose, technical / intentional Latin, layout suspicion, protected kinds. Layout spans come from `inferLayoutSpans`. |
| Scoped decisions | Hypotheses carry a span. Layout/English winners use that span, not the whole field. |
| Protected terms | Structural detectors + a small seed of common product words (`api`, `deploy`, `error`, …) via `isTechnicalToken` / `isStructuralTechnicalToken`. Not a closed product dictionary. |
| Translation preserve | `planPreservedTranslation` wraps keep-tokens as `⟦pN⟧`, restores after the existing translate call, fails closed on `preserve_lost`. |
| Layout vs English | Layout hypotheses block English. Isolated `hwo` must not auto-write `how`. |
| Mixed English | Auto-English only if the spelling span sits on English-only non-technical chunks. |
| Origin | `translated_en`, `corrected_en`, prune on user replace. |
| Analytics | `writing.decision` / `writing.write` — action, trigger, origin, outcome. No raw text. |
| Chip / i18n | Field-scoped Pause/Resume. Arabic `assistant` catalog no longer overwrites itself (duplicate key merged). |

---

## 2. Mixed-language behavior

The field is no longer one language vote.

Examples:

| Input | Analysis (intended) | Automatic write |
| --- | --- | --- |
| `أنا عملت deploy لكن فيه error` | Arabic prose + technical/intentional Latin | No whole-sentence English rewrite. No translation unless Translation Mode is on. |
| `أرسل لي الـ API key اليوم` | Arabic + preserved `API` / `key` | Translation Mode: translate Arabic, keep technical tokens. |
| `Send me the الـ API key today` | Mixed Latin + Arabic article | Chunked; not “translate everything” / “fix every English token”. |

`hasAmbiguousMixed` is evidence for policy, not a trigger to rewrite the field.

---

## 3. Decision Engine behavior

`decideWriting` still picks **one** action per cycle.

Priority that matters for N4:

1. Safety / composing / mutex / cooldown / unsupported editor → `noop`
2. User override on a span → block colliding writers
3. Strong unique **layout** (low risk, no LLM, no mixed-intent conflict) → `layout_fix`, English and translation blocked
4. Short / mixed-intent layout → `noop` or suggestion, not blob rewrite
5. **Translation** only with an explicit session + Translation Mode; high-risk mixed Latin → `mixed_spans_no_blob_translate`
6. **English** local spelling: mixed fields require an English-only scoped span; Arabizi and strong overlapping layout block English
7. Remote English → suggestion only, never auto-write of LLM text
8. Otherwise preserve / no unambiguous winner

Representative traces (jsdom / Decision Engine, not Chrome):

| Input | Mode | Evidence | Candidate | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| `أريد إرسال هذا البريد غدًا.` | Normal | Arabic prose | none / preserve | `noop` | No translation session |
| Same | Translation ON | Arabic + session | translate | `translation` | Explicit session |
| `نثغ` | Normal | Isolated remap | `fix_layout` | layout **or** abstain if short/high risk | Layout before English; short tokens protected |
| `I dont know.` | Normal auto | Known typo | `fix_english` | `english_correction` | Clear English sentence |
| `أنا عملت deploy لكن فيه error` | Normal | Mixed + technical | English rewrite | `noop` | Not English-only span |
| `hwo` | Normal | Weak/ambiguous vs layout | `how` vs layout | **not** `how` auto-write | English must not blindly win |
| `أنا كتبت I dont know اليوم` | Normal | Mixed + scoped typo | `don't` | scoped English **or** noop | Never blob-English |
| Short Arabic token in Arabic | Normal | Script + neighbors | layout | usually `noop` / as-is | Context, not length alone |

This is **not** “Arabic → translate, English → correct.”

---

## 4. LLM usage

No new LLM system.

| Capability | When an API/LLM runs | Local without LLM |
| --- | --- | --- |
| Layout | Never | Physical remap + sequence + lexicons |
| Instant English | Never | `COMMON_TYPOS` / `applyInstantSpellingIfSafe` |
| Translation | After a **translation** decision, via existing `requestTranslationRemote` | Session / pause / segment / preserve placeholders |
| Remote English | After a **suggestion** path (`scheduleRemoteEnglishAssist`), IntelligentDebouncer, sentence/stability — **not** every keystroke | Instant spell |
| Advisor | Only `shouldConsultAdvisor`: ≥2 hypotheses, `needsLLM`, and conflict or ≥2 LLM hyps. Strong unique layout skips advisor. Ranks only; cannot invent replacements | — |

Failures: fail-safe analytics (`failed` / `noop` / `stale`). Stale: generation check + abort. Advisor `unavailable` / `invalid` → noop, no write.

---

## 5. Write Gate verification

Page-field mutation still goes through `commitWriteTransaction`.

- Pipeline auto layout / local English → Write Gate + cooldown + system origin
- Translation fulfill → same gate after preserve restore
- Shortcuts / Speed Box (N1): still `writerForAction` / gate — N4 did not add a bypass
- Password / OTP / excluded / `autoWrite: false` → no gate write

---

## 6. Translation verification

- Session created only when Translation Mode is on **and** the field is not paused
- Mode off → `endTranslationSession`; no new translation
- Mixed: preserve plan keeps technical/intentional Latin; restore abort if tokens vanish
- Chip: Pause/Resume **this field**; hidden when global Translation Mode is off
- Per-field pause does not copy to another `FieldSession`

---

## 7. English verification

- Mixed sentence is not rewritten as English
- Technical / intentional / Arabizi / layout-suspicion chunks are skipped for spelling hyps
- Remote English is suggestion-only and not scheduled on mixed/layout/Arabizi
- `I dont know.` still auto-applies `I don't know.`
- Isolated `hwo` must not become `how`

---

## 8. Layout verification

- `inferLayoutSpans` votes per token; Arabic-script tokens stay `as_is` unless they remap to a real English/technical word and are not Arabic lexicon words
- Role assignment: Arabic lexicon / short Arabic that does not map to English → `arabic_prose` before `possible_layout_error`
- Technical tokens classified before layout roles (`deploy` / `error` stay technical, not layout)
- Winner range is the mismatched span (`hello hsjo]lj world` must not replace the whole string when layout wins)

Calibration remains the sharpest remaining risk: true Arabic prose vs isolated wrong-keyboard Arabic (`نثغ`). Unit tests currently pass; this is the first thing to watch in dogfood.

---

## 9. Field / session behavior

| Concern | Behavior |
| --- | --- |
| Generation | Cycle records generation; mismatch → `stale`, no write |
| Cooldown | After system write (~450ms); next cycle `noop` |
| Origin tags | Translated / corrected ranges; prune when text no longer matches |
| User override | Detected on edit of generated output |
| Multi-field | Independent session objects (pause, cooldown, generation, suggestion) |
| Contenteditable | `autoWrite` false, editor tier > 1 → Decision Engine `unsupported_editor` |
| System vs user write | `engineOriginated` / write-origin wrapper; input from own mutation is not a fresh user cycle |

---

## 10. Analytics

Events: `writing.decision`, `writing.write`, plus suggestion/shadow names.

Recorded: `action`, `trigger`, `textOrigin`, `outcome`, reason codes, risk, optional `llmUsed` / `llmResult`. **No raw user text.**

Analytics are fire-and-forget; they do not sit on the write mutex.

---

## 11. UI / UX consistency

Product model in copy (EN + AR):

- One assistant
- Three capabilities: Fix typing / English assist / Arabic → English
- Operating states: Normal / Translation / Manual
- Help styles: Automatic / Suggestions / Shortcuts only

N4 UI changes (correctness only):

- Translation chip strings: Pause/Resume translation **here** (field-scoped)
- Arabic popup: merged duplicate `assistant` keys so capability labels were not dropped

No popup/onboarding/dashboard redesign. Legacy feature names still exist in older settings copy; they now describe the same three capabilities.

---

## 12. Browser test results

**Not executed.**

This session had no loaded Chrome extension, no ability to attach to a real tab, and no click/type loop against the packaged extension.

Do not treat the table below as a pass. It is the **intended** matrix and the **jsdom** substitute only.

| # | Case | Browser | jsdom / unit substitute | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Normal Arabic | not run | N2: no translate without session | **UNVERIFIED in browser** |
| 2 | Wrong keyboard | not run | layout hyps / generalization tests | **UNVERIFIED in browser** |
| 3 | Short Arabic token | not run | short-token + lexicon guards | **UNVERIFIED in browser** |
| 4 | Mixed AR/EN | not run | N4 mixed chunk + no blob English | **UNVERIFIED in browser** |
| 5 | English correction | not run | `I dont know.` → applied | **UNVERIFIED in browser** |
| 6 | Translation mode | not run | N2/N4 pipeline with mock provider | **UNVERIFIED in browser** |
| 7 | Translation pause | not run | FieldSession pause | **UNVERIFIED in browser** |
| 8 | Translation resume | not run | FieldSession resume | **UNVERIFIED in browser** |
| 9 | Translation OFF | not run | `endTranslationSession` | **UNVERIFIED in browser** |
| 10 | Layout vs English (`hwo`) | not run | must not write `how` | **UNVERIFIED in browser** |
| 11 | Manual / shortcuts only | not run | N1 helpStyle | **UNVERIFIED in browser** |
| 12 | Password / OTP | not run | password cycle stays `noop` | **UNVERIFIED in browser** |
| 13 | Excluded site | not run | existing safety (not re-proved here) | **UNVERIFIED in browser** |
| 14 | Multiple fields | not run | two sessions, pause isolation | **UNVERIFIED in browser** |
| 15 | System-write loop | not run | cooldown second cycle `noop` | **UNVERIFIED in browser** |

Chrome extension acceptance: **not claimed**.

---

## 13. Unit / integration test results

Command (N4-relevant clusters):

```text
vitest run writing-engine/ layout/ translation/ instantSpell fieldSession mixedLanguage i18n
```

| | Count |
| --- | --- |
| Files | 24 |
| **Passed** | **288** |
| Failed | 0 |
| Skipped | 0 |

Notable N-wave files in that run: N1 8, N2 22, N3 18, N4 17, hypothesis layer 30, foundation-safety 25.

During implementation the golden intent set **flickered** (concurrent edits to `golden-intent-cases.ts` flipping `hasRole` between `technical_token`, `arabic_prose`, and `english_prose` on the same mix lines). The final cluster above was green. Treat golden role labels as slightly unstable if that file keeps changing.

No Playwright / extension-in-Chrome suite was run.

---

## 14. Remaining bugs

1. **Layout ↔ Arabic prose calibration** is still the highest-risk local bug. Over-eager remaps historically turned real Arabic into English keyboard soup; over-tight guards drop isolated `نثغ`. Current rules try to allow remap only when the mapped form is a real English/technical word.
2. **`hwo`**: unit tests prove English does not auto-win. They do **not** prove a correct layout remap in a real page.
3. **Golden mix role labels** can disagree with N4 (`chrome` as `technical_token` vs a golden `english_prose` expectation) if that file is edited again.
4. **Preserve + mock translate**: mixed translation tests can keep `API`/`key` even if Arabic is poorly translated, because those tokens never leave the string.
5. **Advisor unused** when no advisor function is installed: conflict + `needsLLM` can noop. Safe, but some mixed cases will do nothing until a human shortcut.

---

## 15. Remaining product gaps

- Real-page Chrome validation of the 15-case matrix
- How the chip feels on scroll / RTL / tiny inputs
- Whether leftover settings still read like “three tools” to a new user
- Translation quality of mixed Arabic + jargon (provider-dependent; we only preserve tokens)
- Contenteditable remains suggestion/shortcut — by design
- No claim that every short token in the wild is classified correctly

---

## 16. Final architecture status

| # | Invariant | Status |
| --- | --- | --- |
| 1 | One observation path | **Held** (pipeline `runFieldCycle`) |
| 2 | One decision per cycle | **Held** (`decideWriting`) |
| 3 | One Write Gate | **Held** |
| 4 | No competing automatic writers | **Held** in enforce path (legacy schedulers stayed off after N1) |
| 5 | Translation only from explicit session | **Held** |
| 6 | Layout before English when layout suspected | **Held** in Decision Engine |
| 7 | Short / ambiguous tokens protected | **Held** with context, not length-only |
| 8 | Mixed text handled by chunks | **Held** |
| 9 | Translated output tagged | **Held** (`translated_en` + ranges) |
| 10 | Cooldown after system write | **Held** |
| 11 | Stale async discarded | **Held** (generation + translation/English tickets) |
| 12 | System writes distinguishable | **Held** |
| 13 | Password / sensitive protected | **Held** (unit) |
| 14 | Excluded sites | **Not re-validated in N4 browser**; prior safety unchanged |
| 15 | Shortcuts cannot bypass Write Gate | **Held** (N1; not regress-tested in Chrome) |
| 16 | Speed Box cannot bypass Write Gate | **Held** (N1 unit) |
| 17 | Analytics contain no raw text | **Held** |
| 18 | UI does not contradict unified model | **Mostly held**; small i18n/chip fixes only |

---

## FINAL VERDICT

**PARTIALLY READY**

The unified pipeline, chunked mixed language, Write Gate, origin tags, and analytics are implemented and pass the relevant unit/integration cluster (288/288 in the N4-relevant run).

The verdict is **not READY** and not **READY FOR DOGFOODING** as a Chrome-proven release: **N4.10 browser acceptance was not run**. Per the N4 brief, runtime in the real extension is required to promote further. Unit green is not a substitute.

---

## WHAT THE USER CAN DO NOW

In a supported text field (typical `<textarea>` / text input), Flowlary acts as **one** assistant:

- **Normal:** may fix a wrong-keyboard **segment**, and may fix a **clear English typo** in English (or in a clearly English chunk). It will not translate Arabic just because the text is Arabic.
- **Translation Mode:** Arabic in that field can become English after a decision + remote translate. Technical bits like `API` / `deploy` are meant to stay. A chip on the **current field** pauses or resumes translation there only.
- **Manual / shortcuts only:** no automatic page rewrite.
- Mixed lines like “عملت deploy” should stay mixed — not become a full English sentence and not have `deploy` “corrected” away.
- Passwords and unsupported editors should not be auto-rewritten.

That is the **designed** experience. It has been exercised in jsdom, not clicked in Chrome in this session.

---

## WHAT STILL DOES NOT WORK

- Chrome-extension acceptance of the 15-case matrix is **unknown**
- Isolated layout tokens vs real Arabic can still be wrong at the edges
- Isolated `hwo` is protected from becoming `how`; it may also do nothing
- Contenteditable is not full auto-write
- Remote English never auto-commits
- Mixed translation quality depends on the existing provider plus placeholders
- Advisor is optional; conflicts without a local winner stay noop

---

## NEXT RECOMMENDATION

Do **not** add another engine, classifier, or writer.

1. Load the real extension in Chrome.
2. Walk the 15-case matrix on two sites and two fields.
3. Dogfood mixed Arabic + jargon for a few days.
4. File bugs against layout false positives and chip/field isolation.

Only then consider promoting the verdict.
