# Architecture audit experiments (not production)

Labeled evaluation-only files for `docs/audit/DECISION_ENGINE_VS_LLM_ARCHITECTURE_AUDIT.md`.

- `holdout.eval.test.ts` — generated development / validation / holdout cases
- `analyzeShim.ts` — copy of `extension/src/core/engine/chunks.ts` plus the missing `corrected` binding so the rest of the engine can be imported
- `holdout-results.json` — last run output

These files are not imported by the extension, website, or backend.
