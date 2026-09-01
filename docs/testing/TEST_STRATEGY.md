# Test strategy

Tests protect **behavior**, not filenames. There is **no GitHub Actions** folder in this repo; engineers run npm scripts locally or on their own CI.

## Layers

| Layer | Where | Protects |
| --- | --- | --- |
| Shared unit | `packages/shared` | Contracts: review JSON, correction JSON, learning events, pricing |
| Backend unit | `backend` + `tests/unit/backend` | Auth, CORS, readiness, provider validation, rate limits, billing signatures (no live money) |
| Extension unit | `tests/unit` + workspace | `decideWriting`, hypotheses, safety, Write Gate, policy, DOM helpers, popup |
| Writing-engine scenario | `tests/unit/writing-engine/*` | Mixed language, open token, review ingest, foundation safety, scenario classes |
| Integration | `tests/integration` | HTTP gateway with test server, account, learning, correction path, security phases |
| Contract / holdout | `*.eval.test.ts`, `tests/audit/evaluation` | Advisor/review contracts; **skipped** unless live env flags |
| Playwright E2E | `tests/e2e` | Real Chrome + unpacked extension: layout, islands, shortcuts |
| Probes | `scripts/*-live-probe.ts` | Real provider JSON **without logging snippets** |
| Website | `website` vitest | Marketing/account UI |

## What each writing layer must keep green

- **Safety:** password, JWT, URL, email, code editor → no auto-write.
- **Decision:** unique layout wins; mixed blob does not English-rewrite; one action.
- **Review ingest:** `mapLayout` for `layout_suspect`; no wording; live-text match.
- **Write Gate:** mutex, generation, cooldown, shadow_only.
- **Policy:** shortcuts_only never auto.

## Live evaluations

Gated by env (`FLOWLARY_LIVE_WRITING_REVIEW`, `FLOWLARY_GROQ_LIVE`, …). Default `npm test` must **not** spend provider quota. See [EVALUATION.md](./EVALUATION.md).

## E2E caveats

Playwright proves **input/textarea/simple CE**. Nested rich CE is expected **not** to auto-write. Shortcut tests need a reachable API. Service-worker message intercept of `writing-review` is **not** a reliable mock (real network or skip).

## Release

Before a store build: `npm test`, `npm run build:ext`, `npm run build:web`, `npm run build:release` as applicable. Matrix: [RELEASE_MATRIX.md](./RELEASE_MATRIX.md).
