# Local development

Requires Node 20+.

```bash
npm install
npm run dev:api          # gateway http://127.0.0.1:8787
npm run dev              # extension Vite (CRXJS), local API
npm run build:ext        # unpacked → local API (same as build:ext:local)
npm run build:ext:local  # unpacked → http://127.0.0.1:8787
npm run build:ext:production  # unpacked → https://api.flowlary.com
npm run dev:web          # website (Herd https://flowlary.test or Vite)
npm test                 # shared + backend + extension
npm run test:web
npm run typecheck
```

Copy `backend/.env.example` → `backend/.env`. Do not commit `.env`.

Load the extension from **`extension/dist/`**, not `extension/`. After TS changes: rebuild with the target you want, then Reload on `chrome://extensions`.

## API URLs

The extension API host is an explicit build target (`FLOWLARY_API_TARGET`). Leftover `extension/.env.local` does **not** choose the host.

| Command | API | Site links |
| --- | --- | --- |
| `npm run dev` / `build:ext` / `build:ext:local` | `http://127.0.0.1:8787` | `https://flowlary.test` |
| `npm run build:ext:production` | `https://api.flowlary.com` | `https://flowlary.com` |
| `npm run build:release` | `https://api.flowlary.com` (store manifest) | `https://flowlary.com` |

Website in Vite **dev** always uses same-origin `/__flowlary-api` (never mixed-content HTTP).

Development auth is permissive (`FLOWLARY_ENV=development` or `FLOWLARY_AUTH_DISABLED=1`). The extension still uses the same auth, session, and entitlement routes on whichever API target you built; production requires an **account JWT**. Install HMAC still exists but managed AI expects that JWT in production.

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
