# Flowlary

**Your AI Writing Companion**

Flowlary is a unified Chrome MV3 extension that combines three writing capabilities:

- **Keyboard Layout Fix** — local-first layout remapping (13 layouts)
- **Writing Correction** — English grammar/spelling (BYOK Groq)
- **Translation** — manual + optional live translation (12 languages)

Original source extensions remain read-only references; all product code lives in this folder (`Moomen/Projects/flowlary`).

## Structure

```
flowlary/
├── extension/        # Chrome MV3 extension (Vite + CRXJS)
├── packages/shared/  # Shared types and contracts
├── backend/          # Backend placeholder
├── tests/            # Unit & integration tests
├── release/          # Store-ready ZIP + checksum (generated)
└── docs/             # Architecture, privacy, security, release
```

## Development

```bash
npm install
npm run dev           # Extension dev server (localhost APIs)
npm run build         # Dev build → extension/dist/
npm test              # 458 tests
```

Load unpacked from `extension/dist/` in Chrome.

## Release packaging

```bash
npm test
npm run build:release   # Production manifest + HTTPS API defaults
npm run package:release # → release/flowlary-v1.0.0.zip + .sha256
```

See `release/RELEASE_CHECKLIST.md` before Chrome Web Store submission.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Shift+, | Translate |
| Ctrl/Cmd+Shift+P | Fix keyboard layout |
| Ctrl/Cmd+Shift+L | Speed Box (manual conversion) |

## Documentation

- [Architecture](docs/architecture/FLOWLARY_ARCHITECTURE.md)
- [Phases](docs/development/PHASES.md)
- [Privacy](docs/privacy/PRIVACY.md) · [Data flow](docs/privacy/DATA_FLOW.md)
- [Security](docs/security/SECURITY_ARCHITECTURE.md)
- [Release notes](RELEASE_NOTES.md)
- [Store description draft](docs/release/CHROME_WEB_STORE_DESCRIPTION.md)
- [Phase 15 report](PHASE15_REPORT.md)

## Status

**Version 1.0.0** — Phases 0–15 complete. Release ZIP prepared; **not published** to Chrome Web Store.

Release blockers: public privacy policy URL, support contact, store screenshots, production API verification.
