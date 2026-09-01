# Flowlary marketing website

The public site is a Vite + React app in [`website/`](../../website/README.md).

| Surface | Production | Local |
|---------|------------|-------|
| Website | https://flowlary.com | `https://flowlary.test` (Herd TLS proxy → Vite on 5173) |
| API | https://api.flowlary.com | http://127.0.0.1:8787 |

The website does not call Groq. Chrome Web Store install links are disabled until a real listing URL is set in `website/src/config.ts`.
