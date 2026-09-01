import { uiLocaleOgLocale } from '@flowlary/shared'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalUrl, resolveMeta } from '../seo.ts'
import { structuredDataJson } from './JsonLd.tsx'
import { useI18n } from '../i18n/index.tsx'

export function DocumentHead() {
  const { pathname } = useLocation()
  const { locale, messages } = useI18n()
  const meta = resolveMeta(pathname)
  const url = canonicalUrl(meta.path)

  useEffect(() => {
    document.title = meta.title
    upsertMeta('name', 'description', meta.description)
    upsertLink('canonical', url)
    upsertMeta('property', 'og:title', meta.title)
    upsertMeta('property', 'og:description', meta.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:locale', uiLocaleOgLocale(locale))
    upsertMeta('property', 'og:image:alt', messages.brand.tagline)
    upsertMeta('name', 'twitter:title', meta.title)
    upsertMeta('name', 'twitter:description', meta.description)
    upsertMeta('name', 'twitter:image:alt', messages.brand.tagline)
    if (meta.robots) upsertMeta('name', 'robots', meta.robots)
    upsertJsonLd()
  }, [meta, url, locale, messages.brand.tagline])

  return null
}

function upsertJsonLd() {
  if (typeof document === 'undefined') return
  let node = document.getElementById('fl-jsonld')
  if (!node) {
    node = document.createElement('script')
    node.id = 'fl-jsonld'
    node.setAttribute('type', 'application/ld+json')
    document.head.appendChild(node)
  }
  node.textContent = structuredDataJson()
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return
  const selector = `meta[${attr}="${key}"]`
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attr, key)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return
  let node = document.head.querySelector(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
}
