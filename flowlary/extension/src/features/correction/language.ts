import { CORRECTION_DEFAULTS } from '@flowlary/shared'

const ENGLISH_FUNCTION_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'it',
  'this',
  'that',
  'with',
  'as',
  'from',
  'by',
  'my',
  'your',
  'our',
  'their',
  'not',
  'have',
  'has',
  'had',
  'will',
  'would',
  'can',
  'could',
  'should',
  'do',
  'does',
  'did',
  'am',
  'me',
  'him',
  'her',
  'them',
  'about',
  'into',
  'than',
  'then',
  'so',
  'because',
  'when',
  'where',
  'what',
  'who',
  'how',
  'which',
  'hello',
  'hi',
  'please',
  'thanks',
  'thank',
  'yes',
  'no',
  'ok',
  'okay',
]);

/** Common non-English Latin cues (Spanish/French/German/Portuguese/Italian/etc.). */
const NON_ENGLISH_LATIN_HINTS =
  /[àâæçéèêëïîôœùûüÿñáíóúü¿¡äößæøåāăąćčďēėęğīıłńňōőřśšťūůűźżž]/i;

const NON_ENGLISH_FUNCTION_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'que',
  'de',
  'del',
  'en',
  'por',
  'para',
  'con',
  'como',
  'esta',
  'esto',
  'hola',
  'gracias',
  'bonjour',
  'merci',
  'je',
  'tu',
  'nous',
  'vous',
  'les',
  'des',
  'une',
  'est',
  'pas',
  'oui',
  'non',
  'ich',
  'und',
  'nicht',
  'der',
  'die',
  'das',
  'ist',
  'ein',
  'eine',
  'obrigado',
  'nao',
  'não',
  'voce',
  'você',
  'ciao',
  'grazie',
  'sono',
  'merhaba',
  'nasilsin',
  'nasılsın',
  'teşekkür',
  'tesekkur',
]);

const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
const CYRILLIC = /[\u0400-\u04FF]/;
const TURKISH_HINTS = /[ğüşıöçĞÜŞİÖÇ]/;
const LATIN_WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

export type LanguageDecision = {
  isEnglish: boolean;
  reason: string;
  confidence: number;
};

export function shouldSkipTinySample(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const words = trimmed.match(LATIN_WORD) ?? [];
  if (trimmed.length < 8 && words.length < 3) return true;
  const tinyAllow = new Set(['hi', 'hello', 'thanks', 'thank', 'yes', 'no', 'ok', 'okay', 'i']);
  if (words.length === 1 && tinyAllow.has(words[0]!.toLowerCase())) return true;
  return false;
}

export function scriptCounts(text: string): {
  arabic: number;
  cjk: number;
  cyrillic: number;
  latin: number;
} {
  return {
    arabic: (text.match(/[\u0600-\u06FF]/g) ?? []).length,
    cjk: (text.match(/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/g) ?? []).length,
    cyrillic: (text.match(/[\u0400-\u04FF]/g) ?? []).length,
    latin: (text.match(/[A-Za-z]/g) ?? []).length,
  };
}

/** Arabic / CJK / Cyrillic outweigh Latin — never show the English assistant. */
export function hasDominantNonLatinScript(text: string): boolean {
  const { arabic, cjk, cyrillic, latin } = scriptCounts(text);
  const nonLatin = arabic + cjk + cyrillic;
  if (nonLatin === 0) return false;
  return nonLatin >= Math.max(1, latin);
}

export function detectEnglish(text: string): LanguageDecision {
  const trimmed = text.trim();
  if (!trimmed) {
    return { isEnglish: false, reason: 'empty', confidence: 1 };
  }

  // Script check first — short Arabic must not be treated as "too_short"
  const { arabic, cjk, cyrillic, latin } = scriptCounts(trimmed);
  const totalScript = arabic + cjk + cyrillic + latin || 1;
  const nonLatinHits =
    (ARABIC.test(trimmed) ? 1 : 0) +
    (CJK.test(trimmed) ? 1 : 0) +
    (CYRILLIC.test(trimmed) ? 1 : 0);

  if (hasDominantNonLatinScript(trimmed) || (arabic + cjk + cyrillic) / totalScript > 0.2) {
    return { isEnglish: false, reason: 'non_latin_script', confidence: 0.95 };
  }

  if (shouldSkipTinySample(trimmed)) {
    return { isEnglish: false, reason: 'too_short', confidence: 0.9 };
  }

  const words = trimmed.toLowerCase().match(LATIN_WORD) ?? [];
  if (words.length === 0) {
    return { isEnglish: false, reason: 'no_latin_words', confidence: 0.9 };
  }

  const englishHits = words.filter((w) => ENGLISH_FUNCTION_WORDS.has(w)).length;
  const foreignHits = words.filter((w) => NON_ENGLISH_FUNCTION_WORDS.has(w)).length;
  const ratio = englishHits / words.length;
  const latinRatio = latin / totalScript;

  if (foreignHits > englishHits && foreignHits >= 1) {
    return { isEnglish: false, reason: 'non_english_function_words', confidence: 0.9 };
  }

  if (TURKISH_HINTS.test(trimmed) && englishHits / Math.max(words.length, 1) < 0.2) {
    return { isEnglish: false, reason: 'likely_turkish', confidence: 0.85 };
  }

  if (NON_ENGLISH_LATIN_HINTS.test(trimmed) && ratio < 0.25) {
    return { isEnglish: false, reason: 'non_english_diacritics', confidence: 0.85 };
  }

  if (latinRatio < 0.7 && nonLatinHits > 0) {
    return { isEnglish: false, reason: 'mixed_insufficient_english', confidence: 0.8 };
  }

  // Need a real English signal — do not treat all Latin text as English
  if (words.length >= 2 && (ratio >= 0.2 || englishHits >= 1)) {
    return {
      isEnglish: true,
      reason: 'english_function_words',
      confidence: Math.min(0.95, 0.5 + ratio),
    };
  }

  if (ratio >= 0.25) {
    return { isEnglish: true, reason: 'english_score', confidence: Math.min(0.95, 0.55 + ratio) };
  }

  return { isEnglish: false, reason: 'low_english_score', confidence: 0.75 };
}

/** True when the text is clearly not English writing we should assist. */
export function isNonEnglishWriting(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (hasDominantNonLatinScript(trimmed)) return true;
  const decision = detectEnglish(trimmed);
  if (decision.isEnglish) return false;
  // Ambiguous / short Latin (including typo drafts like "hell hwo ate") is not
  // "clearly non-English" — keep the UI; API eligibility stays stricter.
  if (
    decision.reason === 'too_short' ||
    decision.reason === 'empty' ||
    decision.reason === 'low_english_score'
  ) {
    return false;
  }
  return (
    decision.reason === 'non_latin_script' ||
    decision.reason === 'non_english_function_words' ||
    decision.reason === 'likely_turkish' ||
    decision.reason === 'non_english_diacritics' ||
    decision.reason === 'mixed_insufficient_english' ||
    decision.reason === 'no_latin_words'
  );
}

/** Gate for showing the correction UI at all — English / Latin drafts only. */
export function shouldShowEnglishAssistant(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > CORRECTION_DEFAULTS.MAX_ASSIST_CHARS) return false;
  if (hasDominantNonLatinScript(trimmed)) return false;
  if (isNonEnglishWriting(trimmed)) return false;
  // Must contain Latin letters (English alphabet)
  return /[A-Za-z]/.test(trimmed);
}

export function isEligibleForCorrection(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > CORRECTION_DEFAULTS.MAX_ASSIST_CHARS) return false;
  if (!shouldShowEnglishAssistant(trimmed)) return false;
  const words = trimmed.match(LATIN_WORD) ?? [];
  if (trimmed.length < CORRECTION_DEFAULTS.MIN_CHARS && words.length < CORRECTION_DEFAULTS.MIN_WORDS) return false;
  return detectEnglish(trimmed).isEnglish;
}
