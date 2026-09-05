# Flowlary

Chrome writing companion for mixed Arabic/English: **keyboard layout repair**, **bounded English help**, and **optional Arabic→English translation** in the field the user is already typing in.

LLMs rank hypotheses or propose island spans. They **do not** write the DOM. Only **Write Gate** mutates the field.

**Current in-repo version: 1.4.0** (not tagged). See [docs/operations/FLOWLARY_ADMIN.md](docs/operations/FLOWLARY_ADMIN.md) for the operator panel.

## 1.4.0 at a glance

- **Writing runtime kernel** — operations, idle scheduling, arbitration, and write authorization so layout / English / translation do not race the same field.
- **On-device English** — shared lexicon, spell, repair, and refine before the gateway is asked.
- **Admin panel** — `/admin` with server-side allowlist authorization and real store metrics.
- **Production** — immutable releases at `/var/www/flowlary` only. Do **not** run this against ZAIXOS.

The website Writing Lab is **not** the extension writing engine.

## Structure

```
flowlary/
├── extension/         Chrome MV3 (Vite + CRXJS)
├── website/           Marketing, account, pricing, Writing Lab demo
├── backend/           AI gateway (auth, entitlement, providers, billing)
├── packages/shared/   Contracts
├── tests/             Unit, integration, Playwright
├── deploy/            Production VPS script + optional Docker/PM2 samples
├── docs/              Authoritative documentation (start: docs/README.md)
└── scripts/           Packaging and live probes
```

## Development

```bash
npm install
npm run dev:api       # http://127.0.0.1:8787
npm run dev           # extension Vite (local API)
npm run build:ext     # unpacked → local API (127.0.0.1:8787)
npm run build:ext:production  # unpacked → https://api.flowlary.com
npm run dev:web
npm run build:web
npm test
npm run test:web
npm run test:deploy   # local deploy-script tests (no VPS)
```

Load unpacked from **`extension/dist/`**. After changes: `npm run build:ext` and Reload in `chrome://extensions`.

Copy `backend/.env.example` to `backend/.env` (never commit secrets). Details: [docs/operations/DEVELOPMENT.md](docs/operations/DEVELOPMENT.md).

## Release packaging (Chrome)

```bash
npm test
npm run build:release
npm run package:release
```

See `release/RELEASE_CHECKLIST.md` and [docs/operations/PRODUCTION.md](docs/operations/PRODUCTION.md).

## Production (website + API)

Canonical path: **`/var/www/flowlary`**. Script: [`docs/operations/FLOWLARY_DEPLOY.md`](docs/operations/FLOWLARY_DEPLOY.md).

```bash
ssh deploy@169.58.11.99
cd /var/www/flowlary
./deploy.sh status
./deploy.sh v1.4.0
```

This restarts **only** `flowlary-api`. It never writes under `/var/www/zaixos`, never reloads nginx, and never restarts other Supervisor programs.

Rollback: `./deploy.sh rollback`

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd+Shift+, | Translate |
| Ctrl/Cmd+Shift+P | Fix keyboard layout |
| Ctrl/Cmd+Shift+E | English assist (instant + review ingest, not whole-field rewrite) |
| Ctrl/Cmd+Shift+L | Speed Box |

## Tags

| Tag | Meaning |
| --- | --- |
| `v1.4.0` | This release |
| `v1.3.0` | Previous product snapshot |
| `writing-runtime-kernel` | Runtime kernel commit |
| `website-ui-bolt` | Current marketing UI |
| `website-ui-classic` | Previous website UI |
| `deploy-vps-1` | Flowlary-only VPS deploy script |
| `v1.2.0` | Previous product snapshot |

## Documentation

**Start here:** [docs/README.md](docs/README.md)

| Topic | Document |
| --- | --- |
| Architecture freeze | [docs/architecture/ARCHITECTURE_FREEZE.md](docs/architecture/ARCHITECTURE_FREEZE.md) |
| Writing pipeline (today) | [docs/architecture/WRITING_ENGINE.md](docs/architecture/WRITING_ENGINE.md) |
| Runtime redesign (target) | [docs/architecture/FLOWLARY_WRITING_RUNTIME_REDESIGN.md](docs/architecture/FLOWLARY_WRITING_RUNTIME_REDESIGN.md) |
| Environment variables | [docs/operations/ENVIRONMENT.md](docs/operations/ENVIRONMENT.md) |
| VPS deploy | [docs/operations/FLOWLARY_DEPLOY.md](docs/operations/FLOWLARY_DEPLOY.md) |
| Website UI rollback | [docs/operations/WEBSITE_UI_RELEASES.md](docs/operations/WEBSITE_UI_RELEASES.md) |
| Known limitations | [docs/audits/KNOWN_LIMITATIONS.md](docs/audits/KNOWN_LIMITATIONS.md) |

Privacy / security / legal folders under `docs/` remain operational. Phase reports and `docs/audit/` are **historical**.
