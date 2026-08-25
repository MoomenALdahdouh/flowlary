# Flowlary

**Your AI Writing Companion**

Flowlary is a unified Chrome MV3 extension that combines three writing capabilities:

- **Improve Writing** — English grammar and spelling correction
- **Translate** — Meaning translation across 12 languages
- **Fix Layout** — Keyboard layout remapping (local-first)

This monorepo is the new home for the merged product. The original source extensions (`english-writing-assistant`, `ai-writing-translator`, `autofix-layout`) remain read-only references.

## Structure

```
flowlary/
├── extension/     # Chrome MV3 extension (Vite + CRXJS)
├── packages/shared/  # Shared types and contracts
├── backend/       # Backend services (future phases)
├── tests/         # Cross-package tests
└── docs/          # Architecture and development docs
```

## Development

```bash
npm install
npm run dev      # Extension dev server with HMR
npm run build    # Production extension build → extension/dist/
npm test         # Run all unit tests
```

Load the unpacked extension from `extension/dist/` in Chrome.

## Documentation

- [Architecture](docs/architecture/FLOWLARY_ARCHITECTURE.md)
- [Implementation phases](docs/development/PHASES.md)
- [Test migration plan](docs/architecture/TEST_MIGRATION.md)
- [Forensic audit](../FL0_AUDIT.md) (Phase 0)

## Status

Phases 0–6 complete. Manual translation (Ctrl/Cmd+Shift+,), optional live translation (default OFF), and keyboard layout fix are implemented. English correction is Phase 7.
