# Intent Intelligence, Ambiguity, Hypothesis Routing & LLM Decision Layer

**AUDIT DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**SCOPE:** Audit only. No application code, tests, UI, storage, or models were changed.  
**METHOD:** Implementation tracing of the Chrome MV3 writing path (`extension/src/core/engine/*`, Write Gate, InputEngine, layout/correction/translation features, safety tokenizers, backend Groq providers). Architecture specs were treated as **contracts**, not as runtime proof.

This audit is broader than the three shipped capabilities. It asks whether Flowlary can represent a bilingual user’s **real writing intent** under daily keyboard, mixing, technical, and edit-after-AI conditions — and whether an LLM should sit inside the **final write decision**.

---

## 1. Executive Summary

**Current Flowlary does not understand user intent.** It classifies **surface evidence** (script counts, closed lexicons, physical-key remaps, a small typo dictionary, protected-token regexes, and explicit policy/session flags) and then **picks one capability** with a **hardcoded priority** (layout → translation → English).

That is a **rules → decision** machine. It is competent at a few mechanical cases. It is not a hypothesis engine. It is not calibrated. It is not bilingual-intent-aware. An LLM already exists for **layout classification (legacy path)**, **English grammar (legacy path)**, and **translation output** — but **`decideWriting` never consults an LLM** and must not be described as an intelligence layer.

### Core-question answer (section 35.1–35.3, expanded in §7)

| Code | Situation | Current ability |
|---|---|---|
| A | Arabic intended as Arabic | **Partial.** Arabic-script tokens in the Arabic lexicon → `VALID`. Unknown Arabic can still be reverse-mapped to English if the remap is an English lexicon hit. |
| B | English intended as English | **Partial.** Closed English lexicon → `VALID` (no layout). Function-word detector → English correction eligibility. Technical Latin that is **not** a function word often fails `detectEnglish`. |
| C | Arabic typed with English keyboard | **Strong when remap is a known Arabic word and length ≥ 3** (or ≤2 with Arabic neighbors). Otherwise miss. |
| D | English typed with Arabic keyboard | **Strong when remap is a known English word.** Unknown English / names / typos miss. |
| E | Intentional Arabic + English mixing | **Not understood.** Field-level `hasAmbiguousMixed` → **noop** (blocks English). Translation session can still **rewrite the whole Arabic-containing sentence**, including English tokens. |
| F | English technical terms inside Arabic | **Token-level protection is uneven.** `API`/`UI`/`UX` match `ALL_CAPS` → `code-identifier`. `error` is in the English lexicon. `deploy` is **not**. Mixed field still trips `hasAmbiguousMixed`. |
| G | Arabic technical terms inside English | **No dedicated class.** Arabic script + Latin → mixed → noop correction. Layout may fire on Latin neighbors. |
| H | Spelling mistakes | **Tiny closed map** (`hwo`→`how`, …) in enforce. Remote grammar exists **outside** `decideWriting` (legacy scheduler when enforce is off). |
| I | Keyboard-layout mistakes | **Best-supported path**, lexicon-gated, local `mapLayout` + Shift-level physical keys. |
| J | Translation requests | **Policy/session/shortcut only.** Arabic script ≠ translate. |
| K | Accidental language switching | **Not modeled.** A mid-sentence layout change is more tokens, not a “switch event.” |
| L | Punctuation/symbol from layout | **Partial.** `÷×—–` split as delimiters / `shift_symbol_break`. QWERTY punct that is an Arabic letter stays **inside** the token. No “intentional symbol vs layout error” hypothesis. |
| M | Capitalization / Caps Lock | **No Caps Lock sensor (correct).** Case is mostly ignored for layout lexicons (`toLocaleLowerCase`). Instant spell preserves Title/ALLCAPS. `ALL_CAPS` tokens are **protected** (can hide `OK` and `API` alike). |
| N | Abbreviations | **ALL_CAPS / versionish / lexicon.** No abbreviation intent. |
| O–S | URLs, emails, code, identifiers, product names | **Token skip regexes** (strong for URL/email/path/camelCase/Pascal/snake). Product names in the lexicon are safe from layout; others are unknown Latin. |
| T–U | Proper names / acronyms | **No NER.** Acronyms often `code-identifier`. Names are unknown or lexicon-miss. |
| V | Transliteration / Arabizi | **Fragile regex** (`2/3/5/7/9` or `..7.`). `inshallah` / `shukran` are **not** flagged. Collides with English typos and leetspeak. |
| W | Unfinished text | **Partial.** Instant spell skips trailing incomplete words unless they are in the typo map. Layout candidates still evaluate completed tokens in the field. Enforce runs on **every** `input`, including mid-word. |
| X | Intentionally malformed text | **No “leave it” intent.** If a remap is a lexicon hit, it can still auto-write. |
| Y | Quoted text | **Lead/trail quote peel only.** Quotes are not a “do not touch” region. |
| Z | Pasted text | **Legacy layout skips paste.** **Enforce does not** — paste is a normal `input` cycle. |
| AA | Text from another application | **Same as paste/type.** No origin beyond USER vs SYSTEM write. |
| AB | Text already generated by Flowlary | **Partial.** Translated ranges hashed + overlap check. Layout/correction writes are not origin-tagged in analysis except `translated_en` when overlap is Latin-only. |
| AC | Edit after correction/translation | **Stale generation + hash prune** for translation tags. No “user overrode this span” memory in `decideWriting`. Layout exception list exists **only on the legacy scheduler**. |

**Verdict in one line:** Flowlary can **remap obvious wrong-keyboard words** and **avoid some protected tokens**. It cannot reliably tell **intentional foreign token** from **wrong keyboard** from **English typo** from **transliteration** from **translate-this**.

### Recommendation (preview)

Adopt **Architecture B (rules + LLM as advisor)**, not LLM-as-judge and not rules-only forever:

`LOCAL EVIDENCE → HYPOTHESES → LLM ONLY WHEN HYPOTHESES CONFLICT OR CONFIDENCE IS UNCALIBRATED → POLICY GUARD → WRITE GATE → ONE ACTION`

The user’s hypothesis is **accepted with a hard constraint:** the LLM must **not** emit the final write. It may **score / explain / choose among locally generated candidates**. Policy + Write Gate remain the only writers.

---

## 2. Current Intent Architecture

Intent is **not a first-class object**. The closest substitutes:

1. **`UserWritingPolicy`** (`writingPolicy.ts`): `assistantEnabled`, `helpStyle`, `fixWrongTyping`, `improveEnglish`, `arabicToEnglishMode`, `polishAfterTranslate`. This is **user preference**, not utterance intent.
2. **`TranslationSession`** on `FieldSession`: created automatically in `runFieldCycle` when `arabicToEnglishMode` is on and the field is not paused. This is an **operating mode**, not “this sentence should be translated.”
3. **`TextOrigin`** on chunks/analysis: `original_en|original_ar|original_mixed|translated_en|layout_mismatch_suspected|arabizi_suspected|unknown`. These are **labels derived from script + lexicon + regex**, then collapsed to a **field-dominant** origin.
4. **Explicit commands:** shortcuts, Speed Box, suggestion accept (legacy cards). These bypass `decideWriting`.

The architecture spec (`docs/architecture/unified-writing-decision-engine-spec.md`) states correctly: *language detection is evidence, not intent.* Runtime still **uses evidence as if it were intent** whenever it auto-writes a layout remap or starts live translation on any completed Arabic-containing sentence.

There is **no** `selectedIntent`, **no** competing interpretations, **no** user-goal type (`write_as_is` | `fix_layout` | `fix_english` | `translate` | `preserve_code`).

---

## 3. Current Decision Engine

**Files:** `extension/src/core/engine/{decide,candidates,chunks,context,types}.ts`, `extension/src/core/writeGate/{pipeline,enforceCoordinator,writeGate,pipelineTranslate}.ts`.

### Cycle (enforce, after hydrate)

```
InputEngine (USER input, not composing)
  → runFieldCycle
    → ensure/end TranslationSession from policy
    → buildFieldContext (safety, tier, policy, composing, mutex, cooldown)
    → read whole field + caret
    → pruneTranslatedTags(text)
    → analyzeFieldText(entire field)
    → if translated overlap on [0, length] and no Arabic: dominantOrigin = translated_en
    → collectShadowCandidates (local only)
    → decideWriting (observeOnly: false)
    → analytics (often mis-labels applied writes as outcome noop)
    → if suggestion: return (no UI)
    → if translation: fulfillTranslationDecision (remote API)
    → else if winner.replacement: Write Gate
```

### `decideWriting` is a total order, not a comparison

1. Policy / safety / composing / mutex / cooldown / editor tier → `noop`.
2. **Any layout candidate** wins the cycle:
   - short/ambiguous → `noop` (`ambiguous_short_token`)
   - high + eligible → `layout_fix`
   - else → `suggestion` (unmounted)
3. Else `hasArabizi` → `noop` (blocks English).
4. Else `hasAmbiguousMixed` → `noop` (blocks English).
5. Else translation candidate (requires session + `arabicToEnglishMode`):
   - low / not eligible → `suggestion`
   - else → `translation`
6. Else English candidate with eligibility / helpStyle.
7. Else `noop` (`no_candidates`).

**There is never “H1 vs H2.”** Layout presence **suppresses** translation and English even when the user’s real goal was mixed technical Arabic.

### What the engine can actually auto-apply today

| Action | Replacement source | Typical trigger |
|---|---|---|
| `layout_fix` | Local `mapLayout` string on a chunk | High commit + not short |
| `english_correction` | Instant typo dictionary only | Eligible English + `helpStyle === auto` + correction mode `direct` |
| `translation` | Remote `requestTranslationRemote` after decide | Session + completed sentence + Arabic letter |
| `suggestion` | Decision only | **No card mount in pipeline** |
| `noop` | — | Default / mixed / Arabizi / policy |

Remote **grammar** and remote **layout classifier** are **not** inputs to `decideWriting`.

---

## 4. Current Evidence Sources

| Signal | Where | Used as | In `decideWriting`? |
|---|---|---|---|
| Unicode script counts | `scriptCounts`, chunks | Origin / mixed / English gate | Via analysis flags |
| Closed English lexicon | `en-words.ts` | Layout `VALID`; chunk `original_en` | Indirect |
| Closed Arabic lexicon | `ar-words.ts` | Layout commit (`confidentArabicMismatch`) | Indirect |
| Physical key tables + Shift/AltGr | `mapLayout` / `registry.ts` | Remap candidate | Via layout candidates |
| Neighbor ±3 tokens | `sentence.ts` `neighborContext` | Legacy `planFieldFixes` | **Not** in unified `collectShadowCandidates` (hint uses **whole field** as `context`) |
| Function-word English detector | `detectEnglish` | Correction eligibility | Via correction candidate |
| Instant typo map | `instantSpell.ts` (~40 entries) | Replacement + high class if changed | Yes |
| Protected token regexes | `tokenKind.ts` | Skip layout; `hasProtected` blocks English | Yes |
| Field-level safety | `evaluateFieldSafety`, code-editor look | Context `safetyAllowed`, tier 4 | Yes |
| Arabizi regex | `ARABIZI_HINT` in `chunks.ts` | `hasArabizi` | Yes |
| Shift glyphs `÷×—–` | tokenize + chunks | `shift_symbol_break` | Via `hasLayoutSuspicion` |
| Translation session / pause | `FieldSession` | Translation eligibility | Yes |
| Translated range hashes | `FieldSession.pruneTranslatedTags` | Skip re-translate overlap; mark `translated_en` | Partial |
| Policy / helpStyle | `writingPolicy.ts` | Hard gates | Yes |
| Editor tier | value=1, CE=2, code=4 | Auto-write only tier 1 | Yes |
| Composing / mutex / cooldown / generation | session | Abstain / stale | Yes |
| `keydown.shiftKey` | EventBus | **Not consumed by decide/chunks** | **No** (spec wants it; runtime does not) |
| OS layout / Caps Lock | — | Unavailable | **Correctly unused** |
| Personal layout exceptions | `profile/exceptions.ts` | Legacy scheduler + undo trust | **`inExceptionList` always `false` in chunks** |
| Layout AI (Groq) | `layoutClassifierProvider.ts` | Legacy `LayoutScheduler.evaluateRemote` | **No** |
| Correction AI (Groq) | `correctionProvider.ts` | Legacy scheduler / cards | **No** |
| Translation API | Google/Groq router | Output only, after decide | After decide |
| User accept/reject learning | `recordCorrectionLearning.ts` | Practice/learning store (includes sample text) | **No** |
| Paste `inputType` | EventBus | Legacy layout skip | **Enforce ignores it** |
| Selection range | — | Not a decision unit | **No** |
| Session history of decisions | in-memory analytics ring (80) | Debug | **No feedback into decide** |

---

## 5. Current Confidence Model

`Confidence = { score: number, class: 'high'|'medium'|'low'|'ambiguous' }`.

**These numbers are not probabilities.** They are **constants** chosen by the implementer:

| Candidate | High path | Low / other |
|---|---|---|
| Layout | `0.85` / `high` if `canCommitMismatch` and length > 2 | `0.35` / `ambiguous` if short, else `low` |
| Translation | `0.8` / `high` if session exists | `0.4` / `low` if no session |
| English | `min(0.8, detectEnglish.confidence)` if eligible; class `high` only if instant map changed the text | `0.25` / `low` if blocked |

`detectEnglish.confidence` is also heuristic (`0.5 + function-word ratio`, etc.), **not** measured accuracy.

**No** validation set, golden-set online metrics, acceptance-rate feedback, false-positive rate, or per-capability threshold tuning exists for these scores.

`decideWriting` treats `class` as a **switch**, not a calibrated risk:

- Layout `high` → auto.
- Layout `ambiguous` (short) → noop (good).
- Layout other → suggestion (dead UI).
- Translation `low` → suggestion (dead UI).
- English `high` + auto help → write.

**Self-reported LLM confidence is not used** in the engine (and must not be trusted if added).

---

## 6. Current LLM Usage

| Path | Model role | Participates in `decideWriting`? | Writes field? |
|---|---|---|---|
| Layout classifier (Groq JSON `VALID` / `LAYOUT_MISMATCH`) | **Advisor that can still auto-write** on the **legacy** scheduler after local miss | No | Yes, via `applyLayoutFix`, only when `engineMode !== enforce` |
| English correction (Groq) | **Producer of rewritten English** | No | Yes, legacy scheduler / cards / shortcut |
| Translation (Google and/or Groq) | **Producer of target text** | No (decision is “Arabic sentence + session”) | Yes, `fulfillTranslationDecision` in enforce |
| Learning coach / explanation / report narration | Off writing path | No | No |
| `collectShadowCandidates` | Explicitly **MUST NOT** call APIs | — | — |

**Implication:** Today’s LLM is used as a **text transformer** or a **legacy layout fallback**, not as an intent interpreter. Adding “LLM decides action” would be a **new** role. The existing layout classifier is already a cautionary tale: a remote `LAYOUT_MISMATCH` can mutate the field **without** going through `decideWriting` when enforce is off.

---

## 7. Ambiguity Taxonomy

### 7.1 How to read this taxonomy

**Handled** = a dedicated, tested mechanism that usually does the right thing.  
**Collapsed** = forced into mixed/unknown/protected and usually **noop** or **over-translate**.  
**Unsafe** = can auto-write the wrong interpretation.  
**Invisible** = no representation.

Daily bilingual typing is **not** a 3-way enum. The same glyphs can be:

- intended language A
- intended language B typed on A’s keyboard
- intended mix
- typo in A
- Arabizi
- identifier
- quote
- paste
- leftover AI output

The engine **collapses** most of these into one of: layout candidate, mixed flag, Arabizi flag, protected token, English eligible, Arabic-for-translate.

### 7.2 Language mixing (category A)

| Pattern | Current handling |
|---|---|
| Arabic + English words | `hasAmbiguousMixed` if no layout suspicion → **noop English**; layout only on mismatch chunks; **translation may take the whole sentence** |
| English + Arabic | Same |
| Arabic + French/other Latin | `detectEnglish` may reject via function words/diacritics; still **mixed** if Arabic present → noop English. Layout may treat unknown Latin as QWERTY→Arabic if remap is an Arabic word (**unsafe**) |
| Arabic + English acronym | Acronym often `ALL_CAPS` protected; sentence still mixed / translatable |
| Arabic + product name in lexicon (`github`, `python`) | Token `VALID` for layout; field mixed |
| Arabic + product name **not** in lexicon (`deploy`, `Kubernetes`) | Unknown Latin; layout remap **if** Arabic lexicon hits; else mixed |
| Arabic + URL / email / code | Token skip; field still mixed / sentence still translatable |
| English + Arabic name | Mixed; name not protected |
| English + Arabic quotation | Quotes peeled; Arabic still mixed/translate |
| Mixed + punctuation / numbers / emoji | Numbers → `digits` skip; emoji → `other` script; punctuation mostly delimiters. **Does not** create a mix-safe policy |

**Product examples from the brief:**

| Input | Likely engine outcome (enforce, default auto, no translation session) |
|---|---|
| `هل هذه الأداة جاهزة … وهل تجهز ايضا UI UX؟` | Mixed + protected `UI`/`UX` → **noop**. With translation mode: **sentence translate**, risk of translating or dropping `UI UX`. |
| `أنا عملت deploy لكن فيه error` | `error` lexicon-valid; `deploy` unknown. If `deploy` remaps to an Arabic word → **layout_fix** (possibly wrong). Else mixed **noop**. Translation mode: whole sentence. |
| `أريد API key من GitHub` | `API` protected; `GitHub` PascalCase → `code-identifier`; `key` may be English lexicon. Mixed **noop** or translate-all. |
| `هل يمكنني استخدام Python + Laravel؟` | `Python`/`Laravel` lexicon; `+` not a layout letter. Mixed / translate-all. |
| `هذا التصميم جيد جدًا، but I need a small change` | Mixed **noop** English (the English half is the part that needed help). |
| `design engain` | No function words → **not** `isEnglish`; `engain` not in typo map; remap to Arabic only if lexicon hit. Typical: **noop** (missed spelling). |
| `هل يمكن إصلاح الـ API؟` | Arabic + protected `API` → mixed noop / translate-all. |

### 7.3 Distinguishing the four-way product problem

The required distinction:

1. **INTENTIONAL FOREIGN TOKEN**
2. **WRONG KEYBOARD OUTPUT**
3. **ENGLISH SPELLING ERROR**
4. **TRANSLITERATION**

**Current discriminator is almost entirely:**

- remap ∈ closed lexicon? → (2)
- Latin ∈ English lexicon? → treat as English (1) for layout
- Latin matches Arabizi regex and not English word? → (4)
- else if Latin + Arabic in field? → give up (noop)
- else if Latin function words + typo map? → (3) tiny
- else unknown

**Script is not sufficient, and the code already knows that** (`chunks.ts` comment: lexicon/script are evidence). It still **lacks a fourth interpretation** and **lacks comparison**.

---

## 8. Keyboard / Layout Ambiguities

### What exists

- Bidirectional **physical-key** maps (`en-US-qwerty` ↔ `ar-101`, plus RU and world layouts).
- **Shift / AltGr levels** are part of `mapLayout` (glyph → keyId+level → other layout’s same level).
- Commit only if remap is a **lexicon word** (English or Arabic) with length rules.
- Short tokens (1–2) require `contextSuggestsTarget` (Arabic in field or neighbor remap).
- `AR_LETTER_PUNCT` (`[ ] ' ; , . / \``) stays **inside** QWERTY tokens because those keys are letters on Arabic 101.
- `÷×—–` treated as **hard breaks** (Shift-on-Arabic math/dash).

### What is not modeled (requested matrix)

| Situation | Modeled? |
|---|---|
| Full word wrong layout, lexicon hit | Yes |
| Partial sentence wrong layout | Per-token; other tokens independent |
| Single character / 1–2 letters isolated | Noop unless neighbors scream Arabic |
| One word switches layout | That token only; no “user switched keyboard” event |
| Two words switch | Two independent decisions; first high-conf layout **wins the whole cycle** and **blocks** others |
| User corrects layout halfway | Generation bump; no “already fixed prefix” intent |
| User notices and continues | Next cycle; no hysteresis except cooldown (cleared on bump) |
| Backspace part of wrong-layout text | New text; may re-fire |
| Select only wrong-layout span | **Selection is not the unit**; whole field analyzed, winner is a token range |
| Wrong layout + punctuation/numbers/symbols/Shift | Partial (see §10) |
| Caps Lock | Not observed; uppercase Latin still QWERTY charset |
| Wrong layout at start / middle / end | Position unused except caret for translation sentence and incomplete tokens |
| English intended / Arabic keyboard, unknown word | Miss (no English lexicon hit on remap) |
| Arabic intended / English keyboard, unknown word | Miss |

**Key-state gap (spec § vs code):** `keydown` includes `shiftKey`, but **chunks/decide do not attach shift evidence to the token**. Absence of key-state does **not** lower confidence. Character-only remap is treated as complete.

---

## 9. Mixed-Language Ambiguities

`hasAmbiguousMixed = (any Arabic chunk) && (any Latin chunk) && !hasLayoutSuspicion`.

Effects:

- **English auto is forbidden** (correct conservative instinct).
- **Layout still runs first** if **any** chunk has suspicion — a single suspected token can **layout-write** in a mixed sentence and block translation.
- **Translation does not use chunks.** It uses `lastCompletedSegment` + “contains an Arabic letter.” Mixed sentences are **one blob**.

This is the central product failure for natural bilingual typing: the engine’s “safe” mixed policy is **do nothing for English**, and its “translation on” policy is **do everything**.

There is **no** chunk policy such as: translate Arabic spans, preserve `API`/`Python`/`https://…`, suggest English polish on Latin clauses only.

---

## 10. Symbols / Punctuation

### Tokenizer behavior (`tokenize.ts`)

- Whitespace splits.
- `÷×—–` are standalone delimiters (`LAYOUT_SYMBOL_BREAK`).
- Lead `([{'"«“` and trail `)]}'"»”,.!?;:؟،؛` are **peeled** from the core token.
- QWERTY keys that are **letters on Arabic 101** (`[ ] ' ; , . / \``) are **not** peeled — they remain in `token` for remap (`hsjo]lj`, `i,`).

### Intentional symbol vs layout error

| Family | Distinguishable today? |
|---|---|
| Arabic `؟` `،` `؛` vs English `?` `,` `;` | Tokenized as trail; `;` can also be shell-skip. **No** “this `?` is leftover English keyboard in Arabic” hypothesis unless it is inside a remappable word. |
| `+ - = _ / \ | ( ) [ ] { } < > : ; " ' , . ? ! @ # $ % & * ~ \` ^` | Mostly delimiters or part of URL/email/code regex. `[` `]` `;` `,` `.` `/` `'` `` ` `` can be **Arabic letters** under remap. |
| Programming / math / currency | No symbol-intent class. `$100` / `100%` not specially classified except digits on `100`. |
| Hyphen vs dash | `—–` break tokens; hyphen stays in words (`kebab-case` → `code-identifier` via FILE_EXT or leftover). |

**Punctuation can provide evidence** (Shift glyphs, AR_LETTER_PUNCT) **and** can be a **false-positive trigger** when a user types `file.txt` or `i,` as English. Commit still requires Arabic lexicon on the remap — that is the main brake, not a symbol policy.

**Manual / Speed Box** remaps more freely (user asked). Auto must not treat the same tables as permission.

---

## 11. Technical Writing

Lexicon hits (lowercase): `api`, `ui`, `ux`, `git`, `github`, `python`, `laravel`, `react`, `docker`, `openai`, `chrome`, `json`, `html`, `css`, …  

**Not** in the English writing lexicon (examples): `deploy`, `sdk`, `llm`, `rag`, `graphql`, `localhost`, `npm`, `composer`, `fastapi` is in lexicon, `postgresql` is.

`tokenKind` protections:

- `ALL_CAPS` → `API`, `SDK`, `UI`, `UX`, `LLM`, `SQL`, `PHP` (also `OK`, `ID`)
- `VERSIONISH` → `v1.2.3`, `GPT-5` style
- camelCase / PascalCase / snake_case
- `FILE_EXT`, dotted identifiers
- `SHELL_TOKEN` includes `docker` as **shell** (skip) — same word is also in English lexicon; skip wins for that token in safety

**Corruption risk:**

| Mechanism | Can it corrupt tech tokens? |
|---|---|
| Layout auto | **No** if `protectedKind` or English lexicon `VALID`. **Yes** if unknown Latin remaps to an Arabic word. |
| Instant spell | Only listed typos; `dont`→`don't` can harm identifiers if not skipped (`isSafeToken`). |
| Remote grammar (legacy) | **Yes** — whole-segment rewrite. |
| Translation of mixed sentence | **Yes** — no chunk preserve. |
| Chunking | Protects **layout** per token; **does not** protect translation/correction ranges. |

**UI / Ui / ui / UX:** case does not change language. `UI`/`UX`/`API` skip layout. `ui`/`ux`/`api` are English lexicon → `VALID`. `Ui` is not ALL_CAPS (length 2 but not `^[A-Z]{2,}$` if second is lower) — `Ui` may be treated as normal Latin; `isEnglishWord('Ui')` is true via lowercasing.

**GitHub / github / GITHUB:** Pascal → protected; lower → lexicon; ALL_CAPS → protected.

---

## 12. Code / URLs / Emails

### Token / field policy today

| Category | Token skip | Field skip | Recommended policy (not implemented as such) |
|---|---|---|---|
| Email token | `email` | `type=email` field | **IGNORE** auto; shortcut only if user selected and safety allows |
| URL / host/path | `url` | `type=url` field | **IGNORE** auto |
| JWT / UUID / hash / API key / bearer / env secret | yes | password/otp/payment fields | **IGNORE** always |
| File path / shell meta / `sudo`… | yes | console class | **IGNORE** auto; shortcut dangerous |
| camelCase / Pascal / snake / `__dunder__` / `a.b.c` | `code-identifier` | Monaco/CM/PRE/CODE | **IGNORE** auto |
| `const userName = "Ali";` | identifiers protected; `const`/`Ali` may not be | If not in a code editor, **layout/grammar can touch** string literals and keywords | **SUGGEST** or **SHORTCUT ONLY** in prose fields; **IGNORE** in code editors (tier 4 already blocks auto) |
| `php artisan migrate` / `npm install` | `php` ALL_CAPS no; `npm` unprotected; `artisan` unknown; `install` lexicon | — | **SHORTCUT ONLY** / **IGNORE** auto — looks like English to `detectEnglish` if function words appear |
| `https://example.com/api/v1` | URL skip | — | **IGNORE** |
| JSON / HTML / CSS / SQL blobs | partial regex | code region | **IGNORE** auto |
| Function/variable names in chat | camel/Pascal skip; `foo` does not | — | **SUGGEST** if English prose; **IGNORE** if identifier-shaped |

**Do not assume all code should be ignored** in a GitHub issue written as prose. The correct policy is **scope-based**:

- **Code editor / markdown fence / shell field** → no auto write (already mostly true for editors).
- **Prose with embedded spans** → protect spans, assist the rest.
- **User-selected convert** → allowed through Write Gate.

Enforce **does not** parse markdown fences (`isInsideMarkdownCode` is legacy layout only).

---

## 13. Names / Abbreviations

**No NER, no gazetteer, no “don’t correct names” list** in the decision engine.

- Arabic names in Latin (`Ahmed`, `Al-Qahtani`) — unknown or hyphenated; layout may fire if remap is Arabic.
- English names in Arabic script — Arabic lexicon miss → possible reverse map to English if remap is an English word (**unsafe**).
- Transliterated names — collide with Arabizi regex if they contain `7`/`3`/…
- Universities / brands — only if in the tiny English list.

Layout **personal exceptions** (manual + revert threshold in `trust.ts`) are the only “don’t touch this token” memory — **not wired** to `analyzeFieldText`.

Abbreviations: `ALL_CAPS` over-protects; mixed-case abbrevs (`Api`) can be instant-spelled or grammatically rewritten in legacy mode.

---

## 14. Arabizi

```text
ARABIZI_HINT = /(?:^|[\s])(?:[a-z]*[23759][a-z0-9]*|[a-z]{2,}7[a-z]*)/i
```

plus: Latin, no Arabic, **not** `isEnglishWord`.

| Example | Flagged? | Then |
|---|---|---|
| `mar7aba` | Yes | `hasArabizi` → **noop**, blocks English |
| `keefak` | No | Unknown Latin; layout or noop |
| `ana bdi aroo7` | `aroo7` yes | Whole-field Arabizi dominant |
| `inshallah` | No | Unknown / English-looking |
| `shukran` | No | Same |
| `h8` / leetspeak | Possible | False Arabizi |
| `error` | English word | Not Arabizi |

**Should Arabizi be translated / corrected / ignored?**  
Product: **do not auto-translate or auto-“correct” into MSA/English** without an explicit command. Current **noop** is the right *action family*, but the **detector is too weak and too trigger-happy**, and it **blocks** legitimate English (`agent007` style) without offering a suggestion.

**Confusion with typo / wrong keyboard / tech:**  
`l33t` and ticket IDs collide with digits. Wrong-keyboard Arabic does **not** look like Arabizi (it looks like QWERTY punct+letters). The engine does not compare those hypotheses.

---

## 15. User Corrections

### What happens mechanically

| User behavior | System |
|---|---|
| Types → engine writes | `generation` bump on next USER input; cooldown 450ms but **cleared on bump** |
| Types → suggestion (legacy card) → edits | Card stale-check (`invalidateCardIfStale`); dismiss records **learning event**, not engine memory |
| System corrects → user changes one word | New field text; **no span-level “user override”** in decide |
| System translates → user edits | `pruneTranslatedTags` drops range if hash ≠ slice; may **re-translate** if session still on and sentence still Arabic |
| Suggests → user keeps typing | Enforce re-runs every `input` |
| Async in flight → user deletes / pastes | `bumpGeneration` + `abortActiveRequest`; translation stale ticket check |
| Undo after layout | Legacy `trust.ts` can add **exception** after N reverts; **unified engine ignores exceptions** |

**The engine cannot infer “the user intentionally changed this”** beyond: *generation changed* (stale) and *translated hash mismatch*. It cannot prefer the user’s word over a new layout/grammar pass on the next pause.

This is a **first-class intent class** (`user_override`) that does not exist.

---

## 16. Paste / IME / Composition

### Paste

| Path | Paste |
|---|---|
| `LayoutScheduler` | `insertFromPaste` / `insertFromDrop` **ignored** |
| `startEnforceCoordinator` | **No `inputType` filter** — paste runs `runFieldCycle` |
| Correction legacy | Treats as input |
| Translation live | Treats as input when enabled |

Pasted Arabic/English/code/URL/email/large paragraphs are **not** a different intent class in the engine. They should be: **lower auto confidence**, prefer **suggestion**, run **token protection** harder, never treat paste as “just finished a word.”

Paste-over-selection is just new field text.

### IME / composition

**Supported:**

- `compositionstart` / `compositionend` on `document` (capture)
- `FieldSession.composing` + global `compositionDepth`
- `decideWriting` → `noop` + `composing`
- Enforce coordinator returns if `event.composing`
- Generation **not** bumped during composition (`shouldIgnoreInputForGeneration`)
- Active writes aborted on compose start

**Unsupported / incomplete:**

- **`compositionupdate` is not listened** (`OWNED_DOCUMENT_EVENTS` omits it)
- No Arabic-specific IME policy beyond the standard events
- No mobile-only path (extension is desktop Chrome/Edge)
- Broken IME that never fires `compositionend` can leave `composing` stuck (depth) or, if events never start, mid-glyph writes

**Can the engine modify text while composing?**  
If composing flags are honored: **no**. If a site’s IME does not fire composition events: **yes, same as normal typing.**

---

## 17. Context Window

### What one analysis cycle actually sees

| Item | Available? |
|---|---|
| Current character | Only as part of full field string |
| Current word / all tokens | Yes, tokenizer over **entire field** |
| Previous / next word | Implicitly in the token array; **unified layout hint uses whole field**, not ±3 |
| Sentence | Translation only (`lastCompletedSegment` to caret) |
| Previous sentence | Only as leftover field text, not structured |
| Whole field | **Yes — this is the default unit for analysis and English** |
| Previous user actions | `lastInputAt`, `lastWriter`, last committed snapshot — **unused by decide** |
| Field history of text | No |
| Session history | WeakMap per element; lost when element dies |
| Mode / policy / site / editor type | Yes (`FieldContext`) |
| Previous corrections | Learning store / layout events — **not in analysis** |
| Translation state | Session id, pause, tagged ranges |
| Keydown shift for this burst | On EventBus, **not in FieldContext** |
| Selection | Not read in `runFieldCycle` |
| Caret | Translation sentence; layout completeness in **legacy** planner only |

**The Decision Engine does not have a sliding linguistic window.** It has **the current value of the field** plus **a handful of session flags**.

---

## 18. User Learning

### Writing-decision learning (individual user)

| Question | Answer |
|---|---|
| Repeated `API` / `UI` / `deploy` / `error` learned as intentional English? | **No** for the engine. `error`/`api` happen to be in a **global** lexicon. `deploy` is not learned. |
| Repeated reject → stop suggesting? | **Correction:** reject → `recordCorrectionRejected` (learning/practice). **Not** consulted by `decideWriting` or instant spell. **Layout:** ignore/revert → exception list on **legacy** path only. |
| Repeated accept → prefer that fix? | Learning events stored (including **sample text**). Not a decision prior. |

**Honest statement:** Flowlary has **learning memory for the education product** and a **layout exception list for the old scheduler**. It does **not** have a personal writing-intent model.

---

## 19. Hypothesis Engine Gap

### Example: `design engain`

| Hypothesis | Plausible? | Represented? | Typical outcome |
|---|---|---|---|
| H1 English spelling (`engine`) | Yes | No (not in typo map; `detectEnglish` fails) | Miss |
| H2 Wrong Arabic keyboard | Only if remap ∈ Arabic lexicon | Single layout candidate or none | Usually miss |
| H3 Intentional mix / name | Yes | No | — |
| H4 Translate | No signal | Only if Arabic + session | No |
| H5 No action | Default | `noop` `no_candidates` / `low_confidence` | **Yes** |

### Required vs actual

| Capability | Spec / desired | Code |
|---|---|---|
| Candidate generation | Multiple actions | Up to 3 capability bags; many layout chunks but **one winner** |
| Hypothesis comparison | Score H1 vs H2 | **Priority if/else** |
| Confidence | Calibrated | Constants |
| Abstention | First-class | `noop` / dead `suggestion` |

**Architectural gap:** there is no `Hypothesis[]` with `{ intent, span, transform, localScore, conflicts[], needsLlm }`. `CandidateAction` is a **capability ticket**, not an interpretation of the user.

Until that exists, an LLM cannot be “an advisor” — there is nothing structured to advise on except raw text.

---

## 20. LLM Decision Architecture Comparison

### Architecture A — Rules only (current + tighten)

`Observation → Rules → Decision → Write Gate`

| Dimension | Assessment |
|---|---|
| Accuracy | High on **lexicon layout** and **protected tokens**. Poor on mixed, names, Arabizi, `design engain`, unknown tech. |
| Latency / cost | Best (local). |
| False positives | Layout lexicon collisions; translation of mixed sentences; paste-in-enforce. |
| False negatives | Most interesting bilingual cases. |
| Safety | Predictable if rules stay conservative. |
| Debuggability | Excellent (`reasonCodes`). |
| Privacy / offline | Best. |
| Failure recovery | N/A for LLM; still stale/async for translation. |
| UX | Feels “dumb but fast” — user still thinks about keyboard for everything not in the list. |

**Ceiling:** you can add thousands of lexicon entries and still lose to productive morphology, names, and novel tech.

### Architecture B — Rules + LLM advisor (recommended)

`Observation → Local analysis + candidates → (optional) LLM interpretation → Decision Engine chooses among candidates → Policy Guard → Write Gate`

LLM input: structured packet (chunks, hypotheses, allowed actions).  
LLM output: **ranked hypothesis ids + reasons**, not free-form replacement (replacement still from `mapLayout` / user-confirmed translate / grammar module).

| Dimension | Assessment |
|---|---|
| Accuracy | Local layer keeps mechanical wins; LLM helps **when two local hypotheses score close** or mix/Arabizi/typo collide. |
| Latency / cost | Pay only on ambiguous cycles; never per keystroke. |
| False positives | Controllable if LLM **cannot invent a new action** and cannot write. |
| False negatives | Lower than A for linguistic ambiguity. |
| Safety | Policy + gate unchanged; LLM timeout → abstain. |
| Predictability | Medium — must constrain schema and validate against local scores. |
| Debuggability | Need decision record (local scores + LLM vote + winner). |
| Privacy | Send **minimum span + chunk types**, not whole page, not history dump. |
| Offline | Degrade to A (noop/suggest). |
| UX | Fast default; “thinking” only when needed; suggestions when uncertain. |

### Architecture C — LLM as final decision-maker

`Observation → LLM → Action`

| Dimension | Assessment |
|---|---|
| Accuracy | Unstable on short tokens; overconfident on mix; may “helpfully” translate unsolicited Arabic. |
| Latency / cost | **Unacceptable** on every `input` (enforce already fires that often). |
| False positives | High (hallucinated intent). |
| Safety | Conflicts with Write Gate if the model picks `layout_fix` against local evidence. |
| Predictability / debug | Worst. |
| Privacy | Worst (raw field every time). |
| Offline / timeout | Product dies or flickers. |

**Rejected for Flowlary.**

### Architecture D — LLM-first hybrid (mentioned for completeness)

Same as C with a local veto. Still **wrong default**: local evidence is cheap and **better** than an LLM for physical-key remap. Using an LLM to rediscover `hsjo]lj` → `استخدمت` is waste and delay.

---

## 21. Confidence / Calibration

**There is no empirical calibration.** No held-out bilingual set drives the `0.85` layout threshold. Shadow-mode comparison types exist (`ComparisonClass`) but do not publish precision/recall.

Research caveat (as requested): **an LLM saying 0.95 is not a 5% error rate.** If Flowlary adds model confidence, it must be **mapped through observed outcomes** (accept, undo, immediate revert, false-positive reports) **per capability and per trigger**.

Useful future calibration units (concept only):

- Layout auto: undo/revert rate within N seconds
- English auto: same
- Translation auto: edit distance user applies after write
- Suggestion: accept vs dismiss vs ignore
- Abstention: later explicit shortcut on same span (false negative)

Until those exist, **low/ambiguous must remain non-writing**.

---

## 22. Abstention

**Exists in form:** `noop` is a first-class action with reason codes. Spec: *noop is success.*

**Exists in spirit only for suggestions:** `suggestion` is returned and **not shown** in `runFieldCycle`.

**Missing:** explicit `uncertain` with UI (“Did you mean layout vs typo?”). Mixed and Arabizi abstain **silently** — the user gets no help on the English clause they needed.

**Operational rule that is already correct:** low/ambiguous must not auto-rewrite. **Enforcement is incomplete** because translation `high` is “session exists,” not “intent is translate,” and layout `high` is “lexicon hit,” not “user wanted a fix.”

---

## 23. Routing Architecture

**Should Flowlary use staged routing?** **Yes.** Enforce-on-every-`input` already proves that a **per-keystroke LLM is impossible**.

Recommended stages (concept):

| Stage | Job | Today |
|---|---|---|
| 1 Cheap local | Tokenize, protect, script, lexicon, mapLayout | Yes (partial) |
| 2 Deterministic candidates | Generate H1…Hn with spans | Partial (capability tickets) |
| 3 LLM only if conflict / residual unknown | Rank or fill missing linguistic hyp | **No** (legacy layout AI is unstaged fallback-on-miss, not conflict) |
| 4 Policy guard | Session, helpStyle, excludes, mix policy | Partial |
| 5 Write Gate | Only writer | Yes for pipeline; Speed Box still a hole (prior audit) |

Router literature applies: **do not send every event to the expensive expert.** Flowlary already has a cheap expert (key tables). The gap is **when to escalate**, not “use LLM for layout.”

---

## 24. Failure-Mode Matrix

| Failure | Mechanism today | Severity |
|---|---|---|
| False layout correction | Lexicon collision; unknown Latin→Arabic word; paste-in-enforce | High |
| False English correction | Instant map (`hwo` vs layout); legacy grammar | High |
| False translation | Session on + any completed Arabic sentence, including greetings and mix | High |
| Missed layout | Unknown words; short tokens; mixed cycle stolen by other rules | Medium |
| Missed English | Function-word gate; mix noop; tiny typo list | High |
| Missed translation | No session; incomplete sentence | Intended / Medium |
| Mixed-language corruption | Translate-all; layout token in mixed sentence | High |
| Technical-term / name / punct / caps / symbol / code / URL / email corruption | Translation blob; legacy grammar; incomplete skips | High |
| Stale async overwrite | Mitigated by generation + translation ticket; `allowActiveEdit: true` still risky | High |
| Self-trigger loop | SYSTEM origin ignored; cooldown; still possible if origin leaks | Medium |
| Suggestion stale | Cards legacy-only | Medium |
| Wrong field / mode / origin | Policy vs live flags; boot race (prior audit) | High |
| LLM hallucination / overconfidence / disagree with local | Legacy layout AI can write; engine unused | High if expanded |
| LLM timeout / unavailable / malformed | Legacy skip; translation catch → noop | Medium |
| User edits during AI | Abort/stale | Medium |
| Mid-sentence language/keyboard change | Not modeled | High (product) |
| Intentional nonsense / foreign word | Lexicon may still “fix” | Medium |

---

## 25. 100+ Edge Cases

Conventions: **Conf** = expected band if a future calibrated engine existed (`high` / `mid` / `low` / `abstain`). **UI** = what the user should see. **Enforce today** is noted when it differs.

Unless stated: textarea, EN↔AR layouts enabled, `helpStyle=auto`, translation session **off**, not composing, tier 1.

| # | Input | Context | Expected intent | Expected action | Forbidden | Conf | UI |
|---|---|---|---|---|---|---|---|
| 1 | `مرحبا كيف حالك؟` | Chat | Write Arabic | NOOP | TRANSLATE | high | none |
| 2 | same | Translation mode on | Translate sentence | TRANSLATE after boundary | Layout/English | mid | optional undo |
| 3 | `hello how are you?` | Email | Write English | NOOP or light English | Translate/layout | mid | none unless weak English |
| 4 | `hsjo]lj` | After space | AR on EN keyboard | LAYOUT | Instant `hwo`-style | high | flash/undo |
| 5 | `hwo` | Isolated | Ambiguous typo vs layout | NOOP or SUGGEST both | Auto either | abstain | chip |
| 6 | `design engain` | Docs | English typo *engine* | SUGGEST spelling | Layout if Arabic remap weak | mid | card |
| 7 | `أنا عملت deploy` | Chat | Mix; `deploy` foreign | NOOP / preserve token | Remap `deploy`; translate-all | mid | none |
| 8 | `فيه error` | Chat | Mix; `error` foreign | Preserve | Translate `error` | high | none |
| 9 | `أريد API key من GitHub` | Slack | Mix + identifiers | Preserve tokens; optional AR polish only | Rewrite `API`/`GitHub` | mid | none |
| 10 | `Python + Laravel` | Arabic Q | Tech list | NOOP | Layout on `+` | high | none |
| 11 | `UI UX` | Arabic sentence | Acronyms | IGNORE tokens | Spell `Ui` | high | none |
| 12 | `ui ux` | Arabic sentence | Same | IGNORE or preserve | Translate | mid | none |
| 13 | `Api` | Prose | Acronym casing | NOOP | `Api`→`API` auto | abstain | suggest |
| 14 | `GITHUB` | Prose | Caps lock or acronym | NOOP | Layout | abstain | none |
| 15 | `github` | Arabic | Product | Preserve | Remap | high | none |
| 16 | `mar7aba` | Chat | Arabizi | NOOP | Translate/correct | mid | optional suggest |
| 17 | `inshallah` | Chat | Loan / Arabizi | NOOP | English correct | mid | none |
| 18 | `shukran` | Chat | Same | NOOP | — | mid | none |
| 19 | `keefak` | Chat | Arabizi no digits | NOOP | Layout if Arabic hit | abstain | suggest |
| 20 | `ana bdi aroo7` | Chat | Arabizi | NOOP | — | mid | none |
| 21 | `l33t` | Handle | Leet / id | IGNORE | Arabizi | mid | none |
| 22 | `user@example.com` | Any | Email | IGNORE | All auto | high | none |
| 23 | `https://example.com/api/v1` | Any | URL | IGNORE | — | high | none |
| 24 | `127.0.0.1` | Any | IP | IGNORE | — | high | none |
| 25 | `192.168.1.1` | Any | IP | IGNORE | — | high | none |
| 26 | `.env` | Docs | Filename | IGNORE | — | high | none |
| 27 | `npm install` | Issue | Command | IGNORE auto | English polish | mid | shortcut ok |
| 28 | `php artisan migrate` | Issue | Command | IGNORE auto | — | mid | shortcut ok |
| 29 | `const userName = "Ali";` | CE not code-editor | Code in prose | IGNORE identifiers | Layout `const` | mid | suggest only |
| 30 | same | Monaco | Code | IGNORE | All | high | none |
| 31 | `sk-abc…` | Any | Secret | IGNORE | — | high | none |
| 32 | `Bearer eyJ…` | Any | Auth | IGNORE | — | high | none |
| 33 | `v1.2.3` | Changelog | Version | IGNORE | — | high | none |
| 34 | `GPT-5.6` | Prose | Product | IGNORE | — | high | none |
| 35 | `3D` | Prose | Token | IGNORE/NOOP | — | mid | none |
| 36 | `$100` | Prose | Money | NOOP | Layout `$` | mid | none |
| 37 | `100%` | Prose | Percent | NOOP | — | high | none |
| 38 | `1,000` vs `1.5` vs `1,5` | Locale | Number | IGNORE | Language switch | high | none |
| 39 | `2026` | Date | Digits | IGNORE | — | high | none |
| 40 | `هل؟` with EN `?` | AR sentence | Punct layout | SUGGEST | Auto if ambiguous | abstain | chip |
| 41 | `مرحبا?` | Same | Same | SUGGEST | Auto | abstain | chip |
| 42 | `hello؟` | EN sentence | AR punct leftover | SUGGEST | Auto translate | abstain | chip |
| 43 | `i,` isolated | — | `هو` vs `i,` | NOOP | Auto | abstain | none |
| 44 | `i,` next to Arabic | — | Likely `هو` | LAYOUT or SUGGEST | — | mid | undo |
| 45 | `file.txt` | — | Filename | IGNORE | Layout `.` | high | none |
| 46 | `a/b` | Path-ish | Ambiguous | NOOP | — | abstain | none |
| 47 | Shift `÷` mid word | AR keyboard | Symbol break | Do not glue | Treat as letter | mid | none |
| 48 | Caps `HELLO` on EN | Shouting | English | NOOP | Layout | mid | none |
| 49 | `Ok` / `OK` / `ok` | Chat | Discourse | NOOP | Code-skip hiding help | mid | none |
| 50 | `Ahmed` in EN sentence | Name | Preserve | NOOP | Spell | mid | none |
| 51 | `أحمد` in EN sentence | Name | Preserve | NOOP | Translate unless session | mid | none |
| 52 | `Al-Qahtani` | Name | Preserve | NOOP | Layout hyphen | mid | none |
| 53 | Quoted `"hello"` inside AR | Quote | Preserve or layout inner | Do not strip quotes | Translate quote unmarked | mid | none |
| 54 | Paste 3 paragraphs AR | Paste | Review | SUGGEST / NOOP auto | Immediate translate | low | banner |
| 55 | Paste code block | Paste | IGNORE | Auto layout | — | high | none |
| 56 | Paste URL | Paste | IGNORE | — | high | none |
| 57 | Paste mix | Paste | Mixed | NOOP auto | Translate-all | low | suggest |
| 58 | Type then paste over selection | — | New doc | Reanalyze; no stale write | Apply old ticket | — | none |
| 59 | IME composing Arabic | composition | Wait | NOOP | Any write | high | none |
| 60 | `compositionend` | — | Analyze once | One cycle | Write during compose | high | none |
| 61 | Rapid burst | Chat | Unfinished | NOOP mid-token | Instant last word | mid | none |
| 62 | Slow pause mid-word | — | Unfinished | NOOP | — | mid | none |
| 63 | Space after `hsjo]lj` | — | Commit layout | LAYOUT | English | high | undo |
| 64 | Enter after Arabic greeting | Translation on | Translate | TRANSLATE | — | mid | undo |
| 65 | Enter after Arabic greeting | Translation off | Write | NOOP | TRANSLATE | high | none |
| 66 | Shortcut translate | Any AR | Explicit | TRANSLATE | Need session flag | high | result |
| 67 | Speed Box translate | Box | Explicit | TRANSLATE via gate | Direct `.value` | high | box |
| 68 | Chip pause | Session | Stop live | NOOP translate | Live still runs | high | chip |
| 69 | User undoes layout | — | Override | Exception / NOOP next | Re-apply same | high | none |
| 70 | User edits one word of translation | — | Override span | Do not re-translate span | Full sentence again | mid | none |
| 71 | User edits grammar output | — | Override | Do not re-correct same | Loop | mid | none |
| 72 | Async translate, user deletes field | — | Cancel | STALE | Write empty | high | none |
| 73 | Two fields, switch | Focus | New context | No write to old | Cross-field | high | none |
| 74 | Mode switch mid-sentence | Policy | Honor new | No leftover session write | — | mid | none |
| 75 | `this is fine` | EN | No help | NOOP | Grammar churn | high | none |
| 76 | `teh cat` | EN | Typo | Instant or suggest | Layout | mid | undo |
| 77 | `recieve` | EN | Typo | Same | — | mid | undo |
| 78 | French `bonjour merci` | Latin | Not EN | NOOP English | Correct as EN | high | none |
| 79 | AR + French | Mix | NOOP auto | Layout French→AR | — | mid | none |
| 80 | `localhost` | Tech | Preserve | IGNORE | — | high | none |
| 81 | `composer require` | PHP | Command | IGNORE auto | — | mid | none |
| 82 | `OpenAI` | Brand | Preserve | — | mid | none |
| 83 | `FastAPI` | Brand | Pascal skip | — | high | none |
| 84 | `REST` / `GraphQL` | Acronym | Preserve | Translate | high | none |
| 85 | `RAG` | Acronym | Preserve | — | high | none |
| 86 | `userName` | Ident | IGNORE | Spell | high | none |
| 87 | `user_name` | Ident | IGNORE | — | high | none |
| 88 | `user-name` | kebab | IGNORE / ambiguous | — | mid | none |
| 89 | `SCREAMING_SNAKE` | Ident | IGNORE | — | high | none |
| 90 | Unfinished `hel` | — | Compose | NOOP | `hello` guess | high | none |
| 91 | Intentionally `asdfgh` | Mash | NOOP | Layout if Arabic word | abstain | none |
| 92 | `td` isolated | Short | NOOP | `في` | high | none |
| 93 | `td` beside Arabic | Short | Possible `في` | SUGGEST | Auto optional | mid | chip |
| 94 | Selection of one wrong word | Select | Fix span | Only that range | Whole field | high | — |
| 95 | Undo then redo | History | User control | Do not fight | Re-auto | high | none |
| 96 | `but I need a small change` after Arabic clause | Mix | Help English clause only | SUGGEST English | Translate AR or noop-all | mid | card |
| 97 | GitHub issue body | Site | Prose+code | Protect fences | — | mid | none |
| 98 | WhatsApp Web | Chat | Casual mix | Conservative | Aggressive live | mid | none |
| 99 | Search box | Short query | Often NOOP | Auto rewrite | high | none |
| 100 | Password field | Safety | IGNORE | All | high | none |
| 101 | OTP | Safety | IGNORE | — | high | none |
| 102 | `flowlary` brand | Name | Preserve | Spell | mid | none |
| 103 | `UAE` | Acronym | Preserve | — | high | none |
| 104 | `PhD` | Abbr | Preserve | — | mid | none |
| 105 | Emoji `👍 جاهز` | Mix | NOOP | — | high | none |
| 106 | `w/` slang | EN | NOOP | Layout | mid | none |
| 107 | `b4` | Arabizi vs slang | Abstain | Auto | abstain | chip |
| 108 | Right-to-left mark only | Invisible | NOOP | — | high | none |
| 109 | Duplicate spaces | — | NOOP | — | high | none |
| 110 | User types Flowlary output again | AB | Treat as user text | Do not special-case unless tagged | Re-translate | mid | none |
| 111 | After layout, user adds English | AC | New mix | Do not re-layout English | — | mid | none |
| 112 | `هل يمكن إصلاح الـ API؟` | Mix | Preserve API | Translate AR only if session | Translate API | mid | undo |
| 113 | Caps Lock Latin on AR intent | M | Unknown | Abstain | Confident layout | abstain | chip |
| 114 | `Shift` held for `!` on wrong layout | L | Symbol | Abstain unless full remap word | — | abstain | none |
| 115 | Large paste then type | Z+type | Paste conservative | Don’t layout whole paste | — | low | none |

Cases 1–115 are **specimens for a future golden set**, not claims that the current engine implements them.

---

## 26. Daily-Usage Scenarios

| Scenario | Typical mix | Safe default today | Needed intelligence |
|---|---|---|---|
| Email | Formal AR or EN | OK if monolingual | Clause-level English; no surprise translate |
| WhatsApp / web chat | Heavy mix, Arabizi, typos | Mixed = silence | Preserve loans; suggest not rewrite |
| Slack-like | Tech EN inside AR | Silence or translate-all | Token preserve |
| GitHub issue | Prose + fences + commands | Fences not seen in enforce | Fence + identifier policy |
| Technical docs | Terms, versions, code | Partial skips | Chunk translate |
| Academic AR–EN | Quotes, names, terms | Mixed noop | Never “correct” citations |
| Social | Emoji, slang | Mostly noop | Leave slang |
| Search / forms | Short | Tiny-sample skip helps | Never auto on queries |
| Support inbox | Mix + tickets | IDs may look Arabizi | Protect IDs |
| Coding in IDE | Tier 4 | Auto off | Keep off |
| Prompt writing | Mix + code | Dangerous translate | Session + preserve |
| URLs / filenames / commands | Structured | Regex | IGNORE auto |
| University comms | Names, titles | Name risk | Personal vocab |
| Casual vs professional | Register | No style model | LLM **style** only on explicit English improve |

---

## 27. LLM Cost / Latency Policy

**Do not call an LLM on every writing event.** Enforce already schedules on each `input`.

| When | LLM? |
|---|---|
| Never | Rejected — mixed/typo/Arabizi need *some* linguistic generalization |
| Only explicit shortcut | Acceptable **minimum product**; fails “type naturally” |
| Only low local confidence | **Yes**, if hypotheses exist |
| Only two hypotheses conflict | **Best trigger** |
| Only English quality | Grammar module, **after** layout excluded; not intent |
| Only translation | Output model, **after** intent=translate |
| Only ambiguous mix | **Yes** (chunk roles) |
| Hybrid | **Recommended** |

**Conceptual thresholds (do not hardcode in this audit):** escalate when (a) two local scores are within a small margin, (b) unknown Latin sits in an Arabic sentence and is **not** protected and **not** lexicon, (c) user explicit command needs ranking. **Never** escalate when local layout commit is lexicon-unique and unmixed.

Timeout → **abstain** (suggestion or noop), never write.

---

## 28. Privacy

### What would be sent if an advisor LLM were added

| Payload | Necessary? |
|---|---|
| Raw whole field | **No** (default). Too much; includes secrets the tokenizer missed. |
| Selected / hypothesized span | **Yes** (minimum). |
| Immediate neighbor chunks (types + hashes or short windows) | **Often** |
| Chunk classes (`protected:url`, `latin_unknown`, `arabic_lexicon`) | **Yes** — better than raw when possible |
| Site hostname | Only if policy differs; prefer **editor tier + field kind** |
| Previous corrections / history | **No** raw; optional **hashed vocab ids** later |
| User identity | **No** |

**Minimum necessary context:** span + local token classes + allowed action enum + layout remap string already computed + “session translate on/off.”

Learning events today **do store sample text locally** for the education product — that must **not** be reused as an LLM prompt dump.

---

## 29. Learning Signals (no raw text)

Signals that can improve future decisions **without storing field text**:

| Signal | Use |
|---|---|
| Suggestion accepted / dismissed | Calibrate capability prior |
| Undo / immediate edit / restore original | False-positive; add token **hash** to personal deny-list |
| Translation accepted vs edited (edit-distance bucket) | Session aggressiveness |
| Layout accepted vs undone | Already sketched in `trust.ts` — **wire to engine** |
| False-positive report | Gold negative |
| Shortcut after noop | False-negative (missed help) |
| Repeated token shape (hash of lowercased token) | Intentional foreign vocab |
| Site/editor tier + action | Context priors |

**Do not** upload raw text for this loop. Hashes + enums + lengths are enough for routing priors.

---

## 30. Personal Vocabulary

**Should it exist later?** **Yes** — this is how “thousands of cases” become personal without thousands of global rules.

| Type | Support later? | Current hook |
|---|---|---|
| Technical terms | Yes | English lexicon + exceptions (legacy) |
| Names / companies | Yes | None |
| Abbreviations | Yes | ALL_CAPS over-approx |
| Frequent mix tokens | Yes | None |
| Preferred translations | Yes | None (would be dangerous as auto) |
| Preferred English style | Yes | Learning events, not engine |

**Current architecture can support it later** as: `inExceptionList` / allow-list on chunks → force `VALID` / `protected` / `original_en`. The field is **already on `WritingChunk`** and **hardcoded false**. That is the extension point. Do not invent a second dictionary until it is read in `analyzeFieldText` and `decideWriting`.

---

## 31. Ideal Decision Record

| Field | Exists today? |
|---|---|
| `fieldId` | Yes |
| `generation` | Yes |
| `mode` / policy | Partial (`FieldContext`, not all on `WritingDecision`) |
| `chunks` | In-memory analysis; **not** on decision object |
| `hypotheses` | **No** |
| `selectedIntent` | **No** |
| `candidate` | `winnerCandidateId` |
| `confidence` | Yes (uncalibrated) |
| `uncertaintyReasons` | `reasonCodes` (partial) |
| `action` | Yes |
| `trigger` | Yes (`auto` only from decide) |
| `origin` | `textOrigin` (dominant, not per-span) |
| `risk` | **No** |
| `timestamp` | Analytics only |
| No raw text in analytics | **Mostly** (`writingAnalytics`); learning store **does** keep samples |

Ideal record (analytics): ids, enums, counts, hashes, scores, LLM used y/n, winner hyp id — **never** raw user text.

---

## 32. Recommended Architecture

### Decision on the four options

| Option | Verdict |
|---|---|
| Rules only | **Insufficient** as the long-term product for natural bilingual typing. Keep as **Stage 1–2 + offline fallback.** |
| **Rules + LLM advisor** | **Adopt.** |
| Rules + LLM final judge | **Reject.** Same failure mode as C with extra latency. |
| LLM-first | **Reject.** |

### Evaluation of the proposed stack

`LOCAL FAST LAYER → LLM INTELLIGENCE LAYER → POLICY GUARD → WRITE GATE`

| Layer | Prove / reject |
|---|---|
| Local fast | **Proven necessary.** Key tables + skips beat any LLM on `hsjo]lj`, URLs, secrets. |
| LLM intelligence | **Proven useful only as residual linguistic judge** among **local hypotheses**. Not proven as a writer or as a per-keystroke brain. |
| Policy guard | **Proven necessary.** Script≠translate already exists and must stay. |
| Write Gate | **Proven necessary.** Only writer. |

**Hypothesis accepted with amendment:**

The LLM is an **intelligence layer for ambiguity**, not a **decision layer for mutation**.  
`decideWriting` (or its successor) remains the only place that picks `action`.  
Write Gate remains the only place that mutates.

### Why not “just add more rules”?

Closed lexicons **do not generalize** to morphology, novel brands, names, or `design engain`. Rules **do** generalize for **mechanical** structure (key maps, URLs, IME, write safety). The split is:

- **Finite physical/world constraints** → rules (complete-able)
- **Open linguistic intent** → hypotheses + occasional LLM + user feedback (not enumerable)

---

## 33. Required Future Implementation

Audit only — ordered so each step is testable without boiling the ocean.

1. **Hypothesis object** on each cycle (even if LLM is off): at least `{layout, english_typo, intentional_en, intentional_ar, arabizi, translate, noop}` on **spans**, not only field flags.
2. **Chunk-aware mix policy:** preserve protected/lexicon English; never translate-all by default.
3. **Wire `inExceptionList` + revert trust into `analyzeFieldText`.**
4. **Paste class** in enforce (parity with legacy skip, then “suggest only”).
5. **User-override span** (generation + hash) so AC does not undo the user.
6. **Mount suggestion UI** so abstention is visible.
7. **Calibrate** using accept/undo (no raw text).
8. **LLM advisor** behind a router: structured I/O, validate vs local scores, timeout=abstain.
9. **Personal vocab** hashes.
10. **Keep grammar/translation models as producers**, invoked only after intent is chosen.

Do **not** start with “call Groq from `decideWriting`.”

---

## 34. Final Verdict

### 1. Does current Flowlary genuinely understand user intent?

**No.** It understands **policy flags**, **script/lexicon evidence**, and **a few mechanical mismatches**. It does not infer communicative intent.

### 2. What kinds of intent does it understand?

- “Assistant / capability / translation session is on” (settings)
- “This token remaps to a dictionary word” (layout)
- “This field is mostly English function words” (correction gate)
- “This token looks like a URL/email/secret/identifier” (skip)
- “IME is composing” (wait)
- “User hit a shortcut / Speed Box” (explicit)

### 3. What kinds does it miss?

Almost everything in the A–AC list that is not a clean lexicon remap or a protected token: **intentional mix, unknown tech, names, Arabizi without digits, English typos outside ~40 words, symbol/Caps ambiguity, paste vs type, edit-after-AI, clause-level help.**

### 4. Should an LLM participate in final decision-making?

**No — not as the final decider.**

### 5. If yes, exactly where?

**Only as a bounded advisor:** after local hypotheses exist, before policy/Write Gate, **never** as the function that returns `layout_fix` unvalidated, **never** as the sole source of a replacement string for layout.

### 6. Should the LLM be called for every writing event?

**No.**

### 7. How should ambiguous cases be handled?

Generate ≥2 hypotheses → if local scores disagree or residual unknown → **suggestion or LLM rank** → if still unclear → **NOOP**. Never auto-write mixed/unknown.

### 8. How should confidence be measured?

Against **outcomes** (accept, dismiss, undo, revert, later shortcut), per capability — not model softmax and not the current `0.85` constants.

### 9. How should the system learn from daily usage?

Hashed tokens + action enums + undo/accept; layout exceptions already sketched; **do not** feed raw fields to a cloud model by default.

### 10. Best balance of accuracy + latency + cost + safety?

**Staged local engine + rare LLM advisor + policy + Write Gate** (Architecture B).

### 11. What is missing before this is “context-aware bilingual writing intelligence”?

- Span-level hypotheses (not field-dominant origin)
- Mix-safe translation and English
- Paste / override / IME completeness in the **same** engine
- Visible abstention
- Calibrated confidence
- Personal vocab
- An advisor LLM that **cannot write**
- Decision records without raw text

Until then, the honest name is: **a conservative layout remapper with a policy-gated translator and a tiny English typo list**, not intent intelligence.

---

## Appendix A — Trace map (implementation)

| Claim | File |
|---|---|
| Priority decide | `extension/src/core/engine/decide.ts` |
| Mixed / Arabizi / origin | `extension/src/core/engine/chunks.ts` |
| Local candidates + hardcoded scores | `extension/src/core/engine/candidates.ts` |
| Context / no paste / no selection | `extension/src/core/engine/context.ts`, `writeGate/enforceCoordinator.ts` |
| Translate-all sentence | `candidates.ts` `translationCandidate`, `translation/segments.ts`, `pipelineTranslate.ts` |
| Exceptions unused | `chunks.ts` `inExceptionList: false` |
| Exception/revert learning | `features/layout/profile/trust.ts` |
| Token protection | `core/safety/tokenKind.ts` |
| Key maps | `features/layout/layouts/registry.ts`, `heuristics.ts` |
| English detector | `features/correction/language.ts` |
| Typo list | `features/correction/instantSpell.ts` |
| Composition | `core/input/InputEngine.ts`, `core/dom/composition.ts` |
| Layout LLM | `backend/src/providers/layoutClassifierProvider.ts` (legacy scheduler only) |
| Analytics no text | `core/observability/writingAnalytics.ts` |
| Learning stores text | `features/learning/recordCorrectionLearning.ts` |

## Appendix B — Section 33 product question

**Can we handle thousands of possibilities without thousands of rules?**

**Yes, if and only if** generalization is delegated to:

1. **Complete-able mechanics** (keyboard tables, token kinds, IME, write safety)
2. **Hypothesis + abstention** (unknown is not a write)
3. **Chunk roles** (one sentence, many intents)
4. **Occasional LLM ranking** of those roles
5. **Personal hashed vocab** from undo/accept

**No**, if the plan is either “enumerate every mix in `if` statements” or “let the LLM rewrite the field.”

That is the real architecture required for daily bilingual use.
