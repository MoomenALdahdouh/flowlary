# Flowlary — 40-Step Journey QA Matrix

Use after CWS + Paddle sandbox are configured. API steps can be automated via `npm run test:wl13b`.

| # | Stage | Action | Expected | Auto |
|---|-------|--------|----------|------|
| 1 | Discover | Open `/` | Product clear in 10s | Manual |
| 2 | Try web | Open Writing Lab | Real AI or sign-in gate | Manual |
| 3 | Try web | Open playground | “Simulated demo” badge, no network | Manual |
| 4 | Install | Get Flowlary CTA | Chrome Web Store (not support only) | Manual |
| 5 | Install | Install extension | SW starts, popup opens | Manual |
| 6 | First win | First popup | Fix Layout CTA + Speed Box hint | Manual |
| 7 | First win | Try Fix Layout on Gmail/Notion | Text remaps or card | Manual |
| 8 | First win | Skip / complete first win | Full popup home | Manual |
| 9 | Local | Fix Layout shortcut ⌘⇧P | Works signed out | Manual |
| 10 | Local | Speed Box ⌘⇧L | Overlay opens | Manual |
| 11 | Local | Speed Box chrome shortcut | Rebindable in `chrome://extensions/shortcuts` | Manual |
| 12 | Account | Register on website | Trial + verification email | wl13b |
| 13 | Account | Verify email | Account unlocked | wl13b |
| 14 | Account | Sign in extension | Same account | Manual |
| 15 | Onboarding | Sign in fresh install | No 4+7 tour before first win | Manual |
| 16 | Onboarding | After first win, sign in | ≤2 step wizard (consent + tools) | Manual |
| 17 | Onboarding | Tour | Optional via Settings / Overview | Manual |
| 18 | Consent | Enable Flowlary AI | Correction unlocked | Manual |
| 19 | First AI | Correction on page | Fix applies (direct or card) | Manual |
| 20 | Usage | Popup credits strip | “AI credits” not minutes | Manual |
| 21 | Usage | Dashboard usage card | Matches popup semantics | Manual |
| 22 | Settings | Overview modes | Direct/Card/Live parity with popup | Manual |
| 23 | Settings | Layout pair in Settings | Persists after reload | Manual |
| 24 | Settings | Speed Box toggle | Disables ⌘⇧L when off | Manual |
| 25 | Learning | Daily brief | Loads or fails soft | Manual |
| 26 | Learning | Coach | Loads or fails soft | Manual |
| 27 | Learning | Report | Export / narrative | Manual |
| 28 | Practice | Open from explanation | Dashboard practice with target | Manual |
| 29 | Exhaustion | Use credits to 0 | Local tools message + shortcuts | Manual |
| 30 | Exhaustion | Translate after exhaustion | Google path or clear message | Manual |
| 31 | Upgrade | Upgrade CTA | Opens pricing / checkout | Manual |
| 32 | Checkout | Paddle sandbox pay | `?checkout=complete` polling | Manual |
| 33 | Entitlement | Extension after Pro | Pro without 5‑min wait | Manual |
| 34 | Portal | Manage subscription | Paddle portal opens | Manual |
| 35 | Auth | Forgot password | Email + reset page | Manual |
| 36 | i18n | Arabic UI | Card Apply/Dismiss localized | Manual |
| 37 | Error | No editable tab | Visible error, not silent | Manual |
| 38 | Error | API offline | Retry + layout fallback copy | Manual |
| 39 | Account switch | User B after A | Isolated local data | wl13b |
| 40 | Reinstall | Login again | Pro restores from server | Manual |

## Commands

```bash
npm run dev:api
npm run dev:web
npm run test:wl13b
npm run test:wl13b-live
```
