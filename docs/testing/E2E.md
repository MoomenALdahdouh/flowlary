# Playwright E2E

Config: `tests/e2e/playwright.config.ts` (serial, 45s timeout).

```bash
npm run build:ext
npm run test:e2e
```

Specs:

- `extension-writing.spec.ts` — core field behavior
- `fresh-browser-writing.spec.ts` / `real-usage-writing.spec.ts` — corpora

**Protects:** user-visible typing on simple fields; layout remap; English island local path; policy pause.

**Does not prove:** Gmail/Notion adapters, production Paddle, all provider fallbacks, Chrome Web Store install.

CORRECT / TRANSLATE / live review need the **same API origin the built extension uses**. If the unpack points at `https://writing-api.test` and only `:8787` is up, cloud shortcuts fail — that is configuration, not necessarily an engine bug.

HTML report: `tests/e2e/playwright-report` (gitignored if configured).
