# Editor support

Capability is detected on the **element**, not the hostname. File: `extension/src/core/dom/editorHost.ts`, `core/engine/context.ts` (`editorTier`).

| Surface | Auto-write | Suggestion | Shortcut | Notes |
| --- | --- | --- | --- | --- |
| `input` (safe types) | Yes if policy auto | Yes | Yes | Proven E2E |
| `textarea` | Yes | Yes | Yes | Proven E2E |
| Simple contenteditable (text/BR only) | Yes | Yes | Yes | Proven E2E |
| Nested / rich CE (ProseMirror, Lexical, Quill, Draft, Slate) | **No** | Prefer | Yes if safety allows | No generic offset inventing |
| Monaco / CodeMirror / Ace / `looksLikeCodeEditor` | **Blocked** | No | No | Treat as code |
| Password / hidden / sensitive probe | **Blocked** | No | No | Safety |
| Cross-origin iframe | Not processed | — | — | `shouldProcessFrame` |
| Shadow DOM | Host-dependent | — | — | No universal adapter |
| React-controlled value | Best-effort `setRangeText` / input events | — | — | Framework may overwrite; not claimed perfect |

`editorTier`: 1 = value fields, 2 = contenteditable, 4 = unsafe/code/unrecognized. Advisor and review refuse tier > 2. `decideWriting` noops `unsupported_editor`.

**Do not** add a site blocklist to fake editor support. Gmail-like composers: use suggestion/shortcut unless a real adapter exists. E2E nested `#ce-rich` expects **no** auto layout write.

Proven vs unit-only: see [../testing/RELEASE_MATRIX.md](../testing/RELEASE_MATRIX.md).
