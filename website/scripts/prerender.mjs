import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = path.resolve('dist')
const ssrDir = path.resolve('dist-ssr')
const templatePath = path.join(dist, 'index.html')

if (!fs.existsSync(templatePath)) {
  throw new Error('Missing dist/index.html. Run the client Vite build first.')
}

const template = fs.readFileSync(templatePath, 'utf8')
const serverEntry = path.join(ssrDir, 'entry-server.js')
if (!fs.existsSync(serverEntry)) {
  throw new Error('Missing dist-ssr/entry-server.js. Run the SSR Vite build first.')
}

const { render } = await import(pathToFileURL(serverEntry).href)

const routes = [
  '/',
  '/product',
  '/try',
  '/lab',
  '/features',
  '/features/writing-correction',
  '/features/translation',
  '/features/live-translation',
  '/features/keyboard-layout',
  '/features/speed-box',
  '/pricing',
  '/about',
  '/privacy',
  '/terms',
  '/cookies',
  '/contact',
  '/support',
  '/guide',
  '/blog',
  '/blog/wrong-keyboard-gibberish',
  '/blog/writing-arabic-english-same-field',
  '/blog/help-not-rewrite',
  '/blog/live-translation-when-to-use',
  '/blog/speed-box-story',
  '/blog/bilingual-writing-tips',
  '/blog/stay-in-the-inbox',
  '/blog/what-flowlary-will-not-claim',
  '/account',
]

function applyTemplate(html, head, htmlLang) {
  return template
    .replace('<html lang="en" dir="ltr">', `<html lang="${htmlLang}" dir="ltr">`)
    .replace('<!--app-head-->', head)
    .replace('<!--app-html-->', html)
}

function writePage(url, html, head, htmlLang) {
  const page = applyTemplate(html, head, htmlLang)
  const filePath =
    url === '/' ? path.join(dist, 'index.html') : path.join(dist, url.replace(/^\//, ''), 'index.html')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, page)
}

for (const url of routes) {
  const { html, head, htmlLang } = render(url)
  if (!html.includes('<h1')) {
    throw new Error(`Prerender produced no h1 for ${url}`)
  }
  writePage(url, html, head, htmlLang)
}

const missing = render('/this-route-does-not-exist')
fs.writeFileSync(path.join(dist, '404.html'), applyTemplate(missing.html, missing.head, missing.htmlLang))

console.log(`Prerendered ${routes.length} routes + 404.html`)

const forbidden = ['GROQ_API_KEY', 'flowlary-api.zaixos.com', 'lingo-api.zaixos.com']
const scanned = []

function scan(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) scan(full)
    else if (/\.(html|js|css|xml|txt|svg|json)$/.test(name)) scanned.push(full)
  }
}

scan(dist)
for (const file of scanned) {
  const text = fs.readFileSync(file, 'utf8')
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(`Forbidden string "${needle}" in ${path.relative(dist, file)}`)
    }
  }
}

