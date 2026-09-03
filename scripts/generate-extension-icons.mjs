#!/usr/bin/env node
/**
 * Regenerate favicon SVGs and extension PNG icons from @flowlary/shared mark source.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXT_ICONS = join(__dirname, '../extension/icons')
const WEB_PUBLIC = join(__dirname, '../website/public')

const sharedMark = await import(pathToFileURL(join(__dirname, '../packages/shared/src/markSvg.ts')).href)
const { flowlaryFaviconSvg, flowlaryFaviconSvgAdaptive, flowlaryMarkSvgPng } = sharedMark

writeFileSync(join(EXT_ICONS, 'favicon.svg'), flowlaryFaviconSvgAdaptive(), 'utf8')
writeFileSync(join(WEB_PUBLIC, 'favicon.svg'), flowlaryFaviconSvgAdaptive(), 'utf8')
writeFileSync(join(EXT_ICONS, 'favicon-dark.svg'), flowlaryFaviconSvg('dark'), 'utf8')
writeFileSync(join(EXT_ICONS, 'favicon-light.svg'), flowlaryFaviconSvg('light'), 'utf8')
writeFileSync(join(WEB_PUBLIC, 'favicon-dark.svg'), flowlaryFaviconSvg('dark'), 'utf8')
writeFileSync(join(WEB_PUBLIC, 'favicon-light.svg'), flowlaryFaviconSvg('light'), 'utf8')

for (const size of [16, 32, 48, 128]) {
  const png = await sharp(Buffer.from(flowlaryMarkSvgPng(size))).png().toBuffer()
  writeFileSync(join(EXT_ICONS, `icon-${size}.png`), png)
  console.log(`Wrote icon-${size}.png`)
}

console.log('Wrote favicon.svg (adaptive), favicon-dark.svg, favicon-light.svg for website + extension')
