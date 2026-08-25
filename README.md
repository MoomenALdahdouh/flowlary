# Flowlary

**Your AI Writing Companion**

Flowlary is a unified Chrome MV3 extension that combines three writing capabilities:

- **Keyboard Layout Fix** — local-first layout remapping (13 layouts)
- **Writing Correction** — English grammar/spelling (BYOK Groq)
- **Translation** — manual + optional live translation (12 languages)

Original source extensions remain read-only references; all product code lives in this folder.

**On your Mac:** `/Users/moomen/Projects/flowlary` (Finder: home **moomen** → **Projects** → **flowlary**)

Clone this repository into that folder. The GitHub repo root **is** the Flowlary project.

## Structure

```
flowlary/
├── extension/        # Chrome MV3 extension (Vite + CRXJS)
├── packages/shared/  # Shared types and contracts
├── backend/          # Flowlary AI Gateway (Node HTTP)
├── tests/            # Unit & integration tests
├── release/          # Store-ready ZIP + checksum (generated)
└── docs/             # Architecture, privacy, security, release
```

## Development

```bash
npm install
npm run dev           # Extension dev server (localhost APIs)
npm run build         # Dev build → extension/dist/
npm run dev:api       # Local AI gateway → http://127.0.0.1:8787
npm test              # 477 tests
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
- [Production readiness audit](docs/production/PRODUCTION_READINESS_AUDIT.md)
- [AI production architecture](docs/production/AI_PRODUCTION_ARCHITECTURE.md)
- [Release readiness](docs/release/RELEASE_READINESS.md)
- [Phase 16 report](PHASE16_REPORT.md)

## Status

**Version 1.0.0** — Phases 0–16 complete. Local AI gateway + entitlement gating. **Not production-ready** — see [Production Readiness Audit](docs/production/PRODUCTION_READINESS_AUDIT.md).

Release blockers: server-verified entitlement, payment, account auth, privacy URL, support contact, store assets, production API deployment verification.
