# Flowlary Chrome Web Store Compliance

**Reference:** [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/) (consult current version before submission)  
**Status label:** READY FOR SUBMISSION (not guaranteed approval)

| Requirement | Evidence in repo | Status | Required action |
|-------------|------------------|--------|-----------------|
| Single purpose | Writing assistance in editable fields | READY | Listing text must match |
| Accurate description | Website features/pricing/support | READY | Align listing with site |
| Permission justification | `FLOWLARY_EXTENSION_PRIVACY_DISCLOSURE.md` | READY | Paste into store form |
| Minimal permissions | storage, activeTab, clipboardWrite + API host | READY | No extra permissions |
| Host permissions scoped | prod: `api.flowlary.com` only | READY | Verify release manifest |
| Privacy policy URL | `/privacy` on flowlary.com | READY | Publish site first |
| Data use disclosure | Privacy + extension disclosure docs | READY | Declare text processing |
| User data handling | Safety gate, user controls documented | READY | |
| Third-party sharing | Groq, Google, Paddle disclosed | READY | |
| No remote code | MV3 bundled worker | READY | |
| No misleading claims | Security claim audit performed | READY | Avoid “100% private” |
| `<all_urls>` justification | Needed for in-page writing on any site | REVIEW | Explain in submission notes |
| Support contact | `/contact` page | PARTIAL | Publish support email when available |
| Store listing vs manifest | Same permissions | READY | |
| Payments disclosure | Paddle, Pro pricing on site | READY | Declare paid features |
| Single item listing | One extension product | READY | |
| Screenshots / assets | Not in repo | OPS | Prepare store assets |
| CWS URL in config | `CHROME_WEB_STORE_URL = null` | BLOCKED | Publish listing + set URL |

## Data safety form (typical fields)

| Category | Flowlary |
|----------|----------|
| Personally identifiable information | Email (account); user-typed text may include PII |
| Health information | Not targeted; user may type anything |
| Financial information | Blocked fields; Paddle handles payments |
| Authentication information | Password fields blocked by safety gate |
| Personal communications | User text in fields when features run |
| Location | Not collected |
| Web history | Not collected as history |
| User activity | Local usage counters; server usage metadata |

## Gaps before submission

1. Legal entity and support email (LEGAL INPUT REQUIRED)
2. Live CWS listing URL
3. Lawyer review of Privacy/Terms
4. Manual test build from `npm run package:release`
