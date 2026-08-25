# Flowlary 1.0.0 — Release Notes

Flowlary is a unified Chrome extension for multilingual writing: keyboard layout correction, English writing improvement, and translation — in one product.

## What's included

### Keyboard Layout Fix
- Automatic layout correction while typing (local-first)
- Manual fix with **Ctrl/Cmd+Shift+P**
- **Speed Box** manual conversion overlay (**Ctrl/Cmd+Shift+L**)
- Support for 13 keyboard layouts including Arabic, English, Russian, Turkish, Hebrew, and more

### Writing Correction
- English grammar and spelling suggestions
- **Bring Your Own Key (BYOK)** — use your Groq API key; text goes directly to Groq, not Flowlary servers
- Suggestion card or direct-edit mode
- Local typo pass before AI

### Translation
- Manual translation: **Ctrl/Cmd+Shift+,**
- Optional **live translation** (default **OFF**; 750 ms debounce)
- 12 supported languages

### Safety & Privacy
- Safety gate runs before any AI request, cache write, or history record
- Blocks passwords, OTP fields, code editors, secrets, and excluded domains
- Unified local history (max 50 entries, user-deletable)
- Tiered cache to reduce repeat AI calls

## Known limitations

- Translation and layout classifier fallback require configured production APIs (`lingo-api.zaixos.com`, `flowlary-api.zaixos.com`)
- English correction requires a user-supplied Groq API key
- Live translation is off by default
- Client-side entitlement is not cryptographically verified
- Not submitted to Chrome Web Store in this phase (package prepared only)

## Installation (unpacked)

1. Build: `npm run build:release`
2. Package: `npm run package:release`
3. Load `release/flowlary-v1.0.0.zip` contents (or `extension/dist/`) as unpacked extension in Chrome

## Migration

If you previously used English Writing Assistant, Lingo, or Layfix, Flowlary migrates compatible settings on first run.
