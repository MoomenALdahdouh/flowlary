# Flowlary Store Disclosure Matrix

Cross-check of important claims across surfaces. **Last updated:** 30 August 2026

| Claim | Website | Privacy | Terms | Chrome draft | Edge draft | Manifest | Actual behavior |
|-------|---------|---------|-------|--------------|------------|----------|-------------------|
| Writing text sent for AI | Yes (features, lab) | §6–7 | §13 | Yes | Yes | N/A | Yes — api.flowlary.com |
| Local layout repair | Yes | §10 | §3 | Yes | Yes | N/A | Yes — mapLayout |
| Account required for managed AI | Yes | §7 | §4 | Yes | Yes | N/A | Yes — auth middleware |
| Free 500 checks/day | Pricing | §5 (via plans) | §5 | N/A | N/A | N/A | Yes — credits.ts |
| Trial 1000 / 30 days | Pricing | §5 | §6 | N/A | N/A | N/A | Yes — account types |
| Pro $4.99 / $39 | Pricing | §11 | §7 | N/A | N/A | N/A | Yes — pricing.ts |
| Paddle payments | Pricing FAQ | §11 | §9 | N/A | N/A | N/A | Yes — billing/* |
| No card storage | Pricing | §11 | §9 | N/A | N/A | N/A | Yes |
| Student = academic email | Pricing | §12 | §8 | N/A | N/A | N/A | Yes — not enrollment |
| Learning syncs when signed in | Features/home | §9 | N/A | N/A | N/A | N/A | Yes — remoteSync |
| No analytics SDK on site | About/privacy | §3 | N/A | N/A | N/A | N/A | Yes |
| Permissions: storage/activeTab/clipboard | Guide/support | §4 | N/A | Yes | Yes | Yes | Yes |
| Host: api.flowlary.com (release) | N/A | §4 | N/A | Yes | Yes | Yes | Yes — manifest.prod |
| `<all_urls>` content script | Guide | §4 | N/A | Yes | Yes | Yes | Yes |
| Account deletion self-service | Contact/privacy | §17 | N/A | N/A | N/A | N/A | **No** — not implemented |
| Support email published | Contact note | §22 | §24 | Missing | Missing | N/A | **No** |
| Legal entity named | Terms | §2 | §22 | Missing | Missing | N/A | **No** |
| GDPR/CCPA compliant | None | Explicitly not claimed | Not claimed | Not claimed | Not claimed | N/A | Not verified |

## Actions for consistency

- [x] Fix Privacy learning sync contradiction
- [x] Remove “For legal review” from public UI
- [x] Soften “sent securely” → HTTPS accurate wording
- [ ] Set `CHROME_WEB_STORE_URL` after listing live
- [ ] Add support/privacy email when ops confirms
