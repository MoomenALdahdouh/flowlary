# PHASE 29A — Credit Entitlement Implementation

## Status

Phase 29A implementation is complete in repository code.

This document describes the implemented Free / Trial / Pro entitlement and AI credit system as it exists in code after the Phase 29A completion pass.

## Final Free Model

- Free local utilities remain permanently available:
  - Keyboard Layout Repair
  - Layout manual shortcut
  - Speed Box
  - Instant local spelling
  - Field safety
  - Privacy controls
  - Pause
  - Reset
  - Basic Learning
  - Basic Progress
  - Activity
- Free managed AI is limited by `FREE_DAILY_CREDITS = 40`.
- Free AI usage is server-authoritative and exposed as:
  - `creditsUsed`
  - `creditsRemaining`
  - `dailyLimit`
  - `resetAt`
- When Free AI is exhausted, local tools remain available and only managed AI is denied.

## Trial Model

- Trial duration is controlled by one shared constant:
  - `ACCOUNT_TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000`
- Trial starts on successful account registration.
- Trial is server-authoritative and does not restart from reinstall, logout, login, browser restart, local storage edits, or new install tokens.
- Trial receives the full product capability set and Pro-level AI limits during the trial window.
- Trial expiry resolves back to Free unless subscription state grants Pro.

## Pro Model

- Pro includes:
  - higher everyday AI allowance
  - full learning
  - advanced progress
  - full practice
  - recurring mistake insights
  - learning export
  - learning import
- Pro daily allowance is `PRO_DAILY_CREDITS = 200`.
- Pro soft monthly protection cap is `PRO_MONTHLY_SOFT_CAP = 1500`.
- Subscription state is resolved from verified billing state, not client claims.

## Canonical Credit Weights

Shared source of truth: `packages/shared/src/credits.ts`

- `correction: 1`
- `layout-classification: 1`
- `practice: 1`
- `translation: 2`
- `live-translation: 2`

These values are consumed from the shared package by backend and extension code. They are not duplicated as independent product constants in each surface.

## Daily Reset

- Daily reset uses server time.
- Reset moment is next `00:00 UTC`.
- Unused Free credits do not roll over.
- Trial / Pro daily windows also reset at `00:00 UTC`.
- Pro monthly soft-cap windows reset at the next UTC month boundary.

## Server Authority

The server is authoritative for:

- plan
- trial state
- AI allowance
- reset timing
- capabilities
- subscription state

The extension may cache server entitlement for UX, but cannot grant itself Trial, Pro, or additional AI.

## Authentication

- Managed AI requires account authentication.
- Install-token auth no longer unlocks managed AI.
- Install-token AI requests fail closed and remain limited to local-only behavior.
- Client entitlement headers are telemetry-only and do not change server billing or access decisions.

## Enforcement Path

Every managed AI request now follows one server-side quota path:

1. authenticate account
2. resolve authoritative entitlement
3. check rate limit
4. reserve credits before provider execution
5. finalize reservation on success
6. release reservation on failure
7. append usage record

This Phase 29A pass closed the last concurrency gap by moving debit timing from "after success only" to "reserve before provider, release on failure". That prevents two concurrent requests from overspending the last remaining credit.

## Migration

- Legacy `usageBalanceMs` remains only for compatibility and explicit migration safety.
- The system does not convert milliseconds into credits.
- Local migration normalizes legacy `usageBalanceMs` to `0`.
- Expired trial resolution ignores legacy latency balance and returns the user to Free daily credits.
- Learning data, settings, and local product data remain intact.

## Exhaustion and Low-Credit Behavior

- Low-credit threshold is shared as `LOW_CREDITS_THRESHOLD = 8`.
- Free low-credit UX now surfaces a calm warning in popup/dashboard status.
- Free exhausted UX remains non-destructive and keeps local tools available.
- Quota exhaustion, account-required, API unavailability, and billing issues remain distinct states.

## Security

Phase 29A protections now cover:

- forged local plan cannot unlock Pro
- forged client entitlement header cannot unlock Pro
- local storage cannot increase server credits
- expired trial cannot keep Trial access
- canceled / expired billing cannot keep Pro capabilities
- install token cannot bypass managed AI quota
- concurrent requests cannot overspend the final remaining credits
- failed AI requests release reserved credits and do not consume them

No user-facing Groq, BYOK, provider selection, or localhost release artifacts are part of the intended release build.

## Tests Run

Focused verification added or strengthened for:

- concurrent quota overspend prevention
- usage record persistence for authenticated AI requests
- low-credit popup state
- `past_due` retains Pro during retry window
- canceled subscription after period end resolves to Free

Full required commands for Phase 29A validation:

- `npm test`
- `npm run build`
- `npm run build:release`

## Known External Blockers

These remain external release blockers rather than repository implementation blockers:

- live Paddle checkout / portal verification
- live `api.flowlary.com` verification in production conditions
- final real-browser release QA

## Acceptance Summary

- Free local utilities are permanently free.
- Free AI uses approved daily credits.
- Reset timing is server-authoritative.
- Translation, live translation, correction, layout AI, and practice use canonical weights.
- Failed requests do not consume credits.
- Concurrent requests cannot overspend credits.
- Trial is 30 days from one shared constant.
- Install token no longer bypasses managed AI.
- Client cannot forge Pro or extra credits.
- Old user-facing "2 hours" usage UI is retired.
- Popup and account usage language now describes clear daily AI usage and reset timing.
