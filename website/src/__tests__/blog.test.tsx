import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import BlogPost from '../bolt/pages/blog/BlogPost.tsx'
import { BLOG_POSTS } from '../bolt/data/site.tsx'
import { ar } from '../i18n/ar.ts'
import { en } from '../i18n/en.ts'
import { blogStoriesAr, blogStoriesEn } from '../i18n/blogStories.ts'
import { I18nProvider } from '../i18n/index.tsx'
import { resolveLocalizedMeta } from '../seo.ts'

function renderApp(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function renderPost(path: string, locale: 'en' | 'ar') {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider initialLocale={locale}>
        <Routes>
          <Route path="/blog/:slug" element={<BlogPost />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('blog stories', () => {
  it('lists every story with a cover image', () => {
    const html = renderApp('/blog')
    expect(html).toContain('Bilingual writing life')
    const publicDir = join(import.meta.dirname, '../../public')
    for (const post of BLOG_POSTS) {
      expect(html).toContain(`/blog/${post.slug}`)
      expect(html).toContain(post.cover)
      expect(existsSync(join(publicDir, post.cover.slice(1)))).toBe(true)
    }
    expect(html).not.toContain('No articles have been published yet')
    expect(html).not.toContain('Lorem ipsum')
  })

  it('renders a full English article, not a stub', () => {
    const html = renderApp('/blog/wrong-keyboard-gibberish')
    expect(html).toContain('The half-second heartbreak of the wrong keyboard')
    expect(html).toContain('Spellcheck cannot see this')
    expect(html).toContain('/blog/wrong-keyboard.jpg')
    expect((html.match(/<p>/g) ?? []).length).toBeGreaterThan(8)
    expect(html).not.toContain('Lorem')
  })

  it('renders the matching Arabic article', () => {
    const html = renderPost('/blog/stay-in-the-inbox', 'ar')
    expect(html).toMatch(/[\u0600-\u06FF]/)
    expect(html).toContain('أنهِ الرسالة في صندوق الوارد')
    expect(html).toContain('/blog/stay-in-inbox.jpg')
  })

  it('keeps English and Arabic story shapes aligned with the post list', () => {
    const slugs = BLOG_POSTS.map((post) => post.slug)
    expect(Object.keys(blogStoriesEn)).toEqual(slugs)
    expect(Object.keys(blogStoriesAr)).toEqual(slugs)
    for (const slug of slugs) {
      const enPost = en.pages.blogPage.posts[slug]
      const arPost = ar.pages.blogPage.posts[slug]
      expect(arPost.title).toMatch(/[\u0600-\u06FF]/)
      expect(arPost.excerpt).toMatch(/[\u0600-\u06FF]/)
      expect(enPost.sections.length).toBeGreaterThan(3)
      expect(arPost.sections.length).toBe(enPost.sections.length)
      expect(enPost.sections.reduce((n, section) => n + section.paragraphs.length, 0)).toBeGreaterThan(6)
    }
  })

  it('uses the story excerpt and cover for SEO', () => {
    const meta = resolveLocalizedMeta('/blog/help-not-rewrite', en.pages)
    expect(meta.title).toContain('Help, not rewrite')
    expect(meta.description).toContain('silently replaces')
    expect(meta.image).toContain('/blog/help-not-rewrite.jpg')
    expect(meta.ogType).toBe('article')
  })
})
