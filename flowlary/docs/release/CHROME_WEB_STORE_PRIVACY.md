# Chrome Web Store — Privacy Disclosure Draft

Based on Flowlary extension code and `docs/privacy/PRIVACY.md`. Review and adjust before submission.

## Single purpose

Assist users while typing in web forms and text fields: keyboard layout correction, English writing correction, and translation.

## Data handling summary

| Category | Handled? | Notes |
|----------|----------|-------|
| **Website content / user-generated text** | Yes | Text from focused editable fields when user triggers a feature or when auto layout/correction runs after safety checks |
| **Personally identifiable information** | Potentially | User text may contain names/emails if typed in fields; not collected by Flowlary servers |
| **Authentication information** | No (blocked) | Password/OTP fields blocked by safety gate |
| **Financial information** | No (blocked) | Payment fields blocked |
| **Health information** | No | Not targeted; user text could contain any content user types |
| **Location** | No | |
| **Browsing history** | No | Extension does not track browsing history; operates on active tab fields only |
| **User activity** | Limited | Local usage/entitlement counters in extension storage |

## Remote services

| Service | Purpose | Data sent |
|---------|---------|-----------|
| **Groq API** (user BYOK) | English correction | Text segment + minimal context; user's API key in Authorization header |
| **Translation API** (`lingo-api.zaixos.com`) | Translation | Text, languages, mode |
| **Layout classifier API** (`flowlary-api.zaixos.com`) | Layout fallback only | Word token + short context when local mapping insufficient |

Groq API keys are stored locally in extension storage and are **not** sent to Flowlary-operated servers.

## Local storage

Settings, history (max 50 entries), cache, entitlement cache, migration state — stored in `chrome.storage.local` under `flowlary.*` namespaces.

## User controls

- Pause extension
- Exclude domains
- Disable live translation (default off)
- Clear history
- Remove Groq API key

## Certification questions (typical)

**Does your extension collect user data?**  
The extension processes text the user is actively typing to provide requested features. Text may be sent to third-party AI/API providers as described above. Flowlary does not operate a central server that receives user writing text in the BYOK correction path.

**Is data sold?**  
No (based on current architecture — no analytics SDK in extension).

**Privacy policy URL**  
**MISSING** — a public privacy policy URL must be published before store submission.

**Support contact**  
**MISSING** — support email or page not defined in repository.

## Permissions justification (for review)

- **`<all_urls>` content scripts** — assist typing in web apps, including same-origin iframes (e.g. email compose). Cross-origin iframes are skipped at runtime.
- **Host permissions** — HTTPS access to Groq and configured Flowlary/Lingo API endpoints only (production release build).
