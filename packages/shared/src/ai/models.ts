/** Centralized server-side Groq model configuration (Phase 16). */
export const AI_MODELS = {
  /** Groq replacement for deprecated llama-3.1-8b-instant (retired 2026-08-16). */
  CORRECTION: 'openai/gpt-oss-20b',
  TRANSLATION: 'openai/gpt-oss-120b',
  LAYOUT_CLASSIFIER: 'allam-2-7b',
  /** Hypothesis ranker — Groq production JSON model (Phase 5 shadow eval). */
  HYPOTHESIS_ADVISOR: 'openai/gpt-oss-20b',
} as const

export type AiOperation = 'correction' | 'translation' | 'layout-classification'

export const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
