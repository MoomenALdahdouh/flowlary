# Flowlary website (`flowlary.com`)

Marketing site for Flowlary. It is a **static React app** in the Flowlary monorepo. It does not call Groq and does not contain server secrets.

| Environment | URL |
|-------------|-----|
| Production website | `https://flowlary.com` |
| Production API (extension, not this site) | `https://api.flowlary.com` |
| Local website | `https://flowlary.test` (Herd TLS proxy → Vite) |
| Local website (Vite direct) | `http://127.0.0.1:5173` |
| Local API | `http://127.0.0.1:8787` or `https://writing-api.test` |

Do not confuse `flowlary.test` (local) with `flowlary.com` (production).

## Commands (from the repository root)

```bash
npm install
npm run dev:web      # Vite on 5173 · open https://flowlary.test (required; else 502)
npm run serve:web    # Built site on 5173 · no HMR, but no dev server either
npm run build:web    # Production static build + prerender
npm run test:web     # Website tests only
```

From this folder:

```bash
npm run dev
npm run build
npm run preview      # http://flowlary.test:4173
npm test
```

## Laravel Herd (hostname only, Laravel is not required)

Herd is used so `flowlary.test` resolves locally. The website is not a PHP app. Do not point Herd at the repo root; that used to serve a placeholder `public/` page.

### Day-to-day (TLS proxy)

Herd proxies `https://flowlary.test` to Vite on port 5173:

```bash
herd unlink flowlary
herd proxy flowlary.test http://127.0.0.1:5173 --secure
npm run dev:web
```

Then open **https://flowlary.test**. Leave `npm run dev:web` running.

### 502 Bad Gateway

Herd proxies to Vite on port **5173**. A 502 means nothing is listening there.

```bash
npm run dev:web      # development (hot reload)
# or
npm run serve:web    # production build preview on :5173
```

If the hostname is wrong, re-register the proxy once:

```bash
herd unlink flowlary 2>/dev/null
herd proxy flowlary.test http://127.0.0.1:5173 --secure
```

### Static files (matches production, no Vite process)

1. `herd unproxy flowlary.test`
2. `npm run build:web`
3. `cd website/dist && herd link flowlary && herd secure flowlary`

Routes are prerendered as directories (`/features/index.html`, etc.), so a standard static host or Herd does not need SPA rewrite rules for the published pages.

## Chrome Web Store CTA

`CHROME_WEB_STORE_URL` in `src/config.ts` is `null` until a real listing exists. Buttons currently go to `/support#get-flowlary`.

## Privacy / terms

User-facing legal pages live at `/privacy` and `/terms`. Terms contain marked placeholders for entity and governing law.
