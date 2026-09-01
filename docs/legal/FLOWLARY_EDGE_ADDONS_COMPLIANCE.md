# Flowlary Microsoft Edge Add-ons Compliance

**Reference:** [Microsoft Edge Add-ons developer agreement / policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies) (consult current version)  
**Status label:** READY FOR SUBMISSION preparation (not guaranteed approval)

Edge accepts Manifest V3 Chromium extensions with similar technical requirements to Chrome. Policies differ in enforcement details — verify current Microsoft documentation at submission time.

| Requirement | Evidence | Status | Required action |
|-------------|----------|--------|-----------------|
| Accurate representation | Website + Privacy + Terms | READY | Match Edge listing to site |
| Single purpose | Writing companion | READY | |
| Permission justification | Extension privacy disclosure | READY | |
| Privacy policy link | `https://flowlary.com/privacy` | READY | |
| Personal information handling | Privacy policy §§5–9 | READY | |
| Third-party services | Groq, Google, Paddle listed | READY | |
| Secure transmission | HTTPS API in release | READY | |
| No remote code | Bundled MV3 | READY | |
| User consent for AI | Extension AI consent + account | READY | |
| Paid features disclosure | Pricing page, Paddle | READY | |
| Localization | EN + AR website; extension i18n | PARTIAL | Edge listing languages OPS |
| Support contact | `/contact` | PARTIAL | Add email when published |
| Store listing consistency | Store matrix doc | READY | |
| Prohibited content | No prohibited claims in repo audit | READY | |
| `<all_urls>` scope | Same as Chrome | REVIEW | Justify in notes |

## Edge-specific notes

- Edge may require Partner Center developer account verification separately from Chrome.
- Privacy questions in Partner Center should mirror Chrome data safety answers.
- If publishing same package as Chrome, diff only store metadata — manifest identical from `manifest.prod.json`.

## Gaps

1. Support email (LEGAL/OPS INPUT REQUIRED)
2. Edge Partner Center account + listing assets
3. Legal review of policies
4. Live verification on Edge stable after install
