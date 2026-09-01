# Writing Review production path

Date: 2026-09-01

## Gap map (before this work)

| Status | Item |
| --- | --- |
| EXISTS | Spine: InputEngine → runFieldCycle → analyzeFieldText → collectHypotheses → decideWriting → UserWritingPolicy → Write Gate |
| EXISTS | `registerProductionWritingReview` in `startWritingRuntime` |
| EXISTS | `scheduleFieldWritingReview` in `pipeline.ts` |
| EXISTS | Contract `parseWritingReviewContent`, island extractor, ingest, Groq/Gemini/OpenRouter `reviewWriting` |
| EXISTS | Settings: assistant, helpStyle, `aiWritingReviewEnabled`, site exceptions (user-controlled, not a denylist) |
| PARTIALLY WIRED | Review fallback used `advisorFallbackEnabled` (default off) and `*AdvisorEnabled`, so Gemini/OpenRouter were often never in the review chain |
| PARTIALLY WIRED | Gateway extras (`ok`, `model`) vs contract; client now strips to four keys and pipeline re-validates |
| BROKEN | `scheduleRemoteEnglishAssist` still implied a second whole-field English LLM writer; CORRECT still could fall through to full-field correction |
| BROKEN | English words with trailing `,` / `.` were scored as Arabic-layout tokens (`it,`, `tomorrow.`), producing a false layout span over `it comming tomorrow` and dropping island spelling review |
| BROKEN | Unknown Latin inside a 3+ word English island next to Arabic was tagged `intentional_foreign_token`, so `decideWriting` blocked `comming → coming` as mixed |
| MISSING | Independent writing-review deadline (advisor 1500ms aborted fallback); client timeout 1800ms |
| DUPLICATED | Auto English LLM via pipeline English vs Writing Review |
| CONFLICTING | Advisor ranking flags vs writing-review availability |

Hypothesis Advisor was **not** turned into a text generator. RANK_HYPOTHESES remains ID-only.

No local SLM (Ollama / Qwen / Llama) was added.

## What was changed

1. **Real Groq → Gemini → OpenRouter review chain**  
   `writingReviewFallbackEnabled` (default on) is independent of advisor ranking fallback. Providers are included when API keys exist, even if Gemini/OpenRouter ranking flags are off. The review manager does not skip a provider because ranking `enabled` is false.

2. **Deadlines**  
   `WRITING_REVIEW_TIMEOUT_MS` default 4500. Gateway uses that timeout. Extension client timeout 5200ms. Typing never awaits the LLM.

3. **Contract**  
   Kinds: spelling, grammar, punctuation, `layout_suspect` only. `wording` is rejected. Prompt: correctness-only, no full-field rewrite, preserve AR/EN/mix/names/slang/tech/secrets; `layout_suspect` only if proposed equals `mapLayout(original)`.

4. **Apply path**  
   Review → validate → `ingestReviewEdits` → `decideWriting` → policy → Write Gate. Auto-write still requires helpStyle auto, high confidence, spelling/grammar/punctuation, monolingual English island, live text match.

5. **English assist absorbed**  
   `scheduleRemoteEnglishAssist` is a no-op. `runExplicitEnglishAssist` / CORRECT: instant span spell, then Writing Review ingest + Write Gate. No whole-field `correctFn`.

6. **Islands / mixed**  
   A Latin run of 3+ tokens is an English island: unknown tokens are not “intentional foreign”. Review skips URL/email/JWT/API-key fields. Selection, paste, composing, open token, shortcuts_only, layout auto-write, cached islands still skip.

7. **Layout false positive**  
   Trailing `,` / `.` on an English token are delimiters, not Arabic-layout letters. `it, comming tomorrow.` is no longer one layout blob.

## What actually runs

```
typing → local cycle (immediate)
  → completed English island
  → pause / sentence boundary
  → REVIEW_WRITING → POST /api/ai/writing-review
  → Groq; on failure Gemini; on failure OpenRouter
  → parseWritingReviewContent
  → ingestReviewEdits → decideWriting → Write Gate
```

If all providers fail, local decision stays authoritative. No voting.

## LLM providers actually called

Live probe `npm run probe:writing-review-live` (sanitized: `tests/e2e/results/writing-review-provider-probe.json`):

| Provider | Model | HTTP | Contract | Verdict | Latency |
| --- | --- | --- | --- | --- | --- |
| Groq | openai/gpt-oss-20b | success | valid | edits (1) | 929ms |
| Gemini | gemini-3.5-flash-lite | success | valid | edits (1) | 1049ms |
| OpenRouter | openai/gpt-4o-mini | success | valid | no_change | 1332ms |

Injected failure-only fallback: Groq RATE_LIMITED → Gemini SUCCESS.

Unit: Groq 429 → Gemini with fallback on; single Groq attempt with fallback off; Gemini used even when `geminiAdvisorEnabled` is false.

## Browser scenarios

`npm run build:ext` succeeded.

Playwright (`npm run test:e2e`) — **local writing (no API)**:

Passed: textarea/input/simple CE layout, bilingual layout mixes, protected URL/email/JWT/API key, paste (lab), undo, rapid typing, pause, continued typing, offline typing, reload, nested composer suggestion-not-write, mixed field not whole-rewritten, site exception on/off, typing P95 &lt; 250ms in the lab test.

Failed / not proven in this run:

- Service-worker `**/api/ai/writing-review` intercept cannot drive a live `comming → coming` in Chromium (SW fetch bypasses page `route`). Island apply is covered in unit tests with `setWritingReview`.
- CORRECT on `wierd` and TRANSLATE tests: **API not running** (`ECONNREFUSED 127.0.0.1:8787`). CORRECT now uses Writing Review, not whole-field correction, so it needs the gateway.
- Some longer layout corpus cases (`tonibt`, Arabic-on-English phrases) still fail in `real-usage-writing.spec.ts`; not treated as solved by sentence rules.

No Gmail composer was exercised (no account/session in this environment). Nested `#ce-rich` still does not auto-write layout (editor tier).

## Remaining failures and risks

1. Live island spelling in the real extension needs a running gateway (`dev:api` / writing-api.test).  
2. CORRECT/TRANSLATE E2E without API will fail.  
3. OpenRouter may return `no_change` on a misspelling while Groq/Gemini return edits — first valid response wins; no voting.  
4. Review P95 is cloud-bound (~1s per provider in the probe). Local typing is independent.  
5. Playwright cannot currently prove SW→gateway review in-page without a real API.  
6. Backend `tsc` still has unrelated store/feedback errors.

## Production readiness

**Local writing: production-capable** on input/textarea/simple contenteditable with the existing Write Gate, policy, and editor-tier rules.

**Writing Review: production-wired** as a separate, validated, failure-only cloud path (Groq → Gemini → OpenRouter). It is **ready to operate** when the gateway and keys are up. It is **not** a demo-only mock.

**Do not ship a local generative model** for this path.

Exact readiness: **conditional production** — ship the extension + gateway with `WRITING_REVIEW_ENABLED=1`, `WRITING_REVIEW_FALLBACK_ENABLED=1`, keys for Groq (required), Gemini and OpenRouter (fallback). Without the gateway, local layout/typo behavior remains; async language review and CORRECT-for-non-instant typos do not apply.
