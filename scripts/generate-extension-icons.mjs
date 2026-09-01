#!/usr/bin/env node
/**
 * Regenerate extension PNG icons from the canonical Flowlary mark colors.
 * Uses #5b8cff / #061018 — same as og.svg and dark-theme tokens.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../extension/icons')

/** Keep in sync with packages/shared/src/brand.ts */
const MARK = {
  radius: 8.5,
  f: 'M9.2 7.7h12.35v3.95h-8v2.05h7.15v3.75h-7.15V24.3H9.2V7.7Z',
  caret: { x: 22.2, y: 13.35, width: 2.35, height: 5.5, rx: 0.75 },
}
const COLORS = {
  accent: '#5b8cff',
  onAccent: '#061018',
}

function markSvg(size) {
  const scale = size / 32
  const r = MARK.radius * scale
  const { caret } = MARK
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${COLORS.accent}"/>
  <g transform="scale(${scale})">
    <path d="${MARK.f}" fill="${COLORS.onAccent}"/>
    <rect x="${caret.x}" y="${caret.y}" width="${caret.width}" height="${caret.height}" rx="${caret.rx}" fill="${COLORS.onAccent}"/>
  </g>
</svg>`
}

for (const size of [16, 32, 48, 128]) {
  const png = await sharp(Buffer.from(markSvg(size))).png().toBuffer()
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), png)
  console.log(`Wrote icon-${size}.png (${COLORS.accent} / ${COLORS.onAccent})`)
}
