import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { resolveMeta, renderHeadTags } from './seo.ts'

export function render(url: string) {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
  const meta = resolveMeta(url)
  return { html, head: renderHeadTags(meta), htmlLang: 'en' }
}
