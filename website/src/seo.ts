import type { AppRoute } from './routes.ts'
import { SITE_NAME, SITE_URL } from './config.ts'
import { structuredDataJson } from './components/JsonLd.tsx'
import { BLOG_POSTS } from './bolt/data/site.tsx'
import type { Messages } from './i18n/en.ts'

export type PageMeta = {
  title: string
  description: string
  path: string
  ogType?: 'website' | 'article'
  robots?: 'noindex, nofollow'
  image?: string
}

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og.svg`

export const PAGE_META: Record<AppRoute, PageMeta> = {
  '/': {
    path: '/',
    title: `${SITE_NAME} · Write where you are`,
    description:
      'Flowlary is a Chrome writing companion for bilingual writers: keyboard layout repair, English help, and translation in the field you already type in.',
  },
  '/product': {
    path: '/product',
    title: `How Flowlary works · ${SITE_NAME}`,
    description:
      'See how the popup, keyboard shortcuts, Speed Box, Writing Lab, and dashboard work together as one Chrome writing companion.',
  },
  '/try': {
    path: '/try',
    title: `Try Flowlary · ${SITE_NAME}`,
    description:
      'Simulated demos for correction, translation, and keyboard-layout repair. No install or account required.',
  },
  '/lab': {
    path: '/lab',
    title: `Writing Lab · ${SITE_NAME}`,
    description:
      'Live AI writing correction on the web. Sign in to analyze your English and save learning progress to your account.',
  },
  '/features': {
    path: '/features',
    title: `What Flowlary helps with · ${SITE_NAME}`,
    description:
      'Keyboard layout repair, English help, translation, live translation, Speed Box, and learning from your writing.',
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
      'Rate Flowlary, suggest features, vote on ideas, and open a tracked support request.',
  },
  '/admin/feedback': {
    path: '/admin/feedback',
    title: `Feedback admin · ${SITE_NAME}`,
    description:
      'Internal Flowlary feedback inbox for reviewing user feedback, feature requests, and support tickets.',
    robots: 'noindex, nofollow',
  },
  '/admin': {
    path: '/admin',
    title: `Admin · ${SITE_NAME}`,
    description: 'Internal Flowlary administration for accounts, billing, usage, and support activity.',
    robots: 'noindex, nofollow',
  },
  '/admin/login': {
    path: '/admin/login',
    title: `Admin sign in · ${SITE_NAME}`,
    description: 'Sign in with a Flowlary administrator email and password to open the internal admin panel.',
    robots: 'noindex, nofollow',
  },
  '/admin/users': {
    path: '/admin/users',
    title: `Admin users · ${SITE_NAME}`,
    description: 'Internal directory of Flowlary accounts, entitlements, and account status.',
    robots: 'noindex, nofollow',
  },
  '/admin/subscriptions': {
    path: '/admin/subscriptions',
    title: `Admin subscriptions · ${SITE_NAME}`,
    description: 'Internal view of Paddle subscription records mirrored into Flowlary.',
    robots: 'noindex, nofollow',
  },
  '/admin/usage': {
    path: '/admin/usage',
    title: `Admin usage · ${SITE_NAME}`,
    description: 'Internal AI usage and credit consumption for the Flowlary platform.',
    robots: 'noindex, nofollow',
  },
  '/admin/support': {
    path: '/admin/support',
    title: `Admin support · ${SITE_NAME}`,
    description: 'Internal inbox for Flowlary support tickets and follow-up replies.',
    robots: 'noindex, nofollow',
  },
  '/admin/activity': {
    path: '/admin/activity',
    title: `Admin activity · ${SITE_NAME}`,
    description: 'Internal audit trail of admin actions, signups, and billing webhook events.',
    robots: 'noindex, nofollow',
  },
  '/admin/settings': {
    path: '/admin/settings',
    title: `Admin settings · ${SITE_NAME}`,
    description: 'Internal operational status for billing, providers, and feature availability.',
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
    description:
      'Stories about bilingual writing, keyboard mix-ups, in-field help, and how Flowlary stays in the field you already type in.',
  },
  '/account': {
    path: '/account',
    title: `Account · ${SITE_NAME}`,
    description:
      'Sign in to your Flowlary account used by the Chrome companion. Pro is confirmed by Flowlary after verified billing.',
    robots: 'noindex, nofollow',
  },
  '/dashboard': {
    path: '/dashboard',
    title: `Dashboard · ${SITE_NAME}`,
    description:
      'Your Flowlary workspace: overview, practice, progress, learning report, settings, and account.',
    robots: 'noindex, nofollow',
  },
  '/dashboard/support': {
    path: '/dashboard/support',
    title: `Support tickets · ${SITE_NAME}`,
    description: 'Your Flowlary support tickets and requests.',
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

function adminFallbackMeta(normalized: string): PageMeta | null {
  if (normalized !== '/admin' && !normalized.startsWith('/admin/')) return null
  const exact = PAGE_META[normalized as AppRoute]
  if (exact) return exact
  return {
    ...PAGE_META['/admin'],
    path: normalized,
    title: `Admin · ${SITE_NAME}`,
  }
}

export function resolveMeta(pathname: string): PageMeta {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  const adminMeta = adminFallbackMeta(normalized)
  if (adminMeta) return adminMeta
  if (normalized.startsWith('/blog/')) {
    const slug = normalized.slice('/blog/'.length)
    const post = BLOG_POSTS.find((item) => item.slug === slug)
    if (post) {
      return {
        path: normalized,
        title: `${SITE_NAME} · Blog`,
        description: 'A Flowlary story about bilingual writing and help in the field.',
        ogType: 'article',
        image: `${SITE_URL}${post.cover}`,
      }
    }
  }
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
  const image = meta.image ?? DEFAULT_OG_IMAGE
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
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

const SEO_PATH: Record<string, keyof Messages['pages']['seo']> = {
  '/': 'home',
  '/product': 'product',
  '/try': 'try',
  '/lab': 'lab',
  '/features': 'features',
  '/features/writing-correction': 'writing',
  '/features/translation': 'translation',
  '/features/live-translation': 'live',
  '/features/keyboard-layout': 'keyboard',
  '/features/speed-box': 'speed',
  '/pricing': 'pricing',
  '/about': 'about',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/cookies': 'cookies',
  '/contact': 'contact',
  '/support': 'support',
  '/feedback': 'feedback',
  '/guide': 'guide',
  '/blog': 'blog',
  '/account': 'account',
  '/dashboard': 'dashboard',
  '/dashboard/support': 'tickets',
  '/account/forgot-password': 'forgot',
  '/account/reset-password': 'reset',
  '/admin/feedback': 'adminFeedback',
  '/admin': 'admin',
  '/admin/login': 'adminLogin',
  '/admin/users': 'admin',
  '/admin/subscriptions': 'admin',
  '/admin/usage': 'admin',
  '/admin/support': 'admin',
  '/admin/activity': 'admin',
  '/admin/settings': 'admin',
}

export function resolveLocalizedMeta(pathname: string, pages: Messages['pages']): PageMeta {
  const base = resolveMeta(pathname)
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  if (normalized.startsWith('/blog/')) {
    const slug = normalized.slice('/blog/'.length) as keyof typeof pages.blogPage.posts
    const post = pages.blogPage.posts[slug]
    if (post) {
      const listed = BLOG_POSTS.find((item) => item.slug === slug)
      return {
        path: normalized,
        title: `${post.title} · ${SITE_NAME}`,
        description: post.excerpt,
        ogType: 'article',
        image: listed ? `${SITE_URL}${listed.cover}` : DEFAULT_OG_IMAGE,
      }
    }
  }
  const key = SEO_PATH[normalized]
  if (key) {
    const loc = pages.seo[key]
    return { ...base, title: loc.title, description: loc.description }
  }
  if (normalized.startsWith('/admin/') && !(normalized in PAGE_META)) {
    const loc = pages.seo.admin
    return { ...base, title: loc.title, description: loc.description }
  }
  if (!PAGE_META[normalized as AppRoute]) {
    return { ...base, title: pages.seo.notFound.title, description: pages.seo.notFound.description }
  }
  return base
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
