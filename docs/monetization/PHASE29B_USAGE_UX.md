# PHASE 29B — AI Usage UX, Limit States & Soft Upgrade Experience

Phase 29B is the **display and conversion layer** on top of Phase 29A entitlement truth.

It does **not** change credit amounts, plan rules, weights, or server authority.

## Source of truth

| Concern | Owner |
| --- | --- |
| Credits, weights, resetAt, trial, Pro, soft caps | Phase 29A / server |
| UX state resolution + copy | `packages/shared/src/usageUx.ts` |
| Upgrade destination | `extension/src/config/upgrade.ts` → `getUpgradeUrl()` |
| Prompt suppression | `extension/src/ui/upgradePromptSuppression.ts` |

## Canonical states

| State | Tone | Primary CTA | Upgrade |
| --- | --- | --- | --- |
| `AI_USAGE_HEALTHY` | ok | none | subtle View Pro (dashboard only) |
| `AI_USAGE_LOW` | warn | Upgrade to Pro | yes |
| `AI_USAGE_EXHAUSTED` | warn | Upgrade to Pro | yes |
| `AI_TRIAL_ACTIVE` | ok | keep writing | no |
| `AI_TRIAL_ENDING` | info | Keep Pro access (upgrade) | yes |
| `AI_TRIAL_EXPIRED` | info | Upgrade to Pro | yes |
| `AI_PRO_ACTIVE` | ok | keep writing | no |
| `AI_PRO_SOFT_LIMIT` | warn | View usage | no |
| `AI_TEMPORARILY_UNAVAILABLE` | warn | none | **never** |
| `ACCOUNT_REQUIRED` | info | Sign in | **never** |
| `BILLING_ATTENTION` | warn | Manage subscription | no |

## Thresholds (from Phase 29A)

- Free daily: `FREE_DAILY_CREDITS` (40)
- Low credit: `LOW_CREDITS_THRESHOLD` (8 remaining)
- Pro daily soft guard: `PRO_DAILY_CREDITS` (200)
- Pro monthly soft cap: `PRO_MONTHLY_SOFT_CAP` (1500)
- Near monthly: `PRO_MONTHLY_NEAR_THRESHOLD` (150 remaining)
- Trial ending window: `TRIAL_ENDING_DAYS` (3)
- Trial-expired notice: `TRIAL_EXPIRED_NOTICE_MS` (7 days)
- Contextual upgrade suppress: `UPGRADE_PROMPT_SUPPRESS_MS` (30 minutes)

## Copy principles

- Local tools always remain available when AI is limited.
- Never say Flowlary is disabled / extension expired / data locked.
- Never say Unlimited when soft limits exist.
- Never expose Groq, tokens, weights, or provider details.
- Trial days are never mixed with AI credit timers.
- API failure ≠ quota; sign-in ≠ upgrade; billing ≠ exhaustion.

Optional help string (`AI_ALLOWANCE_HELP`):

> AI usage varies by feature. Translation and Live Translation use more of your daily AI allowance.

## Surfaces

### Popup

- Compact AI strip when healthy / Pro / trial active.
- Compact `UsageStatusCard` for low / exhausted / trial ending / API / account / billing.
- Feature controls stay above the fold; monetization does not replace them.
- Footer: plan + open dashboard (not a pricing page).

### Dashboard

- Full `UsageStatusCard` on Overview + Account.
- `ProUpgradeCard` only when low / exhausted / trial ending / trial expired.
- Compose workbench: contextual Upgrade CTA after a blocked AI attempt (with suppression).

### Website Account

- Uses the same `resolveUsageUx()` language for plan / usage / local-tools notes.

## Upgrade trigger hierarchy

0. Healthy — no interruption  
1. Low — subtle indicator  
2. Exhausted — calm visible status  
3. Blocked AI attempt — contextual upgrade (suppressible)  
4. Trial ending — account/dashboard reminder  

Never exceed this hierarchy.

## Notification / suppression

- After a contextual exhaustion upgrade prompt is shown, identical CTAs are suppressed for 30 minutes.
- The error / locked state is **never** suppressed — the user always understands why AI did not run.

## Reset countdown

- Display: `Resets in 5h 21m` via `formatResetCountdown`.
- Client countdown is display-only.
- When `resetAt` is reached, popup/dashboard silently reloads status; `maybeSyncServerEntitlement` forces a server sync at the reset boundary.
- Client must **not** invent `creditsRemaining = creditsLimit`.

## Accessibility & reduced motion

- Status uses text + ARIA (`role="status"`, progressbar labels), not color alone.
- `prefers-reduced-motion`: usage card / progress transitions disabled.

## Tests

- `tests/unit/shared/usageUx.test.ts` — all canonical states
- `tests/unit/popup/usage-ux.test.ts` — popup footer / feature summary
- `tests/unit/extension/usage-ux-helpers.test.ts` — suppression + upgrade URL
- `tests/unit/popup/errors.test.ts` — exhaustion vs API vs auth copy
- Existing popup / domain / monetization suites remain authority for local tools availability

## Dependency

Requires Phase 29A server entitlement fields including `trialEndsAt`, credits, `resetAt`, and reservation semantics.
