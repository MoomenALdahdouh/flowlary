# Unified Writing Assistant — User Flow

**Status:** Product contract (Wave A). Complements [unified-writing-decision-engine-spec.md](./unified-writing-decision-engine-spec.md).  
**Mental model:** One bilingual writing assistant. Three intervention types. One decision layer.

The user does not download “3 tools.” They download a helper that answers: *what do I mean right now?*

---

## 1. After install

1. The extension runs in the background. No 20-toggle wall.
2. **First Win** (popup): strongest, clearest win — fix wrong-keyboard typing with a shortcut. Skip is allowed.
3. **Three onboarding questions** (dashboard, first signed-in run):
   - Do you want to automatically fix the layout when you type in the wrong language?
   - Do you want to automatically improve English, or only on a shortcut?
   - Do you want Arabic → English writing mode (write Arabic, output English in the same field)?
4. After that, primary surfaces show: assistant on/off, the three capabilities, and shortcuts. Advanced stays buried.

Recommended new-install defaults: layout auto **on**, English **light auto + suggestion**, Arabic → English mode **off**.

---

## 2. Operating states (what the user understands)

| User language | Internal mapping |
|---|---|
| **Normal** | No translation session. `helpStyle` is `auto` or `suggestions`. Layout and light English may run. |
| **Translation** | Sticky `arabicToEnglishMode` / `TranslationSession` overlay. Translate first; optional light English polish after output is tagged. |
| **Manual** | `helpStyle: shortcuts_only`. Observe only; shortcuts and suggestion-accept still work. |

Translation Mode is explicit. Script detection never starts it. A 750ms pause on Arabic is not a session.

---

## 3. Daily field behavior

Every focused eligible field goes through: observe → analyze → one decision → suggest **or** apply → **cooldown**.

Decision order (intent-first):

1. Is this field valid? (password, exclude, unsupported editor → noop)
2. Is the user in Translation Mode or Manual?
3. Does the text look like a keyboard-layout mismatch?
4. Immediate fix, suggestion, or wait for shortcut?
5. Minimum intervention that keeps writing flow.

Only **one** capability writes at a time. After apply, cooldown blocks a second engine from rewriting the first result.

### Journey A — Layout error

User thinks Arabic is on; Latin garbage appears. The assistant detects mismatch and fixes the last word/segment (or offers a card / waits for shortcut). It does not translate or proofread first.

### Journey B — Weak English

Understandable English with spelling/grammar issues. Light instant fix or a small suggestion. Shortcut for a larger rewrite. Not a word-by-word review product.

### Journey C — Arabic intended as English

User turns on Translation Mode, writes Arabic, English appears in the same field or as an accept-able suggestion. Optional light polish only after the span is tagged `translated_output`, and only after cooldown.

### Journey D — Mixed

“Send me the الـ API key today” / “أنا عملت deploy لكن فيه error”. Chunk-level. Keep intentional foreign tokens. Do not treat the whole field as one language.

---

## 4. Suggestion vs apply

- **Auto** (`helpStyle: auto`): high-confidence layout and simple English may write in-field (Tier 1 only).
- **Suggestion** (`helpStyle: suggestions`): card under the field; user Apply / Dismiss.
- **Shortcut** (always available): user asked; Manual mode is this only.

Shortcuts remain first-class when the user does not want automation.

---

## 5. Settings (simple surface, deep when needed)

**Primary:** assistant on/off · help style (auto / suggestions / shortcuts only) · fix wrong typing · improve English · Arabic → English mode · excluded sites · shortcuts.

**Per capability (not first run):** last-word vs segment layout; English direct vs suggestion; translate in-field vs card; light polish after translate.

**Advanced:** debug, detection sensitivity, pause delay, command keys, engine mode.

Hidden from primary UI: per-feature `direct`/`box` triplicates, `liveEnabled` vs `shortcutEnabled` as separate products.

---

## 6. What the system decides without a toggle

Ignore password and sensitive fields. Honor excluded sites. Do not run Translation Mode unless enabled. Do not apply English correction to suspected layout text. Reduce intervention in very short fields, while composing, and while typing quickly. Auto-write only on honest editor tiers (Tier 1).

---

## 7. First-run sequence (summary)

```
Install → First Win (layout shortcut) → 3 questions → daily writing
                                                      ↓
                              Normal | Translation | Manual
                                                      ↓
                         one decision → suggest or apply → cooldown
```
