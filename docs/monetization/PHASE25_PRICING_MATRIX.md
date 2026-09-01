# PHASE 25 — Pricing Matrix

**Status:** Definitive pricing/product matrix for future implementation.  
**Type:** Product-readable + machine-readable Markdown table.  
**Implementation status:** Not yet implemented in app code.

| Feature | Category | Current implementation | Free | Trial | Pro | Limit | Reset | Cost | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard Layout Repair (local) | Core local utility | Exists | Yes | Yes | Yes | None | None | None / negligible | Core identity, zero model cost |
| Layout AI classify | AI-cost | Exists | Yes | Yes | Yes | Shared weighted AI credits | Daily | Low–medium, external pricing required | Optional AI assist only |
| Layout manual shortcut | Core local utility | Exists | Yes | Yes | Yes | None for local path | None | None unless classify | Core utility |
| Speed Box | Core local utility | Exists | Yes | Yes | Yes | None | None | None | Core utility, local |
| Instant local spelling help | Core local utility | Exists | Yes | Yes | Yes | None | None | None | Basic assistance |
| Writing Correction | AI-cost | Exists | Limited | Full | High | Shared weighted AI credits | Daily | Medium | Primary paid AI value |
| Manual Translation | AI-cost | Exists | Limited | Full | High | Shared weighted AI credits, heavier than correction | Daily | Medium-high | Paid AI value |
| Live Translation | AI-cost | Exists | Strictly limited | Full | High | Shared weighted AI credits with higher weight and optional soft cap | Daily | High | Highest burst/cost risk |
| Practice Check | Practice | Exists | Limited teaser | Full | Full | Shared weighted AI credits | Daily | Medium | AI cost + learning value |
| Practice sessions | Practice | Exists | Limited teaser | Full | Full | Product limit, not local disable | Daily for AI-backed checks | Medium | Strong Pro differentiator |
| Learning profile | Learning | Exists | Basic | Full | Full | None | None | Low | Needed for product loop |
| Learning events history | Learning | Exists | Limited visible history | Full | Full | Visibility limit on Free | None | Low | Strong Pro value |
| Recurring mistake analysis | Learning | Partial/basic today | No / basic hint only | Full | Full | Feature entitlement | N/A | Low | Real learning payoff |
| Progress basics | Learning | Exists | Yes | Yes | Yes | Basic metrics only | N/A | Low | Free should feel useful |
| Advanced progress / analytics | Learning | Future/partial | No | Full | Full | Feature entitlement | N/A | Low | Premium learning value |
| Activity / local history | Data | Exists | Yes | Yes | Yes | Basic cap | N/A | Low | Useful, low-cost, should stay free |
| Learning export | Data/export | Exists technically | No | Yes | Yes | Feature entitlement | N/A | Low | Strong Pro value |
| Learning import | Data/export | Exists technically | No | Yes | Yes | Feature entitlement | N/A | Low | Strong Pro value |
| Activity export | Data/export | Exists in export bundle | Optional / basic | Yes | Yes | May remain bundled | N/A | Low | Lower-value than learning export |
| Reset / deletion | Privacy | Exists | Yes | Yes | Yes | None | None | None | Must never be paywalled |
| Privacy controls | Privacy | Exists | Yes | Yes | Yes | None | None | None | Must never be paywalled |
| Pause / disable | Privacy/core control | Exists | Yes | Yes | Yes | None | None | None | Must never be paywalled |
| Site safety / field safety | Privacy/security | Exists | Yes | Yes | Yes | None | None | None | Safety function |
| Account registration/login | Account | Exists | Yes | Yes | Yes | None | N/A | Low | Required for server authority |
| Trial entitlement | Account/billing | Exists, wrong duration for target | No | Yes | N/A | 30-day full-product target | Ends by server clock | Medium-high | Product sampling |
| Pro subscription | Billing | Exists via Paddle backend | No | N/A | Yes | Soft daily/monthly AI caps | Billing period | Revenue feature | Everyday product |
| Billing portal | Billing | Backend exists, UI partial | No | N/A | Yes | N/A | N/A | Low | Subscription management |
| Payment failure handling | Billing | Exists | No | N/A | Yes | Dunning window | Billing events | Ops | Preserve continuity |
| Cancel at period end | Billing | Exists | No | N/A | Yes | Current period access retained | Billing events | Ops | Expected SaaS behavior |

## User-facing simplified matrix

| Feature | Free | Pro |
| --- | --- | --- |
| Keyboard Layout Repair | Included forever | Included |
| Speed Box | Included forever | Included |
| Local safety, privacy, pause | Included forever | Included |
| Writing Correction | Limited daily AI help | High everyday AI help |
| Translation | Limited daily AI help | High everyday AI help |
| Live Translation | Strictly limited | High everyday AI help |
| Learning | Basic awareness and progress | Full learning history and insights |
| Practice | Limited teaser | Full practice |
| Export / Import | Not included | Included |
| Advanced progress | Not included | Included |

## Credit weights (DESIGN TARGET, not current code)

| Operation | Weight |
| --- | --- |
| Writing Correction | 1 |
| Layout AI classify | 1 |
| Practice Check | 1 |
| Manual Translation | 2 |
| Live Translation | 2 |

## Global rules

1. Never paywall local Keyboard Layout Repair.
2. Never paywall Speed Box.
3. Never paywall privacy, reset, pause, or safety.
4. Never claim unlimited AI.
5. All AI quota enforcement must be server-side.
6. Trial must match whatever duration is marketed.
7. Website, extension, dashboard, onboarding, and support must all use this matrix.
