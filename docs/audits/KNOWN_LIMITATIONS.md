# Known limitations

Honest gaps. None of these are hidden by calling a unit test “support.”

## Real product limitations

- **Rich editors** (ProseMirror/Lexical/etc.): suggestion/shortcut, not generic auto-write.
- **Code editors** (Monaco/CM/Ace): blocked.
- **Shadow DOM / React-controlled fields:** best-effort; frameworks may overwrite.
- **Cross-origin iframes:** not processed.
- **Translation** requires user mode/session (not silent whole-page translate).
- **English help** is island-based, not a style rewriter.
- **JSON account store** is single-process; not a clustered database.
- **No in-repo CI.**
- **Website Writing Lab ≠ extension engine.**
- **Chrome Web Store URL** may still be unpublished (`null` in website config).

## Browser limitations

- `execCommand('insertText')` / `setRangeText` undo semantics differ by engine.
- MV3 service worker can sleep; review is async and abortable.
- Keyboard shortcuts may collide with OS/site bindings.

## Unsupported (do not claim)

- Auto-write into Gmail/Notion/Slack composers as if they were `<textarea>`.
- On-device generative understanding layer.
- Model voting / parallel consensus.
- LLM inventing keyboard layouts.

## Infrastructure

- `/ready` does not live-call Groq.
- Provider outage: local layout still works; review/translation degrade.
- Paddle sandbox ≠ live catalog.

## Test-environment

- **Default `npm test` is not fully green** on the extension workspace (obsolete scheduler/UI tests vs enforce pipeline). Shared and backend suites passed on 2026-09-01.
- Playwright SW intercept of writing-review is unreliable.
- Live eval tests are skipped without keys (by design).
- Some historical layout corpus cases fail; do not weaken `mapLayout` to paper over them.

## Product / future opportunities (not commitments)

- Dedicated rich-editor adapters.
- Multi-instance API + real DB.
- GitHub Actions.
- Published store listing and verified ratings.

Separate **future ideas** from **supported behavior**.
