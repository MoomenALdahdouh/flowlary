# Provider evaluation (gated)

These tests and scripts **call real models**. They are evidence for contract reliability, not the default CI gate.

| Mechanism | Gate |
| --- | --- |
| Writing review live unit | `GROQ_API_KEY` + `FLOWLARY_LIVE_WRITING_REVIEW=1` |
| Groq advisor live | `FLOWLARY_GROQ_LIVE=true` |
| Gemini advisor live | `FLOWLARY_GEMINI_LIVE=true` / `FLOWLARY_GEMINI_FULL_LIVE` |
| OpenRouter live | `FLOWLARY_OPENROUTER_LIVE=true` |
| gpt-oss full holdout | `FLOWLARY_GPT_OSS_FULL_LIVE` |
| Probes | `npm run probe:advisor-live` / `probe:writing-review-live` |

Outputs such as `tests/e2e/results/writing-review-provider-probe.json` must stay **sanitized** (no field text).

Historical write-ups live under `docs/audit/` (e.g. Gemini / gpt-oss shadow reports). Current runtime rules are [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md).
