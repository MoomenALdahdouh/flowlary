# Phase 22 — Post-Phase-21 Product Reconciliation Audit

**Status:** Audit only — **no implementation**  
**Date:** 2026-08-25  
**Baseline:** Phase 21 complete (540 tests, unified popup/dashboard state model)  
**New product direction:** Writing Companion + Language Learning + Translation + Keyboard Layout Assistance

**Core loop:**

```
WRITE → GET HELP → UNDERSTAND RECURRING MISTAKES → PRACTICE → MEASURE IMPROVEMENT → WRITE BETTER
```

---

## Executive summary

Phase 21 delivered a **solid technical foundation**: unified domain state, shared UI components, separated extension vs AI status, honest error states, and popup/dashboard sync. That foundation should **mostly remain**.

Phase 21 also **encodes product decisions that now conflict** with the evolved direction:

1. **BYOK/Groq is first-class in UX** — must be removed from all user surfaces while keeping server-side provider abstraction.
2. **History is a first-class nav item** mixing activity types — must be split from **learning progress**.
3. **No learning layer exists** — correction AI already returns typed `CorrectionChange[]` but nothing is persisted for analytics, practice, or progress.

**Recommended outcome:** Phase 21 becomes the **shell** (popup + dashboard IA + state sync + design system). Phase 22+ adds a **learning domain** and retires BYOK UX, without rewriting correction/translation/layout engines.

---

## 1. What Phase 21 got right

| Area | Verdict | Notes |
|------|---------|-------|
| Unified `domainState` + `useExtensionSession` | **KEEP** | Single source of truth across popup/dashboard |
| Extension vs AI status separation | **KEEP** | Rename “Managed AI” → “Flowlary AI” in copy only |
| `FeatureControl` + disabled toggles when unavailable | **KEEP** | Prevents misleading ON states |
| Shared mutation layer | **KEEP** | `useFeatureMutations` |
| Popup as compact control surface | **KEEP** | Correct scope boundary |
| Settings grouping (Appearance/Writing/…) | **KEEP** | Extend with Learning; remove AI provider fork |
| Privacy as structured trust surface | **KEEP** | Extend for learning data |
| History privacy (local-only) | **KEEP** | Applies to activity store |
| Confirm dialogs, loading/error patterns | **KEEP** | Reuse for learning reset flows |
| Dashboard responsive shell + sidebar | **KEEP** | Update nav items only |
| Test coverage + chrome mock patterns | **KEEP** | Extend for learning tests |

---

## 2. What Phase 21 should remain unchanged

**Do not rewrite:**

- Content script architecture (InputEngine, FieldSession, CommandRouter)
- Correction / translation / layout feature modules
- Background message protocol (`GET_STATUS`, `SET_*`, `RUN_COMMAND`)
- Phase 11 activity history **storage engine** (privacy, dedupe, cap) — repurpose, don’t delete
- Account/entitlement integration (Phase 17/20)
- Glass Blur Snow design tokens and shared UI primitives
- Popup footprint and “no dashboard in popup” rule

**Keep file-level investments:**

- `extension/src/ui/domainState.ts` — simplify AI states after BYOK removal
- `extension/src/ui/SystemStatus.tsx`, `FeatureControl.tsx`, `shared.tsx`
- `extension/src/popup/useExtensionSession.ts` — storage sync pattern

---

## 3. What Phase 21 now conflicts with

| Phase 21 artifact | Conflict | Resolution |
|-------------------|----------|------------|
| BYOK settings panel, Groq key form, `#byok` deep link | Users must not configure providers | **REMOVE** user-facing; internal managed-only path |
| `AiServiceState.byok_*`, `aiProvider` in domain model | Product is “Flowlary AI” only | **REDESIGN** domain model |
| Dashboard nav: **History** as peer to Overview | History ≠ learning | **REDESIGN** IA → Progress + Practice |
| `HistoryEntry` used as proxy for “what user learned” | Stores translations/layout as equal citizens | **REDESIGN** split Activity vs Learning |
| “Managed AI” user copy everywhere | Brand is Flowlary AI | **REDESIGN** copy |
| Website pricing/support BYOK card | Same product decision | **REMOVE** from marketing |
| `manifest.json` host permission `api.groq.com` | BYOK direct calls | **REMOVE** after BYOK path retired |
| Overview = “Control Center” only | Product is Writing + Learning Center | **REDESIGN** positioning + nav |
| No onboarding | First-run expects language/level setup | **ADD** onboarding |
| Consent framed as “managed AI” vs BYOK | Single AI product consent | **REDESIGN** |

---

## 4. BYOK / Groq removal map

### User-facing — **REMOVE**

| Location | What to remove |
|----------|----------------|
| `extension/src/dashboard/panels/SettingsPanel.tsx` | Groq key form, managed/BYOK toggle, reveal/hide key |
| `extension/src/popup/i18n/messages.ts` | `ai.byok*`, `settings.useByok`, `settings.groq*`, `privacy.byok*`, BYOK feature reasons |
| `extension/src/popup/status.ts` | `groqKeyLabel()`, BYOK branches in `correctionAiLabel()` |
| `extension/src/popup/views/HomeView.tsx` | “Add API key” CTA, `#byok` navigation |
| `extension/src/dashboard/panels/OverviewPanel.tsx` | BYOK setup CTA |
| `extension/src/ui/domainState.ts` | `byok_ready`, `byok_missing`, BYOK correction offline exception |
| `extension/src/ui/SystemStatus.tsx` | BYOK badge labels |
| `extension/src/popup/openDashboard.ts` | `'byok'` section + hash aliases |
| `extension/src/popup/api.ts` | `saveGroqKey()`, `removeGroqKey()` from UI exposure |
| `extension/manifest.json`, `manifest.prod.json` | `https://api.groq.com/*` host permission |
| `website/src/i18n/en.ts`, `ar.ts` | BYOK pricing/support/privacy copy |
| `website/src/components/pricing/PricingShowcase.tsx` | BYOK plan card |
| `website/src/components/support/SupportCenter.tsx` | BYOK troubleshooting section |
| `website/src/pages/Privacy.tsx`, `Terms.tsx` | BYOK-specific clauses (replace with Flowlary AI) |

### Internal — **REDESIGN** (keep abstraction, remove user path)

| Location | Action |
|----------|--------|
| `extension/src/background/correct.ts` | **REMOVE** `callGroqByokOnce()`; all correction via `${FLOWLARY_API_BASE}/api/ai/correction` |
| `extension/src/features/correction/readiness.ts` | **REDESIGN** `isCorrectionAiReady()` → consent + entitlement only; remove `aiProvider` branch |
| `extension/src/core/state/StateManager.ts` | **REDESIGN** drop `aiProvider`, `groqApiKey` from public settings (or hardcode managed) |
| `extension/src/messaging/validate.ts` | **REMOVE** `groqApiKey`, `aiProvider` from user patch schema |
| `extension/src/storage/schemas.ts`, `facade.ts` | **REDESIGN** stop persisting user keys |
| `packages/shared/src/types.ts` | **KEEP** `STORAGE_KEYS.correctionGroqKey` only for migration cleanup |
| `backend/src/providers/groqClient.ts` | **KEEP** — server provider abstraction |
| `backend/src/gateway/index.ts` | **KEEP** — Flowlary AI gateway |
| `backend/src/config/env.ts` `GROQ_API_KEY` | **KEEP** — server credential only |

### Migration / cleanup — **ADD**

| Task | Detail |
|------|--------|
| One-time migration step | Clear `flowlary.correction.groqKey`, force `aiProvider: 'managed'` |
| Legacy key cleanup | Optionally delete `ewa_groq_api_key` after migration |
| Entitlement header | Remove dead `'byok'` tier from client claims if unused |
| Tests | Update ~20 tests asserting BYOK paths, Groq strings, `gsk_` privacy |

### Target user mental model

```
Extension → Flowlary API → Flowlary AI → [internal provider]
```

User sees: **Flowlary AI** — available / temporarily unavailable / consent required.

---

## 5. Current event / history architecture

### What exists today

**Store:** `flowlary.history` → `HistoryStoreV1`  
**Types:** `packages/shared/src/history.ts`

```typescript
HistoryEntry {
  operation: 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT'
  sourceText, resultText  // full text snapshots only
  metadata?: { mode, languages, layouts }
}
```

**Properties:**

- Max 50 entries, local-only, privacy-gated, 5s dedupe
- Records on **successful DOM commit** only
- Legacy EWA/Layfix import on first init
- Dashboard `HistoryPanel`: search, filter, delete, clear-all confirm
- **Does not store** `CorrectionChange[]` (spelling/grammar/wording)
- **Does not distinguish** accept vs dismiss vs auto-merge
- **Does not support** learning metrics

**Ephemeral (not persisted):**

- `CorrectionChange[]` from AI response (`packages/shared/src/correction/index.ts`)
- `CorrectionMetrics` session counters (`correction_commits`, `correction_card_accepted`, etc.)
- Layout trust `events` — schema exists, **runtime unwired** (`layout/profile/trust.ts`)

**Server-side (not user history):**

- `backend/src/services/usage.ts` — operation counts/tokens for billing, no text

### Classification of current history

| Current | Actual semantics | Future bucket |
|---------|------------------|---------------|
| `CORRECT` history entry | Activity: “a correction was applied” | **ActivityEvent** |
| `TRANSLATE` | Activity: translation performed | **ActivityEvent** — exclude from learning |
| `FIX_LAYOUT` | Activity: layout fix performed | **ActivityEvent** — exclude from learning |
| AI `changes[]` | Learning signal (typed mistakes) | **LearningEvent** — **not captured today** |
| Card accept/dismiss | Learning signal (user judgment) | **LearningEvent** — metrics only in RAM |
| `personalExceptions` | Layout-specific learning | **KEEP** separate from writing learning |

---

## 6. Proposed learning architecture

### Semantic separation (minimum)

Three logical streams — can share storage namespace with typed records:

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  ActivityEvent  │   │  LearningEvent  │   │   SystemEvent   │
│  (audit log)    │   │  (pedagogy)     │   │  (diagnostics)  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
    translations            mistake_detected      settings_changed
    layout_fixed            correction_applied    extension_paused
    speed_box_used          correction_rejected   onboarding_completed
    correction_committed    practice_completed
                            pattern_reinforced
```

**Do not merge stores without type discrimination.** Either:

- **Option A (recommended):** Two stores — `flowlary.activity` (rename/migrate history) + `flowlary.learning`  
- **Option B:** Single store with discriminated union `kind: 'activity' | 'learning' | 'system'`

Option A is clearer for privacy copy and retention policies.

### Minimum domain entities

| Entity | Verdict | Purpose |
|--------|---------|---------|
| **LearningProfile** | **ADD** | Stable prefs: learning language, level, focus areas, onboarding state |
| **LearningEvent** | **ADD** | Atomic learning signals (see §6) |
| **PracticeSession** | **ADD** | Bounded practice run linking multiple LearningEvents |
| **MistakePattern** | **DEFER** as stored entity | Compute on read from LearningEvents aggregation |
| **Progress** | **DEFER** as stored entity | Read model / computed dashboard state |

### LearningProfile (proposed)

```typescript
type LearningProfile = {
  version: 1
  onboardingCompleted: boolean
  learningLanguage: string          // e.g. 'en' — language user is improving
  uiLanguage?: string               // separate: extension UI locale (future)
  level?: 'beginner' | 'intermediate' | 'advanced' | 'unspecified'
  focusAreas: Array<'spelling' | 'grammar' | 'wording'>
  // Overlap with existing settings — reference, don't duplicate:
  correctionMode: 'box' | 'direct'   // pointer to flowlary.correction.mode
  translationPair: { source, target }
  keyboardLayouts: { source, targets[] }
  liveTranslationEnabled: boolean
}
```

**Storage:** `flowlary.learning.profile` (local)  
**Source:** onboarding + Settings > Learning  
**Privacy:** local; exportable; deletable independently

### LearningEvent (proposed)

```typescript
type LearningEventKind =
  | 'mistake_detected'       // AI found change, not yet applied
  | 'correction_applied'     // user/system applied fix
  | 'correction_rejected'    // user dismissed suggestion
  | 'correction_auto_merged' // direct mode auto-apply
  | 'practice_started'
  | 'practice_completed'
  | 'pattern_reviewed'

type LearningEvent = {
  id: string
  kind: LearningEventKind
  timestamp: number
  changeType?: 'spelling' | 'grammar' | 'wording'
  original: string              // normalized token/phrase, not full document
  corrected?: string
  contextSnippet?: string       // optional, truncated, privacy-gated
  domain?: string
  sessionId?: string            // PracticeSession id
  source: 'live' | 'practice' | 'manual'
  metadata?: { mode: 'box' | 'direct'; wordCount?: number }
}
```

**Storage:** `flowlary.learning.events` — ring buffer (suggest 500–2000 events, tunable)  
**Retention:** local default 90 days or max count; user can clear  
**Never include:** translation text, layout tokens, full page content by default

### PracticeSession (proposed)

```typescript
type PracticeSession = {
  id: string
  startedAt: number
  completedAt?: number
  focus: 'spelling' | 'grammar' | 'wording' | 'mixed'
  prompt?: string
  wordCount: number
  mistakeCount: number
  acceptedCount: number
  rejectedCount: number
}
```

**Storage:** `flowlary.learning.sessions`  
**Relationship:** LearningEvents reference `sessionId` during practice

### MistakePattern — **DEFER**

Compute at query time:

```sql
-- conceptual
GROUP BY normalize(original), changeType
HAVING COUNT(*) >= 2
ORDER BY lastSeen DESC
```

Materialize later if performance requires.

### Progress — **DEFER** as entity

Progress page reads aggregated LearningEvents:

- Errors per 100 words (rolling window)
- Count by type (spelling/grammar/wording)
- Trend line (7/30 day)
- Top recurring patterns
- Practice session summary

---

## 7. Legacy Practice recovery plan

**Important:** Legacy Practice UI is **not in the repository**. Production audit confirms: Control Center, Writing Lab, Insights — **NOT IN REPO**. Classification is based on legacy product concept + surviving code fragments (EWA history, `CorrectionChange` types, layout trust).

| Legacy capability | In repo today? | Classification | Notes |
|-------------------|----------------|----------------|-------|
| Practice page | No | **RESTORE** → **REDESIGN** | New dashboard route, not legacy UI copy |
| Write in English | Yes (correction) | **KEEP** | Core feature |
| Box / Direct mode | Yes | **KEEP** | Already in Settings; surface in onboarding |
| Errors / 100 words | No | **ADD** | Requires LearningEvents + word count denominator |
| Mistakes logged | Partial (history text pairs) | **REDESIGN** | Log typed changes, not whole paragraphs |
| Spelling / Grammar / Wording | Transient in AI response | **REDESIGN** | Persist on LearningEvent |
| Error rate over time | No | **ADD** | Progress chart |
| Errors by type | No | **ADD** | Progress breakdown |
| Recent mistakes | No (history ≠ mistakes) | **ADD** | Progress list from LearningEvents |
| Repeated mistake counts | No | **ADD** | Pattern aggregation |
| History of specific mistake | No | **ADD** | Drill-down from pattern |
| Listen (TTS) | No (website demo only) | **DEFER** | Not blocking core loop |
| Practice loop | No | **RESTORE** → **REDESIGN** | PracticeSession + dedicated UI |
| Export | No | **REDESIGN** | Learning profile + events + settings JSON |
| Import | Legacy migration only | **REDESIGN** | User-initiated restore; no API keys |
| Personal exceptions (layout) | Yes, active | **KEEP** | Stays in layout domain, not writing progress |
| Layout trust events | Stored, unwired | **DEFER** or **REDESIGN** | Layout learning ≠ English learning |

---

## 8. Proposed Progress architecture

### Purpose

Answer: **“Am I improving?”** — not “What did Flowlary do?”

### Page structure (dashboard)

```
Progress
├── Summary strip
│   ├── Errors / 100 words (7-day rolling)
│   ├── Mistakes logged (period)
│   └── Practice sessions completed
├── Error rate over time (chart)
├── Errors by type (spelling | grammar | wording)
├── Recurring patterns (top 5)
│   └── drill-down → mistake history for pattern
├── Recent learning events (compact, not activity log)
└── CTA → Start practice (focus on weakest type)
```

### Metric reliability

| Metric | Reliable today? | Requires |
|--------|-----------------|----------|
| Errors / 100 words | **No** | LearningEvents + word count on each correction/practice segment |
| Mistakes logged | **No** | Persist `CorrectionChange[]` as events |
| By type breakdown | **No** | `changeType` on LearningEvent |
| Error rate trend | **No** | Time-series aggregation |
| Recurring patterns | **No** | Normalized `original` key + count |
| Accepted vs rejected ratio | **Partial** | Metrics in RAM; need persist on card accept/dismiss |
| Translation/layout counts | **Yes** but **exclude** | Keep in Activity only |

### Data sources

- **Primary:** `flowlary.learning.events`
- **Secondary:** `flowlary.learning.sessions`
- **Excluded:** ActivityEvent translations, layout fixes, speed box

---

## 9. Proposed Practice architecture

### Product loop

```
Choose focus (spelling | grammar | wording | mixed | recurring pattern)
        ↓
   Write in sandbox editor (dashboard panel or dedicated tab)
        ↓
   Flowlary AI analyzes → mistake_detected events
        ↓
   Review suggestions (box mode default in practice)
        ↓
   Accept / reject → correction_applied | correction_rejected
        ↓
   practice_completed → update Progress aggregates
```

### UI placement

**Dashboard → Practice** (first-class nav)

Components:

- Focus selector (chips)
- Optional prompt/starter text
- Writing area (isolated from page content — no content script required)
- Inline correction using existing `CorrectionResponse` pipeline
- Session summary on completion

### Connection to Progress

- Every practice session writes LearningEvents with `source: 'practice'`
- Progress page links “Practice spelling” from weakest type
- Recurring patterns offer “Practice this mistake” deep link

### Not in scope for v1 practice

- Listen/TTS (**DEFER**)
- Multiplayer / social (**DEFER**)
- Server-synced practice history (**DEFER** — local first)

---

## 10. Proposed onboarding

### Trigger

- First install: `chrome.runtime.onInstalled` → if `!learningProfile.onboardingCompleted`, open dashboard `#onboarding`
- Skippable at any step; resume later from Settings

### Steps (5 screens max)

| Step | Content | Skippable |
|------|---------|-----------|
| 1 Welcome | “Flowlary helps you write better in English.” | No |
| 2 Learning language | English (fixed v1) + “What language do you write in?” | Yes |
| 3 Level & focus | Optional level + spelling/grammar/wording chips | Yes |
| 4 Translation & layout | Language pair, keyboard layouts | Yes (defaults exist) |
| 5 Preferences | Correction mode (box/direct), live translation toggle | Yes |
| Done | “Flowlary is ready.” + Flowlary AI consent if needed | — |

### Explicitly excluded

- Groq, API keys, provider selection, billing

### Storage

Writes `LearningProfile` + existing settings patches in one transactional flow.

---

## 11. Proposed dashboard IA

### Recommended navigation

```
Overview          — extension status, features, quick actions (Phase 21 core)
Progress          — learning metrics, improvement (NEW)
Practice          — practice loop (NEW)
Settings          — configuration incl. Activity log (REDESIGN)
Privacy           — trust + data categories (EXTEND)
Account           — identity, plan (KEEP)
```

### Where does Activity / History go?

**Recommendation: Settings → Data → Activity log** (secondary, collapsed)

| Option | Verdict | Rationale |
|--------|---------|-----------|
| Top-level History nav | **REMOVE** | Users don’t open the app to see translation logs |
| Inside Progress | **REJECT** | Pollutes “am I improving?” |
| Inside Settings | **ADD** | Power-user/debug; matches iOS “Screen Time” pattern |
| Nowhere (delete feature) | **REJECT** | Activity audit still useful for trust/debug |

Activity log keeps: search, filter, delete, clear — unchanged UX, demoted nav.

### Overview evolution

**KEEP** control-center function; **ADD** one Progress teaser card:

- “12 mistakes this week · 3 recurring patterns → View Progress”

Positioning copy: **“Flowlary Writing + Learning Center”** (dashboard kicker).

### Popup

**KEEP** Phase 21 popup unchanged in scope after BYOK removal + “Flowlary AI” copy.

No Progress, Practice, History, or analytics in popup.

---

## 12. Privacy implications

### Data categories (honest)

| Data | Location | Leaves device? | User control |
|------|----------|----------------|--------------|
| Activity log (translation, layout) | Local | Text sent to API when feature runs | Clear activity |
| Learning events | Local | Mistake snippets from live writing sent to Flowlary AI for correction | Clear learning history |
| Learning profile | Local | No | Reset profile |
| Settings / theme | Local | No | Standard |
| Account / plan | Local cache + server | Email/plan to Flowlary account API | Sign out |
| Practice writing | Local session | Sent to Flowlary AI during practice | Not retained server-side (verify backend) |
| BYOK keys | Local (legacy) | Went direct to Groq | **Remove** — migration clears |

### Copy updates required

- Remove BYOK privacy exception
- Add **Learning data** section: what is tracked locally, what is not uploaded as analytics
- Clarify: learning metrics derived from **English correction signals only**
- Do **not** claim “zero analytics” unless verified — backend usage metadata exists for billing

### Deletion matrix (separate actions)

| Action | Scope |
|--------|-------|
| Clear activity | ActivityEvent store only |
| Clear learning history | LearningEvents + computed caches |
| Reset learning profile | LearningProfile → defaults, re-trigger onboarding |
| Reset onboarding flag only | Soft re-show onboarding |
| Sign out | Account cache only; optional prompt for local data |

---

## 13. Data migration requirements

| Migration | Priority | Detail |
|-----------|----------|--------|
| BYOK retirement | P0 | Force managed mode; delete `flowlary.correction.groqKey`; remove manifest permission |
| History → Activity rename | P1 | Optional key rename `flowlary.history` → `flowlary.activity` or tag records |
| Learning store init | P1 | Empty `flowlary.learning.*` on upgrade |
| Legacy EWA history | P2 | **Do not** auto-convert to LearningEvents (no typed changes available) |
| LearningProfile from settings | P1 | Seed from existing correction/translation/layout settings |
| Export format v1 | P2 | New JSON schema without secrets |

**No server migration required** for v1 — learning is local-first.

---

## 14. Frontend changes (classified)

| Change | Class |
|--------|-------|
| Remove BYOK from Settings, popup, overview | **REMOVE** |
| Rename Managed AI → Flowlary AI | **REDESIGN** |
| Simplify `domainState` AI states | **REDESIGN** |
| Add Progress panel + routes | **ADD** |
| Add Practice panel + sandbox editor | **ADD** |
| Add Onboarding flow (dashboard modal or route) | **ADD** |
| Move HistoryPanel → Settings > Activity | **REDESIGN** |
| Add Settings > Learning section | **ADD** |
| Add Settings > Data management (clear/reset) | **ADD** |
| Progress teaser on Overview | **ADD** |
| Update Privacy panel for learning | **REDESIGN** |
| Website BYOK removal | **REMOVE** |
| i18n: all new Progress/Practice/Onboarding strings | **ADD** |
| Keep Phase 21 shared components | **KEEP** |

---

## 15. Backend changes (classified)

| Change | Class |
|--------|-------|
| Keep gateway + `groqClient` as internal provider | **KEEP** |
| No user BYOK key in any route | **KEEP** (already true) |
| Verify correction response always includes `changes[]` | **KEEP** / validate |
| Optional: `/api/learning/*` for cloud sync | **DEFER** |
| Usage metadata: tag correction vs practice if sent | **DEFER** |
| Remove `'byok'` from entitlement tier docs/code comments | **REDESIGN** |
| Server-side learning analytics | **DEFER** — local-first v1 |

---

## 16. Testing requirements

| Area | Tests |
|------|-------|
| BYOK removal | No Groq strings in UI; no `gsk_` in DOM; manifest permission gone |
| Domain state | Flowlary AI states without byok_* |
| LearningEvent recording | On correction commit, card accept/reject |
| LearningEvent exclusion | Translation/layout do not create learning events |
| Progress aggregates | Errors/100 words math with fixture events |
| Practice session lifecycle | start → write → complete |
| Onboarding | First run shows; skip/resume; writes profile |
| Activity demotion | Settings contains activity; nav has no History |
| Privacy render | Learning + activity sections accurate |
| Export/import | JSON round-trip; no tokens/keys |
| Clear/reset | Independent scopes work |
| Migration | BYOK key cleared on upgrade |

Target: maintain **540+** tests; add ~40–60 for learning domain.

---

## 17. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Removing BYOK breaks offline correction | Medium | Managed API availability UX; cache; honest offline state |
| LearningEvents privacy sensitivity | High | Store normalized tokens, not full documents; cap retention |
| Errors/100 words misleading early on | Medium | Show “ collecting data” until N words/events |
| Scope creep reviving full legacy UI | High | Stick to concept recovery, Phase 21 design system |
| Duplicate settings (profile vs correction) | Medium | Single write path; profile mirrors settings |
| Practice sandbox vs live correction divergence | Medium | Reuse same `CorrectionResponse` validation path |
| Migration drops user Groq keys | Low | Intended; communicate in release notes |
| Server text retention for AI calls | High | Audit backend logs; document in Privacy |

---

## 18. Recommended implementation order

### Phase 22A — Product alignment (1–2 weeks)

1. **BYOK UX removal** — UI, copy, manifest, migration, tests  
2. **Rename Managed AI → Flowlary AI** — extension + website  
3. **Simplify domainState** — remove byok branches  
4. **IA shell** — nav: Overview, Progress (stub), Practice (stub), Settings, Privacy, Account  
5. **Demote History** → Settings > Activity  

### Phase 22B — Learning foundation (2–3 weeks)

6. **LearningProfile** schema + onboarding (minimal)  
7. **LearningEvent** recording at correction commit + accept/reject  
8. **Activity/Learning split** in storage  
9. **Settings > Data** — clear activity / clear learning / reset profile  

### Phase 22C — Progress (2 weeks)

10. **Progress read model** — aggregates, charts, recurring patterns  
11. **Overview teaser** card  

### Phase 22D — Practice (2–3 weeks)

12. **PracticeSession** + sandbox UI  
13. **Practice → Progress** integration  

### Phase 22E — Polish (1 week)

14. **Export/import** learning data  
15. **Privacy page** final copy  
16. **Website** learning/product narrative update  

### Deferred

- Listen/TTS  
- Cloud-synced learning  
- Server-side learning API  
- MistakePattern materialized store  
- Arabic UI / RTL  

---

## Appendix A — Learning event integrity rules

| Question | Definition |
|----------|------------|
| **What is an error?** | A typed `CorrectionChange` where `original !== corrected` in English writing context |
| **What is a correction?** | Application of a suggested fix to user text (auto-merge or explicit accept) |
| **What is a learning signal?** | Any event that informs pedagogy: detected mistake, apply, reject, practice result |
| **What is a recurring mistake?** | Same normalized `original` + `changeType` appearing ≥2 times in rolling window |
| **What is a practice result?** | Summary LearningEvents tied to a PracticeSession |

### Never count as language mistakes

- Translation output differences  
- Keyboard layout remaps  
- Speed Box conversions  
- Live translation replacements  
- Instant spelling local heuristics (unless explicitly promoted to learning signal — **DEFER**)

### Do not count every correction as educational error

- If AI returns empty `changes[]` → no mistake event  
- If user rejects suggestion → `correction_rejected`, not counted in error rate numerator  
- Direct mode auto-merge → `correction_auto_merged` — count once, not detect+apply twice  

---

## Appendix B — Settings structure (target)

```
Appearance
Writing        — correction mode, highlights
Learning       — language, level, focus areas
Translation    — source/target, auto-detect, swap
Keyboard Layout — layouts, shortcuts, auto-detect
Shortcuts      — reference list
AI             — Flowlary AI consent, availability (no provider choice)
Data           — Activity log, learning history, export/import, reset
```

---

## Appendix C — Phase 21 file inventory to touch (implementation checklist)

**BYOK removal:**  
`SettingsPanel.tsx`, `HomeView.tsx`, `OverviewPanel.tsx`, `domainState.ts`, `SystemStatus.tsx`, `messages.ts`, `status.ts`, `api.ts`, `openDashboard.ts`, `readiness.ts`, `correct.ts`, `StateManager.ts`, `validate.ts`, `manifest*.json`, website i18n/pricing/support/privacy

**Learning add:**  
`packages/shared/src/learning/*`, `extension/src/storage/learning/*`, `extension/src/dashboard/panels/ProgressPanel.tsx`, `PracticePanel.tsx`, `OnboardingFlow.tsx`, `SettingsPanel.tsx` (Learning + Data sections)

**Keep untouched:**  
`FeatureControl.tsx`, `useExtensionSession.ts`, `useFeatureMutations.ts`, content script features, gateway backend

---

*End of audit. Ready for Phase 22 implementation planning.*
