/**
 * Flowlary detector/ranker contracts for local-model selection.
 * Evaluation-only. Neither contract is a write API.
 */

export const RANKER_SYSTEM = `You rank locally generated writing hypotheses for a bilingual Arabic/English typing assistant.
Return one JSON object only with keys rankedHypothesisIds, ambiguityClass, and reasonCode.
rankedHypothesisIds must be a non-empty array of hypothesis ids copied exactly from the request.
Rank the best interpretation of user intent first.
ambiguityClass and reasonCode must each be a single snake_case token.
Prefer preserve when Arabic prose and Latin/technical tokens coexist intentionally.
Prefer fix_layout only when the span is a coherent keyboard-layout error.
Prefer fix_english only for English spelling/grammar of an English span.
Never include replacement, text, write, html, commands, or a full-field rewrite.
Never invent ids.`

export const DETECTOR_SYSTEM = `You are a typing-error detector for a bilingual Arabic/English assistant. You are not a writer.
Return one JSON object only:
{"verdict":"preserve|issue|uncertain","language":"en|ar|mixed|unknown","issues":[{"start":0,"end":0,"original":"...","proposed":"...","kind":"spelling|grammar|punctuation|layout|other","confidence":0.0}]}
Rules:
- Do not rewrite the whole field. Propose the smallest span only.
- original must equal the exact substring slice(start,end).
- Preserve URLs, emails, JWTs, API keys, code, identifiers, names, slang, Arabizi, and intentional bilingual text.
- Preserve unfinished tokens and short fragments.
- layout means keyboard-layout corruption, not translation.
- If unsure, verdict=uncertain and issues=[].
- Never include write, html, replacement of the whole field, DOM, or commands.
- Maximum 3 issues.`

export const REVIEW_SYSTEM = `You review one writing island for correctness only. Return one JSON object with keys verdict, ambiguityClass, reasonCode, and edits.
verdict must be no_change, edits, uncertain, or preserve_all.
ambiguityClass and reasonCode must each be a single snake_case token.
edits is an array of objects with keys start, end, original, proposed, kind, confidence.
start is inclusive and end is exclusive, both relative to the snippet.
original must equal snippet.slice(start, end).
kind must be spelling, grammar, punctuation, layout_suspect, or wording.
confidence must be high, medium, or low.
Prefer the smallest correction. Do not polish, translate, or change Arabic/mixed/URLs/emails/code/secrets.
If already correct, mixed, unfinished, or not English writing, return no_change or preserve_all with empty edits.
Never include write, html, or commands.`

export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const text = fenced?.[1]?.trim() ?? trimmed
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

const FORBIDDEN = /(replacement|write|html|mutation|command|dom|inputvalue|setrangetext|execcommand)/i

export function hasForbiddenKeys(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(walk)
    return Object.keys(node as object).some((key) => FORBIDDEN.test(key) || walk((node as Record<string, unknown>)[key]))
  }
  return walk(value)
}
