# Flowlary

Chrome writing companion for mixed Arabic/English: **keyboard layout repair**, **bounded English help**, and **optional Arabic→English translation** in the field the user is already typing in.

LLMs rank hypotheses or propose island spans. They **do not** write the DOM. Only **Write Gate** mutates the field.

Launch status: **conditional** — see [docs/audits/FINAL_RELEASE_REPORT.md](docs/audits/FINAL_RELEASE_REPORT.md).

## Structure

```
flowlary/
├── extension/         Chrome MV3 (Vite + CRXJS)
├── website/           Marketing, account, pricing, Writing Lab demo
├── backend/           AI gateway (auth, entitlement, providers, billing)
├── packages/shared/   Contracts
├── tests/             Unit, integration, Playwright
├── deploy/            Docker, nginx, PM2
├── docs/              Authoritative documentation (start: docs/README.md)
└── scripts/           Packaging and live probes
```

The website Writing Lab is **not** the extension writing engine.

## Development

```bash
npm install
npm run dev:api       # http://127.0.0.1:8787
npm run dev           # extension Vite
npm run build:ext     # unpacked → extension/dist/
npm run dev:web
npm run build:web
npm test
npm run test:web
```

Load unpacked from **`extension/dist/`**. After changes: `npm run build:ext` and Reload in `chrome://extensions`.

Copy `backend/.env.example` to `backend/.env` (never commit secrets). Details: [docs/operations/DEVELOPMENT.md](docs/operations/DEVELOPMENT.md).

## Release packaging

```bash
npm test
npm run build:release
npm run package:release
```

See `release/RELEASE_CHECKLIST.md` and [docs/operations/PRODUCTION.md](docs/operations/PRODUCTION.md).

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd+Shift+, | Translate |
| Ctrl/Cmd+Shift+P | Fix keyboard layout |
| Ctrl/Cmd+Shift+E | English assist (instant + review ingest, not whole-field rewrite) |
| Ctrl/Cmd+Shift+L | Speed Box |

## Documentation

**Start here:** [docs/README.md](docs/README.md)

| Topic | Document |
| --- | --- |
| Architecture freeze | [docs/architecture/ARCHITECTURE_FREEZE.md](docs/architecture/ARCHITECTURE_FREEZE.md) |
| Writing pipeline | [docs/architecture/WRITING_ENGINE.md](docs/architecture/WRITING_ENGINE.md) |
| Environment variables | [docs/operations/ENVIRONMENT.md](docs/operations/ENVIRONMENT.md) |
| Known limitations | [docs/audits/KNOWN_LIMITATIONS.md](docs/audits/KNOWN_LIMITATIONS.md) |

Privacy / security / legal folders under `docs/` remain operational. Phase reports and `docs/audit/` are **historical**.
