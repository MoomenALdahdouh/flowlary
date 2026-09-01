# PHASE 26 — Final Plan Matrix

**Status:** Final implementation blueprint matrix.  
**Not yet implemented in product code.**

| Feature | Free | Trial | Pro | Limit | Reset | Cost | UI Copy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard Layout Repair (local) | Yes | Yes | Yes | None | None | Local | Free forever |
| Layout manual shortcut | Yes | Yes | Yes | None for local path | None | Local | Included |
| Speed Box | Yes | Yes | Yes | None | None | Local | Free forever |
| Instant local spelling assistance | Yes | Yes | Yes | None | None | Local | Included |
| Pause / disable | Yes | Yes | Yes | None | None | Local | Always available |
| Privacy controls | Yes | Yes | Yes | None | None | Local | Always available |
| Reset / deletion | Yes | Yes | Yes | None | None | Local | Always available |
| Safety protections | Yes | Yes | Yes | None | None | Local | Included |
| Writing Correction | Limited | Full | High | weight `1` | Daily | AI | Daily AI allowance |
| Manual Translation | Limited | Full | High | weight `2` | Daily | AI | Daily AI allowance |
| Live Translation | Limited | Full | High | weight `2` | Daily | AI | Daily AI allowance |
| Layout AI classify | Limited | Full | High | weight `1` | Daily | AI | Included in AI allowance |
| Practice Check | Limited | Full | Full | weight `1` | Daily | AI | Included in AI allowance |
| Practice sessions | Limited teaser | Full | Full | product gate | N/A | Mixed | Targeted practice |
| Learning Profile | Basic | Full | Full | feature gate | N/A | Local | Learning profile |
| Learning Events history | Limited visible history | Full | Full | feature gate | N/A | Local | Full learning history |
| Recurring mistake analysis | No | Yes | Yes | feature gate | N/A | Local | Recurring mistakes |
| Progress basics | Yes | Yes | Yes | none | N/A | Local | Progress |
| Advanced progress | No | Yes | Yes | feature gate | N/A | Local | Advanced progress |
| Activity | Basic | Basic | Basic | local cap | N/A | Local | Activity |
| Learning export | No | Yes | Yes | feature gate | N/A | Local | Export learning |
| Learning import | No | Yes | Yes | feature gate | N/A | Local | Import learning |
| Account | Yes | Yes | Yes | none | N/A | Server | Account |
| Billing portal | No | N/A | Yes | subscription state | Billing period | Server | Manage subscription |
| Pro subscription | No | N/A | Yes | soft monthly cap `1500` | Monthly | Server | High everyday AI limits |

## AI Weights

| Operation | Weight |
| --- | --- |
| Writing Correction | 1 |
| Layout AI classify | 1 |
| Practice Check | 1 |
| Manual Translation | 2 |
| Live Translation | 2 |

## Free Quota

| Setting | Value |
| --- | --- |
| Daily credits | 40 |
| Reset | 00:00 UTC |
| Rollover | No |
| Exhaustion behavior | AI stops, local tools continue |

## Trial

| Setting | Value |
| --- | --- |
| Duration | 30 days |
| Starts | Account registration |
| Experience | Full Pro |
| End | Downgrade to Free |

## Pro

| Setting | Value |
| --- | --- |
| Price | $9 / month |
| Annual | $90 / year |
| Soft cap | 1500 weighted credits / month |
| Positioning | High everyday AI limits + full learning |
