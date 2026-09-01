# WL-4C — Learning Feedback + Rule Explanation Forensic Audit

**Date:** 2026-08-27  
**Mode:** FORENSIC AUDIT ONLY — no production code modified  
**Baseline:** WL-4B complete (`docs/audit/WL4B_ERROR_SPECIFIC_PRACTICE_IMPLEMENTATION.md`)

---

## Executive Summary

Flowlary **can safely provide simple, multilingual explanations of what was corrected** at the **token/pair level** (e.g. "You wrote `recieved`; the correct spelling is `received`"). It **cannot today safely name specific grammatical rules** (e.g. "Subject–Verb Agreement") from existing correction data alone.

**Critical finding:** The Groq correction pipeline returns only `type`, `original`, `corrected`, `start`, `end`. There is **no rule ID, no confidence, no explanation, no subtype**. `category: grammar` does **not** imply a identifiable rule.

**Recommended architecture:** **Hybrid Option D + B**
1. Deterministic **pair-level** explanation (always safe)
2. **Trusted Rule Library** + deterministic resolver for high-confidence named rules only
3. Groq **only on explicit user click**, only to **localize/personalize trusted content** — never to invent rules
4. Low confidence → "Why this was corrected" without naming a rule

**Additional Groq on correction open:** **None** (mandatory). Explanation is click-gated.

---

## Primary Product Question

**Can Flowlary show an Arabic explanation for an English error with English examples?**

**Partially ready.** UI locale (`readUiLocale` / 12 locales including `ar`) can control explanation language. Learning language is profile-locked to English (`learningLanguage: 'en'`). English examples can remain English while explanation text uses UI locale via deterministic templates or cached translations.

**Not ready:** Named rule titles like "Subject–Verb Agreement" in Arabic without a **Trusted Rule Library** + localization layer.

---

## Git Baseline

| Field | Value |
|-------|-------|
| Branch | `main` |
| Commit | `61f349827f111231dd8ebdac1c557478dcb10cb8` |
| Production files modified | **0** |

---

## Current Correction Pipeline

```
USER INPUT (content script field / dashboard textarea)
    ↓
CorrectionFeature / ComposeWorkbench / PracticePanel
    ↓
extractWritingContext() — segment up to 2000 chars
    ↓
requestCorrectionRemote() → CORRECT_TEXT
    ↓
handleCorrectText() — entitlement, cache, accountSnapshot
    ↓
backend POST /api/ai/correction
    ↓
runCorrectionProvider() → callGroqChat(CORRECTION_SYSTEM_PROMPT)
    ↓
validateCorrectionResponse() — coerce types, validate offsets
    ↓
CorrectionResponse { originalText, correctedText, changes[] }
    ↓
CorrectionCard.show() — diff highlight (content script)
    ↓
applyCorrection / accept / reject
    ↓
recordCorrectionDetected/Accepted/Rejected()
    ↓
LearningEvent (per change)
    ↓
recordHistory() — optional CORRECT entry (full source/result text)
    ↓
Progress / recurring patterns / Practice recommendation
```

### CorrectionChange (actual)

**FILE:** `packages/shared/src/correction/index.ts`

| Field | Present | Notes |
|-------|---------|-------|
| `type` | ✅ | `spelling \| grammar \| wording \| layout` |
| `original` | ✅ | Token/phrase as corrected |
| `corrected` | ✅ | Suggestion |
| `start`, `end` | ✅ | Offsets in `originalText` |
| ruleId | ❌ | |
| confidence | ❌ | |
| explanation | ❌ | |
| subtype | ❌ | |

### Groq system prompt (actual)

**FILE:** `CORRECTION_SYSTEM_PROMPT` in `packages/shared/src/correction/index.ts`

Instructs: return JSON with `originalText`, `correctedText`, `changes[]` where each change has `type`, `original`, `corrected`, `start`, `end`. Types: **spelling, grammar, wording only** (layout not in prompt).

`TYPE_MAP` collapses: `punctuation→grammar`, `typo→spelling`, `style→wording`. Unknown → `grammar`.

---

## Current Learning Pipeline

```
CorrectionChange.type → LearningEvent.category
CorrectionChange.original/corrected → LearningEvent.original/corrected
normalizeLearningText() → normalizedOriginal / normalizedCorrected
batchId → ties detected/accepted/rejected
sampleText (input) → used at write time only → sampleHash persisted
sampleWordCount → persisted
source → writing | practice
```

**LearningEvent does NOT persist:**
- Full sentence (`sampleText` discarded after hash)
- Change offsets
- Rule identity
- Explanation metadata

**FILE:** `extension/src/storage/learning/events/index.ts` lines 216–230

---

## Taxonomy Audit

| Category | Subtypes in code | Evidence source | Reliable for rule resolution? |
|----------|------------------|-----------------|-------------------------------|
| **spelling** | None (flat) | Groq `type` + original/corrected pair | **Pair-level YES**; named spelling rule **NO** |
| **grammar** | None (flat); punctuation mapped here | Groq `type` only | **Category only** — rule **NOT reliable** |
| **wording** | None (flat); style mapped here | Groq `type` + pair | **Pair-level YES**; abstract rule **NO** |
| **layout** | None | Manual FIX_LAYOUT only (`recordLayoutLearning.ts`) | **Keyboard mapping**, not English grammar — **separate product** |

**No subtypes exist anywhere in shared types, Learning, Practice, or Progress.**

---

## Correction Evidence Audit

### What survives after correction

| Location | original | corrected | category | full sentence | offsets | rule |
|----------|----------|-----------|----------|---------------|---------|------|
| In-memory `CorrectionSuggestionBinding` | ✅ | ✅ | ✅ | ✅ segment + full text | ✅ in response | ❌ |
| LearningEvent (persisted) | ✅ | ✅ | ✅ | ❌ (hash only) | ❌ | ❌ |
| History CORRECT entry | ✅ sourceText | ✅ resultText | ❌ per-change | ✅ whole field | ❌ | ❌ |
| Practice session (in-memory) | ✅ during session | ✅ | ✅ via correction | ✅ textarea | ❌ | ❌ |
| Groq cache | ✅ text keyed | ✅ response | ✅ | ✅ segment | ✅ | ❌ |

**Critical:** Retrospective explanation from Progress/Learning **cannot reconstruct sentence context** — only token pair + category.

---

## Rule Identification Feasibility

| Category | Exact rule identifiable? | Confidence | Why |
|----------|--------------------------|------------|-----|
| **Spelling** | Pair only, not abstract rule | **HIGH** for pair; **LOW** for rule name | Data is lexical pair; "i before e" not inferable |
| **Grammar** | **Generally NO** from category alone | **LOW** | Groq returns `grammar` only; same label covers SV agreement, tense, articles, prepositions, etc. |
| **Wording** | Lexical substitution only | **MEDIUM** for pair; **LOW** for rule name | "make→take" is word choice, not a named rule |
| **Layout** | Keyboard/layout mapping | **HIGH** for layout fix | Not English Practice; separate input-learning domain |

### Example: "He go" → "He goes"

| Available | Value |
|-----------|-------|
| category | `grammar` |
| original | `go` (or span from offsets) |
| corrected | `goes` |
| Rule inferable? | **Maybe** SV agreement — **not proven by data** |
| Safe to label "Subject–Verb Agreement"? | **NO** without resolver + confidence gate |

---

## Category vs Grammatical Rule

```
ERROR CATEGORY (always from Groq type)
        ≠
GRAMMATICAL RULE (not in system)
```

**Ambiguous cases (category known, rule unknown):**
- `grammar`: tense, agreement, article, preposition, word order, auxiliary — all collapse to one label
- Short tokens (`go`, `a`, `to`) — many grammatical functions
- Multi-word changes — could be several rules
- Groq `wording` vs `grammar` boundary is model-dependent

---

## Normalized Original Analysis

**FILE:** `normalizeLearningText()` — `packages/shared/src/learningEvents.ts`

```typescript
text.trim().replace(/\s+/g, ' ').toLowerCase()
```

| Property | Value |
|----------|-------|
| Level | **Token or phrase** (lexical) |
| Semantic | **No** stemming, no POS, no syntax |
| Clustering | **No** — `"alot"` and `"a lot"` stay distinct unless written that way |

**Can normalizedOriginal alone identify a rule?** **NO** for grammar. **Partially** for spelling/wording as a **recurrence key**, not a rule name.

---

## Context Availability

### At correction time (in-memory) — **AVAILABLE**

**FILE:** `CorrectionSuggestionBinding` — `extension/src/features/correction/ui/types.ts`

- `segment`, `requestedFullText`, `response.originalText`, `response.correctedText`
- `changes[].start/end` — can extract surrounding sentence from `originalText`

### After persistence — **LIMITED**

- LearningEvent: pair only
- History: full texts but not linked to individual changes by ID
- No `batchId → history entry` join today

**Gap:** Explaining from Progress recurring patterns alone lacks sentence context unless user re-opens original writing or History is correlated.

---

## User Text Privacy

| Store | Raw user text | Sent to Groq today |
|-------|---------------|-------------------|
| Correction request | Segment (~2000 chars max) | ✅ (correction API) |
| LearningEvent | original/corrected tokens only | ❌ |
| History | sourceText, resultText (privacy-gated) | ❌ |
| Practice session | In-memory only; not persisted raw | ✅ when checking |
| Cache | Correction segment (account-scoped key) | N/A |
| Logs | Usage metadata per DATA_FLOW.md | Not full text server-side |

**Minimum for explanation click:** Selected change + local sentence slice (~±80 chars around offset) + category + pair. **Do not send** full LearningEvent history or dashboard state.

---

## Rule Resolver Options

| Option | Verdict |
|--------|---------|
| **A. Groq detects rule** | **NOT RECOMMENDED** — hallucination risk, cost, violates accuracy requirement |
| **B. Deterministic resolver + Groq explains** | **RECOMMENDED (partial)** — resolver assigns ruleId or `uncertain` |
| **C. Trusted library + Groq personalizes** | **RECOMMENDED** — AI transforms trusted content only |
| **D. No rule for ambiguous** | **REQUIRED** — pair-level fallback always available |

**Recommended:** **B + C + D hybrid**

---

## Trusted Rule Library

**Status:** **REQUIRED** for named rules (e.g. "Subject–Verb Agreement")

Proposed structure (not implemented):

```
ruleId, category, nameKey, shortExplanationKey, examples[], visualType, visualData, supportedLocales[], ruleVersion
```

| Content | Local | AI |
|---------|-------|-----|
| Rule identity | ✅ Trusted library | ❌ Never invent |
| Rule definition | ✅ Canonical EN + i18n templates | Optional localize |
| Examples | ✅ Curated | ❌ |
| Visuals | ✅ Constrained schema | ❌ No AI SVG/HTML |

**Instant spell map** (`instantSpell.ts`) is a seed for **pair→explanation** links, not full rules.

---

## AI Role Recommendation

**Safest role for Groq:**

> Transform **trusted** rule content into the user's **UI locale**, on **explicit click**, with **schema validation** — never authority to define rule identity.

Groq must **NOT** receive authority to:
- Redefine the rule
- Diagnose unrelated skills
- Invent CEFR level
- Claim mastery

---

## Groq Cost Analysis

| Action | Local | Groq | Cacheable | Notes |
|--------|-------|------|-----------|-------|
| Correction (existing) | cache hit: 0 | 1 credit | ✅ account-scoped | Unchanged |
| Rule resolution | ✅ deterministic | ❌ V1 | ✅ | |
| Pair explanation | ✅ templates | ❌ | ✅ cross-user for generic pairs | |
| Named rule explanation | ✅ library | optional 1 on click | ✅ ruleId+locale | |
| AI personalization | ❌ | 1 on click | ✅ | Pro optional |
| Visualization render | ✅ React | ❌ | ✅ | |
| Practice from explanation | 0 extra | uses existing practice check | — | |

**Preferred:** Explanation Groq call **only on `[Explain this]` click**, never on correction render.

**Current architecture:** No automatic explanation trigger exists ✅

---

## Multilingual Architecture

### Source of truth for explanation language

| Setting | Location | Purpose |
|---------|----------|---------|
| **UI locale** | `STORAGE_KEYS.uiLocale` / `readUiLocale()` | Dashboard/popup i18n — **12 locales** |
| **Learning language** | `LearningProfile.learningLanguage` | Locked to `en` in V1 |
| **Native language** | `LearningProfile.nativeLanguage?` | Optional onboarding field |

**Recommendation:** **UI locale** controls explanation language (matches user spec: Arabic UI → Arabic explanation). English examples stay English (learning language).

**NOT** CEFR level — `LearningProfile.level` exists but must not be used for explanation claims in WL-4C.

### Multilingual options comparison

| Option | Accuracy | Cost | Maintenance |
|--------|----------|------|-------------|
| A. All locales in library | Highest | High upfront | High |
| B. EN canonical + Groq translate | Medium | Per-locale Groq | Medium |
| **C. Canonical + i18n templates** | **High** | **Low** | **Medium** |
| D. Hybrid C + optional Groq polish | High | Low–medium | Medium |

**Recommend:** **Option C** for V1; optional Groq polish for Pro.

---

## Explanation Contract (Proposed)

```typescript
type ExplanationConfidence = 'high' | 'medium' | 'low' | 'uncertain'

type RuleExplanation = {
  confidence: ExplanationConfidence
  ruleId?: string              // only when high + library match
  ruleTitle?: string           // localized
  summary: string              // localized
  why?: string                 // localized
  incorrectExample: string     // English
  correctExample: string       // English
  visual?: { type: 'comparison' | 'tree' | 'flow'; data: unknown }
  practiceTargetId?: string    // category:normalizedOriginal
}
```

**Low confidence:** Omit `ruleId`/`ruleTitle`; summary = "This wording/spelling/grammar was corrected" + show pair.

---

## Visual Explanation Architecture

**Recommend constrained schema** — **NOT AI-generated HTML/SVG**

| visualType | Safe? | Renderer |
|------------|-------|----------|
| `comparison` | ✅ | React — ❌/✅ pair display |
| `tree` | ✅ | React from nodes/edges JSON |
| `flow` | ✅ | React step list |

**Do NOT:** Groq-generated executable HTML, markdown injection, raw SVG strings from AI.

---

## Split UI Architecture

| Surface | Split panel feasible? | Recommendation |
|---------|----------------------|----------------|
| **Dashboard** | ✅ | Two-column in main content (`fl-dash` grid has sidebar + main) |
| **ComposeWorkbench** | ✅ | Natural first host for Explain |
| **PracticePanel** | ⚠️ | Inline drawer below prompt |
| **Content script CorrectionCard** | ❌ | Shadow DOM, max-height 120px, anchored to field — **drawer/modal overlay** |
| **Popup** | ❌ | 360–400px — **full-width drawer or navigate to dashboard** |

**Least invasive V1:** Dashboard ComposeWorkbench + Practice drawer; content script uses bottom sheet overlay.

**No `[Explain this]` exists today** — verified by repo search.

---

## Practice Integration

**WL-4B provides:** `practiceTargetPatternId` = `{category}:{normalizedOriginal}`

**Sufficient for `[Practice this rule]`** when:
- category ∈ spelling/grammar/wording
- pattern count ≥ 2 (WL-4B eligibility)
- Not layout

**Flow:**
```
Explanation.practiceTargetId
  → navigate to Practice
  → selectPracticeSessionTarget() with matching category/pattern
```

No additional metadata required for V1.

---

## Account Isolation

WL-4A guards reusable:
- `activeAccountContext.snapshot()` + `matches()` on in-flight explain request
- Account-scoped cache for personalized explanations
- Generic rule explanations: cache key `{ruleId, locale, ruleVersion}` — no account in key

**Scenario A→B during explain:** Discard stale response (same pattern as correction).

---

## Privacy (Minimum Context for Groq)

If Groq used for localization only, send:
- `ruleId`
- Trusted canonical explanation text (EN)
- Target locale code
- **NOT** full user history

If pair-level fallback only: **no Groq required**.

For context-aware grammar resolver (future): send **single sentence slice** around change, not full field history.

---

## Security

| Risk | Mitigation |
|------|------------|
| Prompt injection via user text | Delimit untrusted text; never in system instructions |
| XSS via explanation HTML | React text nodes only; no `dangerouslySetInnerHTML` |
| Cache poisoning | Validate schema; ruleVersion in key |
| Cross-account cache | Account-scope personalized; generic rules shared |
| AI invented rules | Resolver + library authority; AI read-only transform |

---

## Caching

| Content | Key | Scope |
|---------|-----|-------|
| Generic rule explanation | `ruleId + locale + ruleVersion` | Shared |
| Pair template | `category + normalizedOriginal + locale` | Shared |
| Personalized explanation | above + accountId | Account-scoped |

---

## Performance

| Path | Latency |
|------|---------|
| Deterministic pair explanation | <10ms |
| Library rule + template | <20ms |
| Cached explanation | <10ms |
| Groq localization (click) | 500–2000ms async |
| Correction render | **Must not wait** for explanation |

---

## Fallback Hierarchy (Recommended)

1. **Cached** explanation (personalized or generic)
2. **Trusted rule library** + deterministic resolver (high confidence)
3. **Deterministic pair template** (medium/low — no rule name)
4. **Groq localization** of trusted text (Pro, click only)
5. **Correction-only copy:** "We corrected `{original}` to `{corrected}`" — never fail silently

**No explanation > false explanation**

---

## Confidence Model

| Level | When | UI |
|-------|------|-----|
| **high** | Library match + pattern tests pass (e.g. instantSpell pair, regex SV heuristic with subject pronoun) | Show rule title |
| **medium** | Pair-level spelling/wording | Show pair explanation, no rule name |
| **low** | Grammar change, no library match | "Grammar correction" + pair |
| **uncertain** | Ambiguous short token, conflicting signals | Pair only + "Rule identification uncertain" |

---

## AI Hallucination Defense (Future)

Prompt constraints:
- Rule ID is fixed input — do not change
- Do not introduce new rules
- Do not claim user level
- Output schema only
- Examples must preserve corrected meaning

Validation:
- `ruleId` equality
- `category` equality
- Non-empty summary
- Language code match
- Reject if new rule names appear

---

## Commercial Model Recommendation

| Feature | Free | Pro |
|---------|------|-----|
| Pair-level deterministic explanation | ✅ | ✅ |
| Named rule (library) | ✅ | ✅ |
| AI-localized explanation | ❌ or limited | ✅ |
| Groq credit | 0 for deterministic | 1 per AI explain click (optional) |

**Recommend:** Free deterministic; Pro AI-enhanced localization. Do not consume correction credits for deterministic explain.

---

## Analytics (Future — Not Implemented)

Useful without raw text:
- `explanation_opened`
- `explanation_rule_id` (when high confidence)
- `practice_from_explanation`
- `explanation_fallback_level`

**Do NOT** create LearningEvent on explain click.

**Do NOT** add to History by default.

---

## Testing Strategy (Pre-Implementation)

See spec sections 46–47. Priority tests:
- High-confidence spelling pair
- Ambiguous grammar → no rule name
- Layout → no English rule explanation
- Wrong-category AI output rejected
- Account switch stale explain
- Malformed AI → fallback

---

## Real Code-Derived Examples

### CASE 1 — Spelling (HIGH pair confidence)

| | |
|---|---|
| Original | `I recieved your email` |
| Corrected | `received` |
| Category | `spelling` |
| Evidence | type + pair; matches `instantSpell` map |
| Rule name | **Unsafe** ("i before e") — **pair safe** |
| Safe explanation | "The spelling `recieved` is incorrect; use `received`." |
| Fallback | N/A — pair always available |

### CASE 2 — Grammar (LOW rule confidence)

| | |
|---|---|
| Original | `He go to school` |
| Corrected | `goes` |
| Category | `grammar` |
| Evidence | type only + offsets if in binding |
| Rule name | **Uncertain** — could be SV agreement, could be other |
| Safe explanation | "Grammar correction: `go` → `goes`" without naming SV agreement |
| Fallback | Required unless library heuristic passes |

### CASE 3 — Wording (MEDIUM)

| | |
|---|---|
| Original | `make a photo` |
| Corrected | `take a photo` |
| Category | `wording` |
| Safe explanation | "Natural phrasing: `make a photo` → `take a photo`" |
| Rule name | Optional collocation entry in library |

### CASE 4 — Ambiguous grammar

| | |
|---|---|
| Original | `get` |
| Corrected | `got` |
| Category | `grammar` |
| Safe? | **NO rule name** — tense? lexical? |
| Fallback | Pair-only + uncertain |

### CASE 5 — Layout

| | |
|---|---|
| Source | `recordLayoutLearning.ts` — manual FIX_LAYOUT |
| Category | `layout` |
| English rule explanation | **Out of scope** — keyboard/input learning |
| Practice | Excluded from English Practice (WL-4B) |

---

## Before / After Architecture

### CURRENT (VERIFIED)

```
Correction → Change[type,original,corrected,start,end]
    → LearningEvent[category,original,corrected,normalized*]
    → Recurring patterns → Practice (WL-4B)
```

### PROPOSED (NOT IMPLEMENTED)

```
Correction → Change
    → RuleResolver (deterministic)
    → Confidence
    → TrustedRule | PairTemplate
    → Explanation (locale from UI)
    → [Practice this] → existing WL-4B target
```

---

## Implementation Roadmap (Proposed)

| Phase | Scope |
|-------|-------|
| **WL-4C-A** | Explanation contract types + confidence model (no UI) |
| **WL-4C-B** | Pair-level deterministic explanations (no rule names) |
| **WL-4C-C** | Trusted Rule Library + deterministic resolver |
| **WL-4C-D** | Multilingual template layer (UI locale) |
| **WL-4C-E** | Dashboard drawer/split UI + content-script overlay |
| **WL-4C-F** | Optional Groq localization (Pro, click-only) |
| **WL-4C-G** | Practice navigation from explanation |

---

## File Impact Map

### Must change (future)

| File | Reason | Risk |
|------|--------|------|
| New `ruleResolver.ts` | Core safety | Medium |
| New `trustedRules/` | Library | Low |
| New `ExplanationPanel.tsx` | UI | Medium |
| `CorrectionCard.ts` or binding | Explain button | Medium |
| `packages/shared` explanation types | Contract | Low |

### May change

| File | Reason |
|------|--------|
| `ComposeWorkbench.tsx` | First dashboard host |
| `PracticePanel.tsx` | Deep link + drawer |
| `popup/i18n/*.ts` | Explanation strings |
| `background/` new message | EXPLAIN_CHANGE (future) |

### Must NOT change (WL-4C scope boundary)

| File | Reason |
|------|--------|
| `computePracticeRecommendation()` | WL-4B frozen |
| `computeRecurringPatterns()` | Analytics frozen |
| `CORRECTION_SYSTEM_PROMPT` | No rule ID in correction V1 |
| `LearningEvent` schema | Unless proven necessary |
| `recordCorrectionLearning.ts` | No explain events |
| Progress formulas | WL-2 frozen |
| Entitlement/credits | Separate phase |

---

## Risks

| Risk | Severity |
|------|----------|
| Naming wrong grammar rule | **P1 product** |
| Groq invents rules | **P1** |
| Explaining from LearningEvent without context | **P2** |
| Popup too narrow for split | **P2 UX** |
| Multilingual maintenance burden | **P2** |
| Extra Groq cost if not click-gated | **P1** |

---

## Open Product Decisions — Answers

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Free access? | **Yes** — deterministic pair + library |
| 2 | AI personalization Pro-only? | **Yes** |
| 3 | Deterministic free? | **Yes** |
| 4 | Explanation consumes credits? | **No** for deterministic; **optional 1** for AI localize |
| 5 | Explain clicks → LearningEvent? | **No** |
| 6 | Explain clicks → History? | **No** |
| 7 | Cache explanations? | **Yes** |
| 8 | Generic rules shared across accounts? | **Yes** |
| 9 | Personalized account-scoped? | **Yes** |
| 10 | Layout explanations? | **Separate** input-learning UX, not English rules |
| 11 | Wording same library? | **Same system**, collocation entries |
| 12 | Low confidence? | Pair-only; no rule title |

---

## Product Decision

**WL-4C should be: C — Hybrid**

- Deterministic pair + trusted library = accuracy foundation
- AI only for localization/polish on click
- Never AI-first rule detection

---

## Final Recommendation

Build WL-4C in layers: **safe pair explanations first**, then **trusted named rules**, then **multilingual UI**, then **optional AI polish**. Do not ship rule names until Trusted Rule Library + confidence gating exist.

---

## Final Verdict

```
WL-4C AUDIT:
COMPLETE

RULE IDENTIFICATION:
PARTIAL

GRAMMAR RULE RESOLUTION:
NOT READY

SPELLING EXPLANATION:
PARTIAL

WORDING EXPLANATION:
PARTIAL

LAYOUT EXPLANATION:
NOT READY

MULTILINGUAL EXPLANATION:
PARTIAL

TRUSTED RULE LIBRARY:
REQUIRED

AI ROLE:
NEEDS GUARDRAILS

GROQ COST:
LOW

HALLUCINATION RISK:
HIGH

ACCOUNT ISOLATION:
READY

PRIVACY:
NEEDS HARDENING

SECURITY:
NEEDS HARDENING

PRACTICE INTEGRATION:
READY

UI:
NEEDS WORK

PRODUCTION CHANGES:
0

P0:
0

P1:
3

P2:
5

P3:
4

PRODUCTION BLOCKER:
NO

NEXT IMPLEMENTATION:
WL-4C-B
```

### P1 Summary

1. **No rule/subtype in correction payload** — cannot safely name grammar rules today  
2. **Groq-as-rule-detector would hallucinate** — forbidden for V1  
3. **LearningEvent lacks sentence context** — cannot explain retrospectively from Progress alone  

### P2 Summary

- History not linked to changes  
- Content script UI constraints  
- Popup width limits  
- Multilingual library maintenance  
- Security hardening for future AI localize  

---

## Files Inspected

`packages/shared/src/correction/index.ts`, `learningEvents.ts`, `learning.ts`, `practice.ts`, `uiLocales.ts`, `entitlement/index.ts`, `extension/src/features/correction/*`, `extension/src/features/learning/recordCorrectionLearning.ts`, `recordLayoutLearning.ts`, `extension/src/storage/learning/events/index.ts`, `extension/src/storage/learning/practice/targetSelection.ts`, `extension/src/storage/history/*`, `extension/src/background/correct.ts`, `backend/src/providers/correctionProvider.ts`, `extension/src/dashboard/*`, `extension/src/popup/i18n/*`, `docs/privacy/DATA_FLOW.md`

## Files Modified

**NONE** — audit only.
