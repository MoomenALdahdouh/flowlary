# Flowlary 1.1.0 — Release Notes

Flowlary is a Chrome writing companion: keyboard layout repair, English writing correction, translation, and local learning — with Free, Trial, and Pro plans.

## What's included

### Keyboard Layout Repair (free forever)
- Automatic layout correction while typing (local-first)
- Manual fix with **Ctrl/Cmd+Shift+P**
- **Speed Box** overlay (**Ctrl/Cmd+Shift+L**)
- Support for multiple keyboard layouts including Arabic, English, Russian, Turkish, and more

### Writing Correction
- English grammar and spelling suggestions via **Flowlary AI** (account-backed)
- Suggestion card or direct-edit mode
- Local typo pass before AI

### Translation
- Manual translation: **Ctrl/Cmd+Shift+,**
- Optional **live translation** (default **OFF**)
- Shared daily Free AI allowance with correction (weights apply server-side)

### Learning & Practice
- Local learning profile and progress
- Practice sessions (full on Trial/Pro)
- Export / import of learning data (Trial/Pro)

### Safety & Privacy
- Safety gate before AI requests, cache writes, or history records
- Blocks passwords, OTP fields, code editors, secrets, and excluded domains
- Local activity history (bounded, user-deletable)
- Learning data stays local; AI text leaves the device only when a managed AI feature runs

## Plans

- **Free** — permanent local tools + limited daily AI + basic learning/progress
- **Trial** — 30-day full experience after account registration
- **Pro** — higher everyday AI limits + full learning, practice, advanced progress, export/import ($4.99/month or $39/year)

Pro is granted only after verified billing (payment partner webhook → server entitlement). Checkout success URLs do not grant Pro by themselves.

## Known limitations

- Managed AI uses `https://api.flowlary.com`
- Soft Pro safety caps may temporarily limit extreme usage
- Live translation is off by default
- Billing portal requires a prior successful subscription customer record

## Installation (unpacked)

1. Build: `npm run build:release`
2. Package: `npm run package:release`
3. Load the release zip contents (or `extension/dist/`) as unpacked in Chrome

## Migration

If you previously used English Writing Assistant, Lingo, or Layfix, Flowlary migrates compatible settings on first run. Legacy BYOK keys are retired; use a Flowlary account for AI.
