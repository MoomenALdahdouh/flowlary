# Local development

Requires Node 20+.

```bash
npm install
npm run dev:api          # gateway http://127.0.0.1:8787
npm run dev              # extension Vite (CRXJS)
npm run build:ext        # unpacked → extension/dist
npm run dev:web          # website (Herd https://flowlary.test or Vite)
npm test                 # shared + backend + extension
npm run test:web
npm run typecheck
```

Copy `backend/.env.example` → `backend/.env`. Do not commit `.env`.

Load the extension from **`extension/dist/`**, not `extension/`. After TS changes: `npm run build:ext` then Reload on `chrome://extensions`.

## API URLs

| Build | API |
| --- | --- |
| `npm run build:ext` / `dev` | `VITE_FLOWLARY_API_URL` or `https://writing-api.test` |
| Point at local Node | `VITE_FLOWLARY_API_URL=http://127.0.0.1:8787` in `extension/.env.local` |
| `npm run build:release` | Forced `https://api.flowlary.com` |

Website in Vite **dev** always uses same-origin `/__flowlary-api` (never mixed-content HTTP).

Development auth is permissive (`FLOWLARY_ENV=development` or `FLOWLARY_AUTH_DISABLED=1`). Install HMAC still exists but managed AI expects an **account JWT** in production.

## Writing Review / Advisor live

Keys in `backend/.env`. Optional probes (no snippets printed):

```bash
npm run probe:writing-review-live
npm run probe:advisor-live
npm run test:providers
```

E2E: `npm run test:e2e` (Playwright; needs a built extension and typically a local API for CORRECT/TRANSLATE).

## Mail

Mailpit: `SMTP_HOST=127.0.0.1 SMTP_PORT=1025`. Verification links use `FLOWLARY_WEB_ORIGIN`.
