import type { AppRoute } from './routes.ts'
import { SITE_NAME, SITE_URL } from './config.ts'
import { structuredDataJson } from './components/JsonLd.tsx'

export type PageMeta = {
  title: string
  description: string
  path: string
  ogType?: 'website' | 'article'
  robots?: 'noindex, nofollow'
}

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og.svg`

export const PAGE_META: Record<AppRoute, PageMeta> = {
  '/': {
    path: '/',
    title: `${SITE_NAME} · Writing and English learning companion for Chrome`,
    description:
      'Write, correct, translate, repair keyboard-layout mistakes, and learn from your everyday English writing without switching tools.',
  },
  '/features': {
    path: '/features',
    title: `Writing, communication, and learning features · ${SITE_NAME}`,
    description:
      'Explore writing correction, translation, keyboard-layout repair, and learning from recurring patterns — connected in one Chrome writing companion.',
  },
  '/features/writing-correction': {
    path: '/features/writing-correction',
    title: `English writing correction · ${SITE_NAME}`,
    description:
      'Improve English spelling and grammar in the page you are already writing. You stay in control of every change.',
  },
  '/features/translation': {
    path: '/features/translation',
    title: `Translation · ${SITE_NAME}`,
    description:
      'Translate the text you are writing with a keyboard shortcut. Choose source and target languages in Flowlary.',
  },
  '/features/live-translation': {
    path: '/features/live-translation',
    title: `Live translation · ${SITE_NAME}`,
    description:
      'Optional live translation updates as you type. It is off by default and can be turned on in settings.',
  },
  '/features/keyboard-layout': {
    path: '/features/keyboard-layout',
    title: `Keyboard layout correction · ${SITE_NAME}`,
    description:
      'Fix text typed on the wrong keyboard layout. Flowlary remaps keystrokes · it is not ordinary spell check.',
  },
  '/features/speed-box': {
    path: '/features/speed-box',
    title: `Speed Box · ${SITE_NAME}`,
    description:
      'Convert a snippet between keyboard layouts in a quick overlay, then copy the result.',
  },
  '/pricing': {
    path: '/pricing',
    title: `Free and Pro pricing · ${SITE_NAME}`,
    description:
      'Start with a useful Free plan, try the complete Pro learning experience for 30 days, or choose monthly, annual, and verified student access.',
  },
  '/about': {
    path: '/about',
    title: `About · ${SITE_NAME}`,
    description:
      'Flowlary is a Chrome writing companion for correction, translation, and keyboard-layout mistakes.',
  },
  '/privacy': {
    path: '/privacy',
    title: `Privacy Policy · ${SITE_NAME}`,
    description:
      'How Flowlary processes writing in the Chrome extension and when text is sent to Flowlary AI through api.flowlary.com.',
  },
  '/terms': {
    path: '/terms',
    title: `Terms of Service · ${SITE_NAME}`,
    description: 'Terms of use for the Flowlary website and Chrome extension.',
  },
  '/cookies': {
    path: '/cookies',
    title: `Cookie Policy · ${SITE_NAME}`,
    description: 'How Flowlary uses browser storage, extension storage, and payment-partner cookies.',
  },
  '/contact': {
    path: '/contact',
    title: `Contact · ${SITE_NAME}`,
    description: 'Contact paths for support, billing, privacy, and troubleshooting questions about Flowlary.',
  },
  '/support': {
    path: '/support',
    title: `Support · ${SITE_NAME}`,
    description:
      'Install Flowlary, troubleshoot common issues, and learn how AI features become available. Contact options are listed here.',
  },
  '/feedback': {
    path: '/feedback',
    title: `Feedback · ${SITE_NAME}`,
    description:
      'Share feedback, suggest features, vote on ideas, and contact Flowlary support from your signed-in account.',
    robots: 'noindex, nofollow',
  },
  '/admin/feedback': {
    path: '/admin/feedback',
    title: `Feedback admin · ${SITE_NAME}`,
    description:
      'Internal Flowlary feedback inbox for reviewing user feedback, feature requests, and support tickets.',
    robots: 'noindex, nofollow',
  },
  '/guide': {
    path: '/guide',
    title: `Tutorial · ${SITE_NAME}`,
    description:
      'Step-by-step guide to install Flowlary, enable Flowlary AI, turn on features, use shortcuts, and open the dashboard. No API keys required.',
  },
  '/blog': {
    path: '/blog',
    title: `Blog · ${SITE_NAME}`,
    description: 'Flowlary product notes. No articles have been published yet.',
  },
  '/account': {
    path: '/account',
    title: `Account · ${SITE_NAME}`,
    description:
      'Sign in to your Flowlary account used by the Chrome companion. Pro is confirmed by Flowlary after verified billing.',
    robots: 'noindex, nofollow',
  },
  '/account/forgot-password': {
    path: '/account/forgot-password',
    title: `Reset password · ${SITE_NAME}`,
    description:
      'Request a password reset link for your Flowlary account. Links expire after one hour for security.',
    robots: 'noindex, nofollow',
  },
  '/account/reset-password': {
    path: '/account/reset-password',
    title: `Choose a new password · ${SITE_NAME}`,
    description:
      'Set a new password for your Flowlary account using your secure reset link.',
    robots: 'noindex, nofollow',
  },
}

export function canonicalUrl(path: string): string {
  if (path === '/') return `${SITE_URL}/`
  return `${SITE_URL}${path}`
}

export function resolveMeta(pathname: string): PageMeta {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  return (
    PAGE_META[normalized as AppRoute] ?? {
      path: pathname,
      title: `Page not found · ${SITE_NAME}`,
      description: 'That URL is not part of the Flowlary site.',
    }
  )
}

export function renderHeadTags(meta: PageMeta): string {
  const url = canonicalUrl(meta.path)
  const ogType = meta.ogType ?? 'website'
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />`,
    `<meta name="twitter:image:alt" content="${SITE_NAME} writing companion" />`,
    `<meta property="og:image:alt" content="${SITE_NAME} writing companion" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<script type="application/ld+json" id="fl-jsonld">${structuredDataJson()}</script>`,
  ]
  if (meta.robots) {
    tags.push(`<meta name="robots" content="${meta.robots}" />`)
  }
  return tags.join('\n    ')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
