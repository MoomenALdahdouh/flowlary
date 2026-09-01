/**
 * Supported writing environments for Flowlary.
 *
 * Only mark `supported: true` when the extension is designed to work there.
 * Brand names require an explicit note in `verificationNote` when not individually QA'd.
 */

export type SupportedPlatform = {
  id: string
  name: string
  /** Short label for cards (EN source; localized via i18n keys when rendered). */
  description: string
  url: string | null
  /** Whether Flowlary is designed to support writing in this environment. */
  supported: boolean
  /** How this support claim was established. */
  verification: 'architecture' | 'field-type' | 'documented-limitation'
  icon: 'chrome' | 'textarea' | 'contenteditable' | 'iframe' | 'web' | 'blocked'
}

export const SUPPORTED_PLATFORMS: readonly SupportedPlatform[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    description: 'Flowlary runs as a Chrome extension on sites you open.',
    url: 'https://www.google.com/chrome/',
    supported: true,
    verification: 'architecture',
    icon: 'chrome',
  },
  {
    id: 'web-forms',
    name: 'Web forms & text fields',
    description: 'Standard text inputs and textareas on websites.',
    url: null,
    supported: true,
    verification: 'field-type',
    icon: 'textarea',
  },
  {
    id: 'contenteditable',
    name: 'Contenteditable fields',
    description: 'Many rich text and chat inputs that expose editable surfaces.',
    url: null,
    supported: true,
    verification: 'field-type',
    icon: 'contenteditable',
  },
  {
    id: 'same-origin-iframes',
    name: 'Same-origin embedded editors',
    description: 'Embedded compose fields when the page allows same-origin iframe access (e.g. some email compose surfaces).',
    url: null,
    supported: true,
    verification: 'architecture',
    icon: 'iframe',
  },
  {
    id: 'code-editors',
    name: 'Code editors',
    description: 'Monaco, CodeMirror, and similar code surfaces are intentionally skipped.',
    url: null,
    supported: false,
    verification: 'documented-limitation',
    icon: 'blocked',
  },
] as const

export function listPublicSupportedPlatforms(): SupportedPlatform[] {
  return SUPPORTED_PLATFORMS.filter((platform) => platform.supported)
}
