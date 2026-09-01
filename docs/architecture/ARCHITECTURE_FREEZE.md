# Architecture freeze

Future work must **preserve** this shape. Adding features is allowed only if they plug into these layers — not around them.

## Stable (do not casually change)

1. **One InputEngine**, one EventBus, one enforce coordinator, one `runFieldCycle`.
2. **Write Gate is the only field mutator** on engine paths.
3. **`decideWriting` is the only auto-action chooser.** Policy may forbid; it may not invent a second chooser.
4. **`mapLayout` is the only keyboard mapping authority.** LLMs must not invent layouts. `layout_suspect` must match `mapLayout`.
5. **Advisor = ID ranking.** Never replacement text.
6. **Writing Review = island span edits**, async, Groq→Gemini→OpenRouter failure-only, first valid wins, no voting.
7. **Three capabilities, one pipeline:** layout, English, translation.
8. **Editor capability over site denylist.**
9. **User site exceptions** only.
10. **No production local SLM** (measured: no useful gain). Experiments stay out of `startWritingRuntime`.
11. **Learning records outcomes**; it does not silently override `decideWriting`.

## Experimental

- Advisor **apply** mode (suggestions from ranked IDs). Keep suggestion-only on the late tick.
- Optional Google Translate vs Groq translation routing.
- Dashboard learning coach / report narration.

## Deprecated (do not resurrect as auto writers)

- `CorrectionScheduler` EventBus auto-correct.
- `TranslationScheduler` EventBus live translate.
- `scheduleRemoteEnglishAssist` whole-field LLM.
- Independent `PIPELINE` as a fourth brain.

`CORRECT_TEXT` remains for Speed Box / practice / website lab — not auto typing.

## Not supported

- Generic safe offsets into ProseMirror/Lexical/Monaco.
- Parallel model voting.
- LLM full-field replacement as the English product.
- Hard-coded Gmail/Notion/Slack disable lists.

## Intentionally not implemented

- On-device generative “understanding layer.”
- Automatic translation of every Arabic field without a session/policy.

## What a future engineer must ask before changing freeze items

“Does this add a second writer, a second decision engine, or a second layout authority?” If yes, **stop**.
