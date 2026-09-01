# Flowlary Extension Privacy Disclosure

**Purpose (single purpose):** Assist users while typing in web forms and editable fields: English writing correction, translation, keyboard-layout repair, and learning from writing patterns.

**Evidence:** `extension/manifest.prod.json`, `extension/src/content_script.ts`, product architecture docs.

---

## Permissions (release manifest)

| Permission | Required | Why | Used by |
|------------|----------|-----|---------|
| `storage` | Yes | Settings, auth tokens, learning data, AI cache | All features |
| `activeTab` | Yes | Shortcuts/popup actions on the active tab | Commands, popup |
| `clipboardWrite` | Yes | Speed Box “Copy result” | `copyText.ts` |

## Host permissions (release)

| Host | Why | Data accessed |
|------|-----|---------------|
| `https://api.flowlary.com/*` | Managed AI, auth, entitlement, learning sync | Text payloads per feature; tokens |

**Not declared:** `tabs`, `scripting`, `cookies`, `webRequest`, `externally_connectable`, `web_accessible_resources`.

## Content scripts

| Script | Matches | Behavior |
|--------|---------|----------|
| Main | `<all_urls>`, all frames | Injects writing assistance UI; reads focused editable fields when features run |
| Website bridge | `flowlary.com`, `*.flowlary.com` | Session import from website via origin-checked `postMessage` |

## Page content

Flowlary **reads and may modify text** in editable fields when you invoke or enable:

- Writing correction
- Translation / live translation
- Keyboard layout repair
- Speed Box (overlay; may not modify original field)

Flowlary does **not** read your full browsing history. It operates on the active field context after safety checks.

## Data transfer path

```
Focused field text (after safety gate)
  → chrome.runtime messaging
  → service worker
  → HTTPS api.flowlary.com
  → managed AI providers (Groq / Google Translate per backend routing)
```

Layout repair prefers **local** remapping; AI classification is fallback only.

## Local processing (no network)

- Keyboard layout conversion when mapping suffices
- Speed Box layout mode
- Safety gating, pause, exclusions
- Settings and UI state
- Bounded local history and cache (privacy-gated)

## Data stored locally

Namespaces under `flowlary.*` in `chrome.storage.local`:

- Auth tokens, install ID, entitlement cache
- Learning events, profile, practice (account-scoped when signed in)
- Settings, correction/translation/layout preferences
- AI response cache (hashed keys)
- Activity history (max 50 entries when allowed)

Theme: `localStorage` on extension pages (`flowlary-theme`).

## Data synced to server (signed in)

- Learning events (snippets + metadata)
- Learning profile and practice sessions
- Account entitlement and usage

## User controls

- Global pause and per-site exclusions
- Disable live translation (default off)
- AI consent prompt before managed AI
- Clear activity / learning / all local data (Settings → Data)
- Sign out (clears session tokens locally)
- Uninstall extension

## Authentication

Managed AI requires signed-in account JWT. Anonymous install tokens do not unlock managed AI (Phase 26 rule).

## Third-party processing

User text for AI features is processed by Flowlary’s backend and its configured providers (Groq, Google Cloud Translation). Provider retention is not controlled solely by Flowlary.

## Certification-oriented answers (draft)

| Question | Answer |
|----------|--------|
| Collects user data? | Yes — processes text you type when features run; account email when registered |
| Sells data? | No — no analytics/ads SDK in extension |
| Remote code? | No — MV3 bundled service worker; API responses are data not executable code |
| Privacy policy URL | `https://flowlary.com/privacy` |
| Support contact | `https://flowlary.com/contact` (no public inbox yet) |

**Status:** READY FOR SUBMISSION preparation — pending legal review and published support email.
