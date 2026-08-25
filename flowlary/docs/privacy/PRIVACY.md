# Privacy (Phase 1)

Flowlary is privacy-first by design. Phase 1 establishes architecture only; enforcement is implemented as features are ported.

## Principles

1. Typed text is **not** sent anywhere unless required for the selected operation.
2. Layout conversion remains **local** whenever possible (Layfix `mapLayout`).
3. Translation sends text only when translation is explicitly requested.
4. Correction sends only relevant writing context (EWA segment limits).
5. Safety gate runs **before** any network call.

## Phase 1 Status

- Unified safety module created (field + token probes).
- No AI calls implemented yet.
- Storage namespaces isolated under `flowlary.*`.
- No analytics SDKs.

See `FL0_AUDIT.md` §13 and source `PRIVACY.md` files for full requirements.
