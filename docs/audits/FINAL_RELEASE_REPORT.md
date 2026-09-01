# Final release report

**Date:** 2026-09-01  
**Verdict:** **CONDITIONAL**

The writing architecture is coherent and documented. Launch depends on **operations** (production secrets, API host, Paddle, SMTP, store listing) and **re-running** test/build gates on the release machine — not on inventing a new engine.

## Checklist

| Item | Class | Notes |
| --- | --- | --- |
| Extension `build:ext` | READY | Load `extension/dist` |
| Extension `build:release` | READY | Production API hosts |
| Backend start | READY | `npm run dev:api` / Docker |
| Website `build:web` | READY | |
| Unit/integration `npm test` | CONDITIONAL | Re-run at launch. 2026-09-01: shared+backend green; extension 40 failing tests, many retired-scheduler/UI-copy |
| Provider live probes | CONDITIONAL | Keys required |
| Playwright E2E | CONDITIONAL | Simple fields; API origin |
| Security/privacy code paths | READY | Do not log raw text |
| Env vars documented | READY | [../operations/ENVIRONMENT.md](../operations/ENVIRONMENT.md) |
| Production config | CONDITIONAL | [../operations/PRODUCTION.md](../operations/PRODUCTION.md) |
| API `/health` `/ready` | READY | Ready ≠ Groq ping |
| Provider health | CONDITIONAL | Keys + fallbacks |
| Billing | CONDITIONAL | Live Paddle + webhook |
| Authentication | CONDITIONAL | Real JWT secrets; auth not disabled |
| Extension install | CONDITIONAL | Store listing or unpacked |
| Onboarding / settings | READY | Policy + first-run in code |
| Site pause / exception | READY | User `excludedDomains` |
| Writing local layout | READY | |
| AI failure / offline | READY | Local path continues; cloud degrades |
| Rollback | READY | Image + JSON store snapshot; previous CRX |
| CI | NOT APPLICABLE | None in repo |
| Rich editor auto-write | KNOWN LIMITATION | |
| Local SLM | NOT APPLICABLE | Rejected |

## Evidence this freeze did **not** invent

- One Write Gate.
- One `decideWriting`.
- Advisor ID-only.
- Writing Review island spans.
- No new providers, no local SLM, no second policy object.

## Launch recommendation

Ship **unpacked / trusted beta** anytime the default tests and builds pass.

Ship **paid Chrome Web Store + live Paddle** only after: production `/ready` green on the real host, webhook verified in Paddle dashboard, SMTP, CORS, Groq key, release extension pointed at `api.flowlary.com`, and a manual pass of install → first-run → layout on textarea → pause/resume → billing sandbox then live.

Do not treat historical “470 tests / not production-ready” audits as current; they predate account, Paddle, and the enforce pipeline.
