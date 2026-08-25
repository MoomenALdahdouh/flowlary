# Privacy (Phase 1)

Flowlary is privacy-first by design. Phase 1 establishes architecture only; enforcement is implemented as features are ported.

## Principles

1. Typed text is **not** sent anywhere unless required for the selected operation.
2. Layout conversion remains **local** whenever possible (Layfix `mapLayout`).
3. Translation sends text only when translation is explicitly requested.
4. Correction sends only relevant writing context (EWA segment limits).
5. Safety gate runs **before** any network call.

## Phase 7 Status

- English correction uses BYOK Groq via service worker only.
- Text is sent only after safety passes and English eligibility is confirmed.
- API keys stored in local extension storage (`flowlary.correction.groqKey`).
- No correction text or keys are logged or sent to Flowlary servers.

See `FL0_AUDIT.md` §13 and source `PRIVACY.md` files for full requirements.
