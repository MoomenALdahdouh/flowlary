import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../website/public/blog')
mkdirSync(dir, { recursive: true })

function cover({ file, title, kicker, accent, scene }) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <title>${title}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071018"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0ea5e9"/>
      <stop offset="1" stop-color="#14b8a6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="70" r="280" fill="${accent}" fill-opacity="0.18"/>
  <circle cx="180" cy="560" r="200" fill="#14b8a6" fill-opacity="0.08"/>
  <rect x="72" y="72" width="56" height="56" rx="16" fill="url(#mark)"/>
  <path d="M84.2 86.7h12.35v3.95h-8v2.05h7.15v3.75h-7.15V103.3H84.2V86.7Z" fill="#fff"/>
  <rect x="97.2" y="92.35" width="2.35" height="5.5" rx="0.75" fill="#fff"/>
  <text x="148" y="108" fill="#7dd3fc" font-family="system-ui, Segoe UI, sans-serif" font-size="22" font-weight="600">${kicker}</text>
  <text x="72" y="200" fill="#f8fafc" font-family="system-ui, Segoe UI, sans-serif" font-size="44" font-weight="700">${title}</text>
  ${scene}
</svg>`
  writeFileSync(join(dir, file), svg)
}

cover({
  file: 'wrong-keyboard.svg',
  kicker: 'Keyboard mix-ups · خلط اللوحة',
  title: 'Wrong layout, same keys',
  accent: '#0ea5e9',
  scene: `
  <rect x="72" y="260" width="620" height="280" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <text x="110" y="330" fill="#94a3b8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28">ghl hghl hghl</text>
  <text x="110" y="390" fill="#7dd3fc" font-family="IBM Plex Sans Arabic, system-ui, sans-serif" font-size="36">هل هذا هو</text>
  <rect x="110" y="430" width="200" height="54" rx="14" fill="#0ea5e9"/>
  <text x="132" y="466" fill="#082f49" font-family="system-ui, sans-serif" font-size="22" font-weight="700">Repair · أصلح</text>`,
})

cover({
  file: 'same-field.svg',
  kicker: 'Bilingual life · حياة بلغتين',
  title: 'One field, two scripts',
  accent: '#14b8a6',
  scene: `
  <rect x="72" y="250" width="700" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <rect x="110" y="290" width="280" height="90" rx="18" fill="#082f49"/>
  <text x="132" y="348" fill="#e0f2fe" font-family="IBM Plex Sans Arabic, system-ui, sans-serif" font-size="32">مرحباً</text>
  <rect x="420" y="290" width="300" height="90" rx="18" fill="#042f2e"/>
  <text x="444" y="348" fill="#ccfbf1" font-family="system-ui, sans-serif" font-size="32">Hello</text>
  <text x="132" y="460" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="24">Gmail · Docs · WhatsApp Web</text>`,
})

cover({
  file: 'help-not-rewrite.svg',
  kicker: 'Product philosophy · فلسفة المنتج',
  title: 'You review. You choose.',
  accent: '#f59e0b',
  scene: `
  <rect x="72" y="250" width="520" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <text x="110" y="320" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="26">I wait you reply</text>
  <text x="110" y="380" fill="#fde68a" font-family="system-ui, sans-serif" font-size="26">I will wait for your reply</text>
  <rect x="110" y="420" width="140" height="48" rx="12" fill="#14b8a6"/>
  <text x="138" y="452" fill="#042f2e" font-family="system-ui, sans-serif" font-size="20" font-weight="700">Apply</text>
  <rect x="270" y="420" width="140" height="48" rx="12" fill="none" stroke="#64748b"/>
  <text x="298" y="452" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="20">Dismiss</text>`,
})

cover({
  file: 'live-translation.svg',
  kicker: 'Features · الميزات',
  title: 'Off until you turn it on',
  accent: '#38bdf8',
  scene: `
  <rect x="72" y="250" width="640" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <text x="110" y="330" fill="#e2e8f0" font-family="IBM Plex Sans Arabic, system-ui, sans-serif" font-size="34">أكتب بالعربية</text>
  <text x="110" y="400" fill="#7dd3fc" font-family="system-ui, sans-serif" font-size="28">I am writing in Arabic</text>
  <rect x="110" y="440" width="220" height="48" rx="24" fill="#1e293b"/>
  <circle cx="138" cy="464" r="14" fill="#64748b"/>
  <text x="168" y="472" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18">Live · off</text>`,
})

cover({
  file: 'speed-box.svg',
  kicker: 'Speed Box · صندوق السرعة',
  title: 'Pick 1, 2, or close',
  accent: '#fb7185',
  scene: `
  <rect x="72" y="250" width="420" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <rect x="110" y="290" width="340" height="64" rx="14" fill="#082f49"/>
  <text x="130" y="332" fill="#e0f2fe" font-family="system-ui, sans-serif" font-size="24">1  هل هذا هو</text>
  <rect x="110" y="370" width="340" height="64" rx="14" fill="#111827"/>
  <text x="130" y="412" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="24">2  ghl hghl</text>
  <text x="130" y="500" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="20">3  Close · أغلق</text>`,
})

cover({
  file: 'bilingual-habits.svg',
  kicker: 'Bilingual life · حياة بلغتين',
  title: 'Seven small habits',
  accent: '#2dd4bf',
  scene: `
  <rect x="72" y="250" width="680" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <text x="110" y="320" fill="#99f6e4" font-family="system-ui, sans-serif" font-size="24">1 Switch by feel</text>
  <text x="110" y="365" fill="#99f6e4" font-family="system-ui, sans-serif" font-size="24">2 Write the thought first</text>
  <text x="110" y="410" fill="#99f6e4" font-family="system-ui, sans-serif" font-size="24">3 Keep names stable</text>
  <text x="110" y="455" fill="#99f6e4" font-family="system-ui, sans-serif" font-size="24">4 Stay in the field</text>
  <text x="110" y="500" fill="#5eead4" font-family="IBM Plex Sans Arabic, system-ui, sans-serif" font-size="24">٧ اقرأ مرة ثم أرسل</text>`,
})

cover({
  file: 'stay-in-inbox.svg',
  kicker: 'Bilingual life · حياة بلغتين',
  title: 'Finish it in Gmail',
  accent: '#38bdf8',
  scene: `
  <rect x="72" y="250" width="700" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <rect x="110" y="290" width="620" height="48" rx="10" fill="#1e293b"/>
  <text x="130" y="322" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="20">To: professor@university.edu</text>
  <text x="130" y="400" fill="#e2e8f0" font-family="IBM Plex Sans Arabic, system-ui, sans-serif" font-size="28">أعتذر عن التأخير —</text>
  <text x="130" y="450" fill="#7dd3fc" font-family="system-ui, sans-serif" font-size="24">I am sorry for the delay.</text>
  <rect x="130" y="480" width="160" height="40" rx="10" fill="#0ea5e9"/>
  <text x="162" y="508" fill="#082f49" font-family="system-ui, sans-serif" font-size="18" font-weight="700">Send</text>`,
})

cover({
  file: 'honest-limits.svg',
  kicker: 'Product philosophy · فلسفة المنتج',
  title: 'What we will not claim',
  accent: '#fbbf24',
  scene: `
  <rect x="72" y="250" width="720" height="300" rx="28" fill="#0b1220" stroke="#1e293b"/>
  <text x="110" y="330" fill="#fecaca" font-family="system-ui, sans-serif" font-size="26">✕ Perfect English</text>
  <text x="110" y="385" fill="#fecaca" font-family="system-ui, sans-serif" font-size="26">✕ Silent full rewrite</text>
  <text x="110" y="440" fill="#fecaca" font-family="system-ui, sans-serif" font-size="26">✕ Magic outside Chrome</text>
  <text x="110" y="500" fill="#86efac" font-family="system-ui, sans-serif" font-size="26">✓ Review before apply</text>`,
})

console.log(`wrote 8 covers to ${dir}`)
