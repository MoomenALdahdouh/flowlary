# Flowlary

**Your AI Writing Companion**

Flowlary is a unified Chrome MV3 extension that combines three writing capabilities:

- **Improve Writing** — English grammar and spelling correction (BYOK Groq)
- **Translate** — Meaning translation across 12 languages (manual + optional live)
- **Fix Layout** — Keyboard layout remapping (local-first)

This monorepo is the merged product. Original source extensions (`english-writing-assistant`, `ai-writing-translator`, `autofix-layout`) remain read-only references.

## Structure

```
flowlary/
├── extension/        # Chrome MV3 extension (Vite + CRXJS)
├── packages/shared/  # Shared types and contracts
├── backend/          # Backend placeholder (API routes future)
├── tests/            # Cross-package unit & integration tests
└── docs/             # Architecture, privacy, security
```

## Development

```bash
npm install
npm run dev      # Extension dev server with HMR
npm run build    # Production extension build → extension/dist/
npm test         # Run all tests (453)
```

Load the unpacked extension from `extension/dist/` in Chrome.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Shift+, | Translate |
| Ctrl/Cmd+Shift+P | Fix layout |
| Ctrl/Cmd+Shift+L | Speed Box (manual layout conversion) |

## Documentation

- [Architecture](docs/architecture/FLOWLARY_ARCHITECTURE.md)
- [Implementation phases](docs/development/PHASES.md)
- [Privacy](docs/privacy/PRIVACY.md) · [Data flow](docs/privacy/DATA_FLOW.md)
- [Security architecture](docs/security/SECURITY_ARCHITECTURE.md)
- [Forensic audit](../FL0_AUDIT.md) (Phase 0)
- [Phase 14 report](PHASE14_REPORT.md)

## Status

Phases 0–14 complete. **453 tests passing.** Release candidate for unpacked/local use.

Not yet published to Chrome Web Store. Production backend APIs and store submission are out of scope for Phase 14. See [PHASE14_REPORT.md](PHASE14_REPORT.md) for release classification and remaining blockers.
