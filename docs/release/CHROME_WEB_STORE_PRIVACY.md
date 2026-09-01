# Chrome Web Store — Privacy Disclosure Draft

Based on Flowlary extension code and `docs/legal/FLOWLARY_EXTENSION_PRIVACY_DISCLOSURE.md`. Review and adjust before submission.

## Single purpose

Assist users while typing in web forms and text fields: English writing correction, translation, keyboard-layout repair, and learning from writing patterns.

## Data handling summary

| Category | Handled? | Notes |
|----------|----------|-------|
| **Website content / user-generated text** | Yes | Text from focused editable fields when user triggers a feature or when enabled features run after safety checks |
| **Personally identifiable information** | Yes (limited) | Account email; user text may contain names/emails if typed in fields |
| **Authentication information** | Blocked in fields | Password/OTP fields blocked by safety gate; account auth stored separately |
| **Financial information** | No (blocked) | Payment fields blocked; Paddle handles checkout |
| **Health information** | Not targeted | User text could contain any content user types |
| **Location** | No | |
| **Browsing history** | No | Extension does not track browsing history; operates on active field only |
| **User activity** | Limited | Local usage/entitlement; server usage metadata (no text) |

## Remote services

| Service | Purpose | Data sent |
|---------|---------|-----------|
| **Flowlary API** (`api.flowlary.com`) | Managed correction, translation, layout classifier, auth, learning sync | Text per operation; tokens; learning snippets when signed in |
| **Groq** (via backend) | AI inference | Text segments and structured learning payloads |
| **Google Cloud Translation** (via backend, when configured) | Translation | Full translation text |

Legacy BYOK Groq key path is cleared on upgrade and is not part of the managed product surface.

## Local storage

Settings, history (max 50 entries), cache, learning data, auth tokens — `chrome.storage.local` under `flowlary.*`.

## User controls

- Pause extension
- Exclude domains
- Disable live translation (default off)
- Clear local data / learning
- AI consent before managed features
- Sign out / uninstall

## Certification questions (typical)

**Does your extension collect user data?**  
Yes. The extension processes text the user is actively typing to provide requested features. Text is sent to Flowlary’s API and configured AI/translation providers as described in the privacy policy.

**Is data sold?**  
No (based on current architecture — no analytics SDK in extension).

**Privacy policy URL**  
`https://flowlary.com/privacy`

**Support contact**  
`https://flowlary.com/contact` — dedicated support email not yet published (LEGAL/OPS INPUT REQUIRED).

## Permissions justification (for review)

- **`<all_urls>` content scripts** — assist typing in web apps, including same-origin iframes. Cross-origin iframes may be skipped at runtime.
- **`storage`** — settings, auth, learning, cache.
- **`activeTab`** — keyboard shortcuts and popup actions on the active tab.
- **`clipboardWrite`** — Speed Box copy result.
- **Host `api.flowlary.com`** — managed API only in release builds.

**Status:** READY FOR SUBMISSION preparation (not guaranteed approval).
