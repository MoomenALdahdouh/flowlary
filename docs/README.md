# Flowlary documentation

**Code is the source of truth for behavior.** These documents explain the **current** implementation (2026-09-01 freeze).

If a document in `docs/audit/`, `docs/architecture/PHASE*.md`, root `PHASE*_REPORT.md`, `docs/production/PRODUCTION_READINESS_AUDIT.md`, or `docs/release/RELEASE_READINESS.md` disagrees with a file listed below, **trust the files in this index**.

## Start here

| If you need… | Read |
| --- | --- |
| What the product is | [product/PRODUCT_OVERVIEW.md](./product/PRODUCT_OVERVIEW.md) |
| How the whole system is shaped | [architecture/SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) |
| How a keystroke is handled | [architecture/WRITING_ENGINE.md](./architecture/WRITING_ENGINE.md) |
| What must never be casually changed | [architecture/ARCHITECTURE_FREEZE.md](./architecture/ARCHITECTURE_FREEZE.md) |
| How to run locally | [operations/DEVELOPMENT.md](./operations/DEVELOPMENT.md) |
| Env vars | [operations/ENVIRONMENT.md](./operations/ENVIRONMENT.md) |
| Launch status | [audits/FINAL_RELEASE_REPORT.md](./audits/FINAL_RELEASE_REPORT.md) |
| Honest gaps | [audits/KNOWN_LIMITATIONS.md](./audits/KNOWN_LIMITATIONS.md) |

## Authoritative architecture

| Topic | Document |
| --- | --- |
| System | [architecture/SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md) |
| Writing pipeline | [architecture/WRITING_ENGINE.md](./architecture/WRITING_ENGINE.md) |
| Decision engine | [architecture/DECISION_ENGINE.md](./architecture/DECISION_ENGINE.md) |
| Hypotheses | [architecture/HYPOTHESIS_SYSTEM.md](./architecture/HYPOTHESIS_SYSTEM.md) |
| Write Gate | [architecture/WRITE_GATE.md](./architecture/WRITE_GATE.md) |
| LLMs | [architecture/AI_ARCHITECTURE.md](./architecture/AI_ARCHITECTURE.md) |
| Writing Review | [architecture/WRITING_REVIEW.md](./architecture/WRITING_REVIEW.md) |
| Settings / policy | [architecture/POLICY_AND_SETTINGS.md](./architecture/POLICY_AND_SETTINGS.md) |
| Editors | [architecture/EDITOR_SUPPORT.md](./architecture/EDITOR_SUPPORT.md) |
| Safety | [architecture/SAFETY.md](./architecture/SAFETY.md) |
| Freeze | [architecture/ARCHITECTURE_FREEZE.md](./architecture/ARCHITECTURE_FREEZE.md) |
| Writing runtime redesign (design only) | [architecture/FLOWLARY_WRITING_RUNTIME_REDESIGN.md](./architecture/FLOWLARY_WRITING_RUNTIME_REDESIGN.md) |

## Product

| Topic | Document |
| --- | --- |
| Overview | [product/PRODUCT_OVERVIEW.md](./product/PRODUCT_OVERVIEW.md) |
| Journeys | [product/USER_JOURNEY.md](./product/USER_JOURNEY.md) |
| Capabilities | [product/CAPABILITIES.md](./product/CAPABILITIES.md) |
| Free plan | [product/FREE_PLAN_LIMITS.md](./product/FREE_PLAN_LIMITS.md) |

## Backend / operations / testing

| Topic | Document |
| --- | --- |
| HTTP API | [backend/API.md](./backend/API.md) |
| Providers | [backend/PROVIDERS.md](./backend/PROVIDERS.md) |
| Auth | [backend/AUTH.md](./backend/AUTH.md) |
| Billing | [backend/BILLING.md](./backend/BILLING.md) |
| Deploy | [operations/FLOWLARY_DEPLOY.md](./operations/FLOWLARY_DEPLOY.md) · [backend/DEPLOYMENT.md](./backend/DEPLOYMENT.md) · [deploy/README.md](../deploy/README.md) |
| Tests | [testing/TEST_STRATEGY.md](./testing/TEST_STRATEGY.md) |
| E2E | [testing/E2E.md](./testing/E2E.md) |
| Evaluation | [testing/EVALUATION.md](./testing/EVALUATION.md) |
| Release matrix | [testing/RELEASE_MATRIX.md](./testing/RELEASE_MATRIX.md) |
| Environment | [operations/ENVIRONMENT.md](./operations/ENVIRONMENT.md) |
| Development | [operations/DEVELOPMENT.md](./operations/DEVELOPMENT.md) |
| Production | [operations/PRODUCTION.md](./operations/PRODUCTION.md) |
| Website UI rollback | [operations/WEBSITE_UI_RELEASES.md](./operations/WEBSITE_UI_RELEASES.md) |
| Troubleshooting | [operations/TROUBLESHOOTING.md](./operations/TROUBLESHOOTING.md) |

## Privacy, security, legal (still live)

These remain valid operational/legal sources. Implementation details in the architecture set above win on writing-path mechanics.

- [privacy/PRIVACY.md](./privacy/PRIVACY.md) · [privacy/DATA_FLOW.md](./privacy/DATA_FLOW.md)
- [security/SECURITY_ARCHITECTURE.md](./security/SECURITY_ARCHITECTURE.md)
- [legal/](./legal/) · [release/](./release/)

## Historical (not current architecture)

Phase reports, forensic audits, and design studies live under [audit/](./audit/), [architecture/PHASE*.md](./architecture/), [design/](./design/), [monetization/](./monetization/), and repository-root `PHASE*_REPORT.md`. See [audit/README.md](./audit/README.md).

## Finalization pack

- [audits/FINAL_ARCHITECTURE_AUDIT.md](./audits/FINAL_ARCHITECTURE_AUDIT.md)
- [audits/FINAL_RELEASE_REPORT.md](./audits/FINAL_RELEASE_REPORT.md)
- [audits/KNOWN_LIMITATIONS.md](./audits/KNOWN_LIMITATIONS.md)
