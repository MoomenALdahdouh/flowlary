# Test coverage / release matrix

Status as of documentation freeze **2026-09-01**. Re-run commands before a real launch and update this table.

**`npm test` this freeze:** shared **135 passed**; backend **all passed** (37 files, 2 skipped); extension **1583 passed, 40 failed, 5 skipped** (203 files). Failures cluster in **obsolete EventBus scheduler tests** (especially live-translation), **stale popup/dashboard copy**, **jsdom tests that do not start the enforce coordinator**, daily-brief timeouts, and a **phase23 `/localhost/` regex false positive** on safety token code in the release bundle (not a Groq key).

| AREA | STATUS | TEST TYPE | LAST VERIFIED | KNOWN LIMITATIONS |
| --- | --- | --- | --- | --- |
| Shared contracts | READY | unit (`packages/shared`) | with `npm test` | — |
| Backend auth/CORS/ready | READY | unit | with `npm test` | JSON store not multi-node |
| Layout `mapLayout` | READY | unit + E2E simple fields | engine tests | Some corpus edge cases historically flaky |
| Decision engine | READY | unit scenario-classes | writing-engine tests | — |
| Write Gate / safety | READY | unit | foundation-safety, writeGate | Rich CE not auto |
| Writing Review ingest | READY | unit | writing-review-*.test.ts | Live providers optional |
| Writing Review live providers | CONDITIONAL | probe + gated eval | probe script when keys present | Needs gateway + keys; SW mock intercept unreliable |
| Hypothesis Advisor ranking | CONDITIONAL | unit + gated live | fallback default off in prod | Contract failures if token budget too low |
| Translation gateway | CONDITIONAL | integration | needs keys / Google optional | Groq fallback credit-gated |
| Extension build | READY | `build:ext` | local | Load `dist/` |
| Website build | READY | `build:web` | local | Store URL may be null until listing |
| Playwright writing | CONDITIONAL | e2e | last full run mixed: local layout mostly pass; API shortcuts fail without matching API | Not store install |
| Billing webhooks | CONDITIONAL | unit + sandbox | code present | Live Paddle must be configured |
| Account / email | CONDITIONAL | integration | needs SMTP | |
| Security XSS / headers | READY | unit/integration phase13/23 | | Browser-dependent |
| Performance | KNOWN LIMITATION | ad-hoc | | No dedicated perf suite in CI |
| Chrome Web Store privacy form | CONDITIONAL | manual | legal docs | Listing not assumed published |
| CI | NOT APPLICABLE | none in-repo | | No `.github/workflows` |

Legend: **READY** = protected by default tests and matches freeze. **CONDITIONAL** = works when env/keys/ops are set. **KNOWN LIMITATION** = not claimed. **NOT APPLICABLE** = no such system.
