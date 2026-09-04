# Playwright E2E

Config: `tests/e2e/playwright.config.ts` (serial, 45s timeout).

```bash
npm run build:ext
npm run test:e2e
```

Specs:

- `three-tools-modes.spec.ts` — real Chromium with the unpacked extension. Direct, Box, and Shortcuts for Fix typing, English, and Arabic → English, plus protected URLs and password fields. Seeds a signed-in trial session and mocks `http://127.0.0.1:8787`.
- `extension-writing.spec.ts` — core field behavior
- `fresh-browser-writing.spec.ts` / `real-usage-writing.spec.ts` — corpora

**Protects:** user-visible typing on simple fields; layout remap; English island local path; policy pause.

**Does not prove:** Gmail/Notion adapters, production Paddle, all provider fallbacks, Chrome Web Store install.

CORRECT / TRANSLATE / live review need the **same API origin the built extension uses**. `npm run build:ext` / `build:ext:local` targets `http://127.0.0.1:8787` (`npm run dev:api`). `npm run build:ext:production` targets `https://api.flowlary.com`.

HTML report: `tests/e2e/playwright-report` (gitignored if configured).
