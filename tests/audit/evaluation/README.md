# LLM architecture evaluation (isolated)

Not imported by the extension, website, or backend.

- `generate.ts` — unseen 4500-case corpus (seed `20261015`)
- `local-baseline.eval.test.ts` — local Decision Engine metrics only
- `local-baseline-results.json` — last run output (generated)

Run from `extension/`:

```bash
npm run test -- ../tests/audit/evaluation/local-baseline.eval.test.ts
```

No Groq / Gemini / OpenRouter calls. Production advisor, models, and Write Gate are unchanged.

Local-model selection study (isolated; Ollama optional):

```bash
cd tests/audit/evaluation
npx vitest run --config local-ai-model-selection.vitest.config.ts
```

Report: `docs/audit/LOCAL_AI_MODEL_SELECTION_REPORT.md`
