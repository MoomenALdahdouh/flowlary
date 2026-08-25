# Extension merge report

Deep check of whether three local Chrome extension projects can ship as one:

- `Moomen/Projects/ai-writing-translator`
- `Moomen/Projects/autofix-layout`
- `Moomen/CursorProjects/english-writing-assistant`

**Date:** 25 Aug 2026  
**Verdict:** Conditional. Merge writing + translate into one extension. Do not merge all three as separate products until the unpublished repos are attached. Keep layout-as-product (and Adaptive Content Filter) separate.

This Origin workspace did not include the two unpublished folders. English Writing Assistant was cloned from public GitHub and reviewed in full.

## Run this report locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the printed URL (default http://127.0.0.1:43147).

## What was readable

| Source | Result |
| --- | --- |
| [MoomenALdahdouh/english-writing-assistant](https://github.com/MoomenALdahdouh/english-writing-assistant) | Cloned. Chrome MV3, TypeScript workspaces, Groq BYOK, v1.3.13. |
| `ai-writing-translator` on GitHub | 404. Not in the public repo list. |
| `autofix-layout` on GitHub | 404. Not in the public repo list. |
| [github.com/ZAIXOS](https://github.com/ZAIXOS) | Org exists. 0 public repos. |
| [zaixos.com/products](https://zaixos.com/products) | Clinic OS, Voice, Adaptive Content Filter only. |
| writing.zaixos.com | Empty HTTP response (landing not live). |

## English Writing Assistant (audited)

- Manifest V3, content scripts on all `http`/`https` pages, `storage` + Groq/API host permissions.
- Adapters for textarea, text input, contenteditable. Skips passwords and Monaco/CodeMirror/Ace.
- Service worker: LRU cache, abort, history, user Groq key (preferred) or local Hono `/api/correct` when unpacked.
- English-only detector; fields over 250 characters are ignored.
- Suggestion-box vs direct-edit modes; Shadow DOM correction card under the field.
- ~49 TS/TSX files and 17 tests. Last public push 16 Aug 2026.

This codebase is the natural merge host: adapters, debounce, Groq client, consent, and overlay can be reused.

## Unpublished projects (inferred only)

**ai-writing-translator** is likely another MV3 writing tool on the same fields. If so, it duplicates injection, storage, and API-key handling. Confirm: page vs selection vs input translation; overlay vs replace; storage key prefix; extra permissions.

**autofix-layout** is the uncertain one. If it only positions the overlay on RTL/mixed pages, fold it into `CorrectionCard`. If it mutates host-page CSS, it is a different Chrome Web Store purpose and should stay its own listing.

## Why a naive three-way merge fails

1. English-only skip vs translate (one feature disables the other unless you add a language pipeline).
2. Three content scripts on every page (double API calls, stacked UI, cursor fights).
3. Chrome Web Store single-purpose policy (writing help ≠ layout fixer ≠ content filter).
4. Storage prefixes (`ewa_*`) and three store IDs cannot be silently merged.
5. STORE.md still describes a hosted API; live code prefers BYOK. Pick one story.

## Recommended plan

1. Keep **english-writing-assistant** as the host. Add **Translate** as a mode next to Box / Direct.
2. Absorb autofix-layout **only** if it is overlay layout code.
3. Push the two local repos (private is fine) and re-run the audit against `manifest.json` + content-script entrypoints.

Do not combine this with Adaptive Content Filter.

The interactive version of this report is the Next.js app in this repository.

## Flowlary (merged extension)

The unified Chrome extension lives at:

```text
/Moomen/Projects/flowlary
```

(Same folder as `Moomen/Projects/flowlary` in this repo.)

Load unpacked extension from:

```text
/Moomen/Projects/flowlary/extension/dist
```
