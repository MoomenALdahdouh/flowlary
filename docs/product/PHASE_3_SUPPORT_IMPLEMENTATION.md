# Phase 3 — Production Support & Help Center

Implementation report for Flowlary customer support, help center, and ticket system.

---

## 1. Repository audit

**Already existed (Phase 1 VoC):**
- Static Help Center at `/support` (`SupportCenter.tsx`, EN/AR i18n)
- Support ticket store (`supportTicketsById`, threaded messages)
- Authenticated APIs: create/list/get/reply (user)
- Feedback hub contact form at `/feedback?tab=support`
- Rate limits (10 tickets/day, per-minute caps)
- Admin feedback inbox at `/admin/feedback`

**Gaps closed in Phase 3:**
- User ticket history UI (`/account/support`)
- Admin support inbox with replies (`/admin/support`)
- Issue type taxonomy, ticket display numbers
- Status transitions (user reply reopens `WAITING_FOR_USER`)
- Email notifications (when SMTP configured)
- Extension contextual support prefill
- Feedback ↔ ticket linking via `ticketId`

---

## 2. Architecture

```text
Help Center (/support)
    ↓
Contact Support (/feedback?tab=support or /account/support)
    ↓
Support Ticket (authenticated)
    ↓
Threaded messages (USER / SUPPORT)
    ↓
Resolution
```

**Separate paths preserved:**
- Feature requests → `/feedback?tab=features`
- Product feedback/ratings → `/feedback`
- Store reviews → optional CTA only

---

## 3. Database changes

JSON store (no new tables):

| Field | Location | Purpose |
|-------|----------|---------|
| `ticketId` | `FeedbackRecord` | Links feedback admin row to ticket |
| `priority` | `SupportTicketRecord` | Admin/system priority |

Existing structures reused: `supportTicketsById`, `supportTicketMessagesByTicket`, `supportTicketIdsByAccount`.

---

## 4. APIs

### User (Bearer auth)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/support/ticket` | Create ticket + initial message |
| GET | `/api/support/tickets` | List account tickets |
| GET | `/api/support/tickets/:id` | Ticket + message thread |
| POST | `/api/support/tickets/:id/message` | User reply |
| POST | `/api/support/tickets/:id/resolve` | User marks resolved |

### Admin (`FLOWLARY_FEEDBACK_ADMIN_EMAILS`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/feedback/admin/tickets` | Filterable ticket list |
| GET | `/api/feedback/admin/tickets/:id` | Ticket + thread + plan context |
| POST | `/api/feedback/admin/tickets/:id/reply` | Support reply |
| PATCH | `/api/feedback/admin/tickets/:id` | Status, priority, internal note |

---

## 5. Authorization

- Tickets scoped by `accountId` on every user request
- Plan shown to admin from `resolveServerEntitlementForAccount()` — never from client
- Users cannot set `CRITICAL`/`URGENT` priority
- Internal notes stored on linked feedback record — never returned in user APIs

---

## 6. Rate limiting

Reused existing middleware:

- 10 new tickets/day/account
- 30 messages/day/ticket
- Per-minute support-ticket operation limits

---

## 7. Help Center

Unchanged static i18n content at `/support` — categories for getting started, writing, translation, layout, learning, account, billing, student, troubleshooting.

Client-side search/filter only (no full-text engine).

---

## 8. Contact Support

- Issue types: `SUPPORT_ISSUE_TYPES` in `packages/shared/src/feedback.ts`
- Optional diagnostics: browser UA, extension version (user opt-in)
- Never captures page content, passwords, tokens

---

## 9. Account support

Route: `/account/support`

- Ticket list with status badges
- Ticket detail with threaded conversation
- Reply + mark resolved
- Empty state + create form

Dashboard overview links to support + help center.

---

## 10. Admin support

Route: `/admin/support`

- Status filter
- Ticket list with masked email + server plan
- Reply composer
- Status actions: Investigating, Resolve, Close
- Internal notes (admin-only)

---

## 11. Extension

Help & Feedback link opens `/feedback?tab=support&issueType=BUG&extVersion=…` with diagnostics opt-in prefilled.

---

## 12. Email notifications

When `SMTP_HOST` is configured:

| Event | Email |
|-------|-------|
| Ticket created | User confirmation + operator notification |
| Support replied | User notification (link only, no message body) |
| Ticket resolved | User notification |

Copy uses “We usually reply within 24 hours” — operational commitment for V1.

No email sent when SMTP is not configured (graceful no-op).

---

## 13. Privacy

Updated legal contact notes. Support messages stored in account-scoped JSON store. Diagnostics limited to approved technical fields.

**Retention:** Follows existing store persistence — no new public retention promise added.

---

## 14. EN / AR

Full `accountSupport` i18n namespace. Natural Arabic product copy (e.g. “تواصل مع الدعم”, “كيف يمكننا مساعدتك؟”).

---

## 15. Tests & builds

| Suite | Result |
|-------|--------|
| `phase3-support.test.ts` | 5/5 pass |
| Backend full | 148/148 pass |
| Website | 137/137 pass |
| `build:web` | Pass |
| `build:release` | Pass |

---

## 16. Protected systems

Verified unchanged:

```text
FREE_DAILY_CREDITS = 500
PRO_DAILY_CREDITS = 1000
TRIAL_DAILY_CREDITS = 1000
PRO_MONTHLY_SOFT_CAP = 30000
PRO_MONTHLY_PRICE_CENTS = 499
PRO_YEARLY_PRICE_CENTS = 3900
```

Auth, JWT, AI gateway, credits, Paddle, entitlements, extension bridge — not modified.

---

## 17. Remaining operational requirements

1. Configure production SMTP + `EMAIL_FROM`
2. Set `FLOWLARY_FEEDBACK_ADMIN_EMAILS` for admin access
3. Confirm `FLOWLARY_WEB_ORIGIN` for email links
4. Do not display `support@flowlary.com` until mailbox exists

---

## 18. Future improvements (P2+)

- Public roadmap section in help center
- Dedicated CMS for help articles
- SLA dashboard / live chat (explicitly out of scope for V1)

---

*Support solves problems. Feedback improves the product. Feature requests shape the roadmap. Store reviews provide public social proof — intentionally separate systems.*
