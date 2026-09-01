# Flowlary Legal Input Register

Items requiring owner, operator, or qualified lawyer confirmation. **Do not guess.**

| Item | Current status | Evidence | Owner input required |
|------|----------------|----------|----------------------|
| Legal entity name | Not in repository | Terms §2 placeholder removed from UI; doc only | YES — company/individual name |
| Registered address | Not in repository | — | YES |
| Company registration number | Not in repository | — | YES |
| Governing law & jurisdiction | Not specified | Terms §22 | YES |
| Privacy contact email | Not published | Contact page routes only | YES — e.g. privacy@ |
| Support contact email | Not published | SMTP FROM is outbound (`noreply@flowlary.com`) | YES — e.g. support@ |
| DPO appointment | Not assessed | — | YES — if required by law |
| Minimum age / COPPA | Not specified | Terms §2 | YES |
| Refund policy | Not specified | Terms §11; Paddle default | YES |
| Chargeback policy | Not specified | — | YES |
| Tax/VAT disclosure | Not specified | — | YES |
| Data retention statutory periods | Partially technical only | Audit §6 | YES — legal retention schedule |
| Account deletion process & SLA | Not implemented | No DELETE /account API | YES — product + legal |
| International transfer mechanism | Not documented | Privacy §18 | YES — SCCs etc. |
| Groq DPA / subprocessor list | Groq used, contracts not in repo | backend groqClient | YES |
| Google Cloud DPA | Conditional on GOOGLE_TRANSLATE_* | env.ts | YES if enabled |
| Paddle DPA | Paddle integrated | billing/* | YES |
| Hosting provider / data location | Deployment docs vary | deploy/ | YES — production host region |
| Student eligibility rules (beyond email) | Academic domain list only | studentVerificationService | YES — program policy |
| Manual enrollment review process | API exists | enrollment/review endpoint | YES — ops procedure |
| Insurance / warranties | Disclaimer only | Terms §19 | YES |
| Impressum (EU) | Missing | — | YES if EU targeting |
| Cookie consent banner (EU/UK) | Not implemented | Cookie policy explains storage | YES — legal assessment |
| Arabic legal controlling language | Arabic translation provided | legalLocaleNote | YES — lawyer for AR markets |
| Edge/Chrome developer account owner | Not in repo | — | YES — ops |
| Certification claims (SOC2, ISO) | Not claimed | — | Do not add without proof |

## Implementation blockers tied to legal input

1. **Public support/privacy inbox** — required for store submission and GDPR access requests
2. **Legal entity block** in Terms/Privacy footer — required for commercial launch in many jurisdictions
3. **Account deletion** — often required for privacy laws; engineering not built
4. **Refund language** — must align with Paddle merchant settings
