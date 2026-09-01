# Gemini 3.5 Flash-Lite Full Live Shadow Evaluation Report

**DATE:** 2026-08-31  
**SCOPE:** Measure whether real Gemini `gemini-3.5-flash-lite` correctly ranks locally generated hypotheses on the frozen GPT-OSS holdout, with **≥200 valid ranks**.  
**SHADOW:** The LLM does not write. This phase did not enable apply, Gemini production, or fallback.  
**NOT IN SCOPE:** Groq changes, production `maxTokens`, prompt/packet/trigger changes, Hypothesis Generation V2, Decision Engine, Policy, Write Gate, voting, OpenRouter, live fallback.

This evaluation answers one question:

> Can Gemini `gemini-3.5-flash-lite` rank the locally generated hypotheses on the same frozen holdout used for GPT-OSS-20B?

**Answer from this phase:** **Yes, on the sampled slice.** The provider yielded **200 / 200 valid ranks** (then 10×3 stability). Ranking quality **may be judged for that slice**. The slice is **layout-family, gold=`layout_fix` only** because the frozen pool is traversed in corpus order. Other families were **not** ranked. Production Gemini remains **disabled**. Apply remains **off**.

---

## 1. Objective

Collect **≥200 valid Gemini ranks** on the frozen holdout, compare them to the local baseline, keep production shadow-only, and never treat provider errors as ranking mistakes.

Prior evidence (not re-litigated here):

| Fact | Source |
|---|---|
| Free Tier Gemini key can call `gemini-3.5-flash-lite` | single connectivity/contract probe (HTTP 200, valid advisor JSON) |
| Production Gemini flag | `GEMINI_ADVISOR_ENABLED=0` |
| Production fallback | `FLOWLARY_ADVISOR_FALLBACK_ENABLED=0` |
| Production Groq budget | `GROQ_ADVISOR_MAX_TOKENS` default **180** (unchanged) |

---

## 2. Production invariants

**Verified in source and local `backend/.env`. Not modified.**

| Invariant | Production value |
|---|---|
| Gemini advisor | **disabled** (`GEMINI_ADVISOR_ENABLED=0`) |
| Advisor fallback | **disabled** |
| Apply mode | **shadow / off** |
| Groq `maxTokens` | **180** |
| Prompt | existing `HYPOTHESIS_ADVISOR_SYSTEM_PROMPT` |
| Packet | existing slim `AdvisorPacket` (snippet ≤160, IDs only, no replacement) |
| Hypothesis Generation | V2 unchanged |
| Decision Engine / Policy / Write Gate | unchanged |
| `mixedLayoutSafety` | unchanged |
| LLM write | **forbidden** (IDs only) |

Eval harness enabled Gemini **in-memory only** (`evalConfig.geminiAdvisorEnabled = true`). File flags were not written.

---

## 3. Evaluation-only configuration

Used **only** by `tests/audit/evaluation/gemini-3.5-flash-lite-full-live.eval.test.ts` via `GeminiAdvisorProvider`:

| Setting | Eval harness | Production |
|---|---|---|
| model | `gemini-3.5-flash-lite` | same id, **disabled** |
| temperature | `0` | same |
| **maxOutputTokens** | **512** (`GEMINI_ADVISOR_MAX_TOKENS` default) | same default; Gemini still off |
| timeout / deadline | **20 s eval-only** | production advisor timeout **1500 ms** |
| prompt / packet | exact existing adapter + slim packet | same |
| Groq | **not called** | unchanged |
| fallback | **not tested** | off |

`20 s` is **not** a silent production timeout change. Production Groq `180` was not raised.

Expected vote:

```json
{
  "rankedHypothesisIds": ["h2", "h1"],
  "ambiguityClass": "...",
  "reasonCode": "..."
}
```

Rejected: unknown IDs, empty ranking, malformed JSON, `replacement` / `text` / `write`, invented hypotheses.

---

## 4. Dataset

Frozen generator: `tests/unit/writing-engine/gpt-oss-20b-shadow/generate.ts`.

**Not regenerated. Labels not modified. No holdout tuning.**

Same gold labels and split as the GPT-OSS full live evaluation.

---

## 5. Frozen seed

**20261107** (`GPT_OSS_SHADOW_SEED`).

---

## 6. Holdout size

| | N |
|---|---|
| Corpus | **5500** |
| Holdout | **1326** |
| Gold hypothesis exists (ranking pool) | **1185** |

---

## 7. Pacing strategy

Sequential Gemini `generateContent` only. No parallel requests. No Groq after Gemini failure.

| Rule | Value |
|---|---|
| Spacing after success | **8.0 s** (~7.5 RPM, under typical Free-tier 15 RPM) |
| 429 | Retry-After if present, else 30–120 s exponential; stop after **8** consecutive 429s |
| Resume | `tests/audit/evaluation/gemini-3.5-flash-lite-full-live-progress.json` |

**No 429 occurred.** No backoff path was used.

---

## 8. Valid ranks

| | Count |
|---|---|
| Target | **200** |
| **Valid Gemini ranks** | **200** |
| Ranking-phase attempts | **200** |
| Stability extra requests | **30** (10 packets × 3) |
| Total HTTP `generateContent` | **230** |

**Ranking evaluation: eligible** (valid n ≥ 200).

**Coverage caveat:** all 200 ranked cases are holdout **`family=layout`**, **`gold=layout_fix`**. Mixed / spelling / technical / punctuation / short were not reached in the first 200 pool members.

---

## 9. Provider reliability (A)

| Metric | Ranking phase (n=200 unique cases) | Including stability (n=230 HTTP) |
|---|---|---|
| Total attempts | **200** | **230** |
| Valid advisor contracts | **200** | **230 HTTP 200** (stability repeats not unique cases) |
| HTTP 200 | **200** | **230** |
| HTTP 400 | **0** | **0** |
| HTTP 401/403 | **0** | **0** |
| HTTP 5xx | **0** | **0** |
| 429 | **0** | **0** |
| Timeout | **0** | **0** |
| Invalid JSON | **0** | **0** |
| Invalid schema | **0** | **0** |
| Empty response | **0** | **0** |
| UNKNOWN_IDS | **0** | **0** |
| AUTH | **0** | **0** |

**Provider availability (ranking phase):** **200 / 200 = 100%.**

The harness `attempts` counter also includes 30 stability calls (`230`), which would understate availability if used as `200/230`. Those 30 are **repeat packets**, not ranking failures. **Do not mix them into ranking quality.**

Returned model on valid ranks: **`gemini-3.5-flash-lite`**.

Key fingerprint (value never printed): prefix `AQ.`, length 53, sha256-12 `602740ba2b13` (same Free-tier key as the connectivity probe).

---

## 10. JSON / contract reliability

| Metric | This phase |
|---|---|
| HTTP 200 + valid advisor schema | **200 / 200** ranking cases |
| Invalid response rate | **0%** |
| Forbidden write fields | **0** |

---

## 11. Gold hypothesis existence

Local-only holdout scan (no Gemini):

**1185 / 1326 = 89.37%**

Missing local gold (**141 / 1326**) is **local generation**, not an LLM ranking error. The live loop only sent packets when a gold hypothesis existed. Missing-local count during the live loop: **0** (pool pre-filtered).

---

## 12. Local baseline (full holdout)

Local `decideWriting` (advisor unused), same inspect path as GPT-OSS:

**1154 / 1326 = 87.03%**

| Family | n | Baseline OK | Gold hyp exists |
|---|---|---|---|
| layout | 495 | 446 | 495 |
| mixed | 252 | 252 | 252 |
| spelling | 238 | 120 | 123 |
| technical | 105 | 105 | 105 |
| punctuation | 124 | 119 | 98 |
| short | 112 | 112 | 112 |

| Metric | Value |
|---|---|
| Layout gold | 711 |
| Layout TP | 539 |
| Layout recall | **75.81%** (539/711) |
| Layout FP | **0** |
| Layout FN | **172** |
| Mixed-language layout FP | **0** |
| Protected layout FP | **0** |
| Abstention (preserve/unknown) | **495 / 495 = 100%** |
| Advisor invocation (`shouldConsultAdvisor`) | **16 / 1326 = 1.21%** |

---

## 13. Ranking quality (B) — valid ranks only

**N = 200.** All cases: family **layout**, gold **`layout_fix`**.

| Metric | Count | Rate |
|---|---|---|
| Top-1 (gold **intent** on rank-1) | **200 / 200** | **100%** |
| Top-2 (gold intent in top-2) | **200 / 200** | **100%** |
| Gold-selection (exact gold **ID**) | **182 / 200** | **91.0%** |
| Final advised action accuracy | **184 / 200** | **92.0%** |
| Local action accuracy on **same 200** | **184 / 200** | **92.0%** |

Top-1 uses **intent match**, same definition as the GPT-OSS harness. The 18 non-exact IDs still ranked a `fix_layout` hypothesis first.

### By family (valid ranks)

| Family | n | Top-1 | Top-2 | Advised OK | Local OK |
|---|---|---|---|---|---|
| layout | **200** | 200/200 | 200/200 | 184/200 | 184/200 |
| mixed | **0** | — | — | — | — |
| spelling | **0** | — | — | — | — |
| technical | **0** | — | — | — | — |
| punctuation | **0** | — | — | — | — |
| short | **0** | — | — | — | — |

Correct abstention / preserve: **not sampled** (no preserve/unknown gold in the 200).

The 16 advised-incorrect cases are **layout FN at Write Gate**: Gemini ranked `fix_layout` first; local baseline was `noop`; advised action became `suggestion`. Both fail gold `layout_fix` (needs `layout_fix`). **Policy / Write Gate**, not ranking, left auto-write off.

---

## 14. Help vs harm (same 200)

| Class | Count |
|---|---|
| Gemini **fixes** a locally incorrect decision | **0** |
| Gemini **breaks** a locally correct decision | **0** |
| Local and advised both correct | **184** |
| Local and advised both incorrect | **16** |
| Action string local ≠ advised | **16** (`noop` → `suggestion`; still not `layout_fix`) |

**Gemini ranking did not change action accuracy vs local on this slice (delta 0).**

---

## 15. Accuracy delta (D)

| Metric | Local | Gemini | Delta |
|---|---|---|---|
| Action accuracy, **same 200 cases** | **92.00%** (184/200) | **92.00%** (184/200) | **+0.00 pp** |
| Top-1 (intent) | — | **100%** (200/200) | — |
| Top-2 (intent) | — | **100%** (200/200) | — |
| Full-holdout baseline (advisor unused) | **87.03%** (1154/1326) | not a same-N compare | do not treat as Gemini delta |
| Layout FN (this slice) | 16 | 16 | 0 |
| Layout FP (this slice) | **0** | **0** | 0 |
| Mixed-language FP (this slice) | n/a (no mixed cases) | **0** advised `layout_fix` on mixed | — |

Full-holdout 87.03% must **not** be subtracted from 92% — the 200-case slice is easier (layout gold with a local hyp).

**Does Gemini help or harm?** On this layout-gold slice: **neither**, for **final action**. Ranking itself is **aligned with gold intent**. It does **not** recover the 16 Write Gate FNs.

---

## 16. Layout results (Gemini slice)

| Metric | Local (same 200) | Gemini-advised (same 200) |
|---|---|---|
| Layout gold | 200 | 200 |
| Layout TP | 184 | 184 |
| Layout FP | **0** | **0** |
| Layout FN | 16 | 16 |
| Recall | 92.0% | 92.0% |

Holdout-wide local layout FN remains **172 / 711** (unchanged; not all FN cases were in the first 200).

---

## 17. Mixed-language / technical / spelling / short / punctuation

**Not ranked** in this run (corpus-order pool). Local holdout mixed FP remains **0**. Gemini mixed auto-write on the ranked slice: **0** (no mixed packets sent).

Do **not** generalize 100% top-1 from layout-gold to mixed or spelling.

---

## 18. Safety (C)

| Check | Result |
|---|---|
| Unknown IDs | **0** |
| Invented IDs | **0** |
| `replacement` / `text` / `write` fields | **0** |
| Direct write (DOM / apply) | **NO** — apply off; harness never wrote |
| Mixed-language auto-write | **0** |
| Protected-content violations | **0** |
| Stale-response violations | **0** (votes not applied to a field cycle) |
| `mixedLayoutSafety` true on ranked top | **0** |

---

## 19. Latency (successful ranks only)

429 latency: **none**. Not mixed into generation latency.

| | ms |
|---|---|
| P50 | **940** |
| P95 | **1173** |
| Max | **4437** |

Product rule unchanged: **typing must never wait for the LLM.** Production advisor timeout remains 1500 ms; this eval used 20 s so ranking quality is not confounded with the product deadline.

Token usage on 200 valid ranks: input **92614**, output **12985**, total **105599**.

---

## 20. Ranking stability

After the 200 unique ranks, quota still allowed 10 representative **layout** packets × 3 at temperature 0.

| | |
|---|---|
| Compared | **10** |
| Identical top-1 **and** top-2 across 3 runs | **10 / 10** |
| **RANKING STABILITY** | **100%** (layout packets only) |

---

## 21. Privacy

Unchanged. Packets send snippet + hypothesis IDs / scores / evidence. **No replacement text.** API key was not logged (fingerprint only).

---

## 22. Missing hypothesis vs provider vs ranking

| Bucket | Count | Class |
|---|---|---|
| Gold hyp exists + valid Gemini rank | **200** | ranking measured |
| Gold hyp missing | **0** in live loop (141 on full holdout) | LOCAL GENERATION |
| Provider 429 / auth / 5xx / timeout | **0** | — |
| Invalid JSON / schema / unknown IDs | **0** | — |
| Ranked gold intent correctly | **200** | RANKING |
| Exact gold ID | **182** | RANKING (same intent, other ID) |
| Final action still FN | **16** | POLICY / WRITE GATE (not provider) |

These classes are **not mixed**.

---

## 23. Limitations

1. **Family coverage:** first 200 pool cases are all `layout` / `layout_fix`. Per-family ranking for mixed, spelling, technical, punctuation, and short is **unmeasured**.  
2. Final advised accuracy **equals** local accuracy on this slice; Gemini does not fix Write Gate layout FNs.  
3. Eval timeout 20 s ≠ production 1500 ms. Do not claim production latency headroom from P95 1173 ms alone (P95 is under 1500 ms; max 4437 ms would miss a 1500 ms product deadline).  
4. Stability packets were layout-only (only family with ranks).  
5. No live fallback / Groq coupling was tested.  
6. Chrome E2E typing was not required; safety is from contract validation + no apply.

---

## 24. Architecture recommendation

Keep:

- local-first analyze → Hypothesis Generation V2 → Decision Engine → Write Gate  
- Groq as production ranker still **shadow**, `maxTokens` **180**  
- **Gemini production disabled**  
- **no** fallback, voting, OpenRouter, or apply enablement from this phase

Gemini Free Tier **can sustain** ≥200 sequential advisor-contract calls on this key/window.

A later **stratified** holdout sample (explicit mixed / spelling / technical / punctuation / short) is required before any claim of general ranking quality. This phase **must not** enable production apply.

---

## 25. Files changed

- `tests/audit/evaluation/gemini-3.5-flash-lite-full-live.eval.test.ts` (eval-only harness; production flag assertions; local baseline; live Gemini loop gated by `FLOWLARY_GEMINI_FULL_LIVE`)
- `tests/audit/evaluation/gemini-full-live.vitest.config.ts`
- `tests/audit/evaluation/gemini-3.5-flash-lite-full-live-baseline.json`
- `tests/audit/evaluation/gemini-3.5-flash-lite-full-live-progress.json`
- `tests/audit/evaluation/gemini-3.5-flash-lite-full-live-results.json`
- `tests/unit/live-evaluation-gating.test.ts` (assert full-live flag gating)
- `docs/audit/GEMINI_3_5_FLASH_LITE_FULL_LIVE_SHADOW_EVALUATION_REPORT.md`

---

## 26. Files intentionally unchanged

Production `GEMINI_ADVISOR_ENABLED`, fallback, apply, Groq `maxTokens` **180**, advisor prompt, AdvisorPacket semantics, Hypothesis Generation V2, Decision Engine, Policy, Write Gate, frozen 5500 dataset, seed **20261107**, holdout labels. No OpenRouter, no voting, no routing change.

---

# FINAL VERDICT

GEMINI FULL LIVE SHADOW:  
VALID N ≥ 200 — ranking quality judged **on layout-gold slice only**

MODEL:  
gemini-3.5-flash-lite

VALID RANKS:  
200

TARGET:  
200

TOP-1:  
200/200 = 100% (gold intent)

TOP-2:  
200/200 = 100%

FINAL ADVISED ACCURACY:  
184/200 = 92.00%

LOCAL BASELINE:  
184/200 = 92.00% (same slice); 1154/1326 = 87.03% (full holdout)

ACCURACY DELTA:  
+0.00 pp (same 200)

PROVIDER AVAILABILITY:  
200/200 = 100% (ranking phase); HTTP 230/230 = 200 including stability repeats

429 RATE:  
0%

INVALID RESPONSE RATE:  
0%

LATENCY P50:  
940 ms

LATENCY P95:  
1173 ms

RANKING STABILITY:  
10/10 identical top-1/top-2 (layout packets)

LAYOUT FP:  
0

LAYOUT FN:  
16 (same as local on this slice); 172 holdout-wide local

MIXED-LANGUAGE FP:  
unmeasured in Gemini ranks (0 mixed packets); 0 local holdout

PROTECTED VIOLATIONS:  
0

STALE VIOLATIONS:  
0

DIRECT WRITE:  
NO

GENERALIZATION:  
LIMITED — layout-gold only

REAL-WORLD READINESS:  
NOT READY to enable production Gemini / fallback / apply

VERDICT:  
PASS contract + layout-gold ranking (n=200); INCOMPLETE other families

RECOMMENDATION:  
Keep `GEMINI_ADVISOR_ENABLED=false`, fallback off, apply off. Do not enable production from this evaluation. Optional later work: stratified family sample — not this phase.
