# Phase 23 — Production QA Matrix

| Dimension | Desktop LTR | Mobile LTR | Desktop RTL | Mobile RTL | Light | Dark | Reduced motion | Offline | Signed out | Signed in | No learning data | With learning | AI unavailable | AI available |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Popup | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | partial | ✓ | ✓ | n/a | n/a | ✓ | ✓ |
| Dashboard Overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Progress | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | n/a |
| Practice | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings / Data | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | n/a |
| Privacy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a | n/a |
| Account | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | n/a | ✓ | ✓ |
| Onboarding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | resume | ✓ | ✓ |
| Website | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | partial | ✓ | ✓ | n/a | n/a | n/a | n/a |

**Legend:** ✓ verified by automated tests + code audit; partial = degraded but usable; n/a = not applicable.

**Manual Chrome E2E** (textarea, contenteditable, password field block) remains recommended before store submission — not fully automated in CI.
