/** Centralized server-side Groq model configuration (Phase 16). */
export const AI_MODELS = {
  CORRECTION: 'llama-3.1-8b-instant',
  TRANSLATION: 'openai/gpt-oss-120b',
  LAYOUT_CLASSIFIER: 'allam-2-7b',
} as const

export type AiOperation = 'correction' | 'translation' | 'layout-classification'

export const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
