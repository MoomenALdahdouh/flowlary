# PHASE 26 — UX State Matrix

**Status:** Final monetization UX state blueprint.  
**Not yet implemented in product code.**

| State | User message | Primary CTA | Secondary CTA | What remains available | Visual treatment |
| --- | --- | --- | --- | --- | --- |
| Free healthy | Free plan active. Daily AI allowance available. | Use Flowlary | View plan | All Free features | Calm glass surface, neutral-positive tone |
| Free low credits | You’re running low on today’s Free AI allowance. | Upgrade to Pro | Keep using Free | All local tools + remaining AI | Accent warning, non-alarming |
| Free exhausted | You’ve reached today’s Free AI limit. AI resets tomorrow. | Upgrade to Pro | View usage | Keyboard Layout Repair, Speed Box, local tools, privacy, pause | Muted warning, not destructive red |
| Trial active | Trial active. Full Flowlary experience unlocked. | Keep writing | View plan | Full product | Premium positive state |
| Trial ending | Your trial ends in X days. | Upgrade to Pro | View plan | Full product until end | Gentle urgency, no fear |
| Trial expired | Your full trial has ended. Free tools and Free AI remain available. | Upgrade to Pro | Continue on Free | All Free features | Neutral explanatory tone |
| Pro active | Pro active. Full learning and high everyday AI limits available. | Keep writing | Manage subscription | Full product | Premium calm state |
| Pro near limit | You’re approaching your current AI allowance. | View usage | Manage plan | Full product until limit | Soft caution |
| Pro limit | You’ve reached your current AI limit. Access returns in the next usage window. | View usage | Contact support | Local tools remain | Calm warning |
| Payment failed | There’s an issue with your subscription. We’re retrying billing. | Manage subscription | View plan | Pro during retry window if still granted | Warning, trust-preserving |
| Cancelled | Your subscription will end at the current billing period. | Reactivate Pro | View plan | Pro until end date | Informational |
| API unavailable | Flowlary AI is temporarily unavailable. | Retry | View status | Keyboard Layout Repair, Speed Box, local tools | Neutral error, not billing-looking |
| Account unavailable | We couldn’t confirm your account right now. | Sign in again | Continue local mode | Local features remain | Informational caution |
| Extension paused | Flowlary is paused. | Resume Flowlary | Open settings | Nothing automated runs while paused | Muted inactive state |

## Surface notes

### Popup

- Keep copy short.
- Always show plan, AI status, reset timing, and what still works.
- Never show large comparison tables.

### Dashboard

- Show richer usage detail.
- Link usage to learning value and next action.
- Keep Activity separate from Learning.

### Website

- Explain Free, Trial, and Pro in plain language.
- Do not show fake readiness or provider-specific billing terms.

### Account

- Explain current plan and billing state clearly.
- Do not say billing is ready unless checkout really works.

## Approved tone

- calm
- premium
- trustworthy
- helpful
- non-punitive

## Banned tone

- alarmist
- fake urgency
- shame-based upsell
- technical provider jargon
- “you are blocked” without telling what still works
