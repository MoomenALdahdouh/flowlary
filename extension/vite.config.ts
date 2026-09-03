import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import devManifest from './manifest.json' with { type: 'json' }
import prodManifest from './manifest.prod.json' with { type: 'json' }

const isReleaseBuild = process.env.FLOWLARY_RELEASE === '1'
const manifest = isReleaseBuild ? prodManifest : devManifest
const shared = new URL('../packages/shared/src', import.meta.url).pathname

/** MV3 service workers have no `document`; Vite's import-analysis preload helper breaks the background. */
function disableViteImportAnalysis(): Plugin {
  return {
    name: 'flowlary-disable-vite-import-analysis',
    configResolved(config) {
      const idx = config.plugins.findIndex((plugin) => plugin.name === 'vite:build-import-analysis')
      if (idx >= 0) config.plugins.splice(idx, 1)
    },
  }
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_FLOWLARY_RELEASE': JSON.stringify(isReleaseBuild ? '1' : '0'),
    ...(isReleaseBuild
      ? {
          'import.meta.env.VITE_FLOWLARY_API_URL': JSON.stringify('https://api.flowlary.com'),
          'import.meta.env.VITE_FLOWLARY_SITE_URL': JSON.stringify('https://flowlary.com'),
        }
      : {}),
  },
  plugins: [
    disableViteImportAnalysis(),
    react(),
    crx({
      manifest,
      contentScripts: { hmrTimeout: 60_000 },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@flowlary/shared/tokens.css': `${shared}/tokens.css`,
      '@flowlary/shared/buttons.css': `${shared}/buttons.css`,
      '@flowlary/shared/theme': `${shared}/theme.ts`,
      '@flowlary/shared': `${shared}/index.ts`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    // Service workers have no `document`; disable preload polyfill entirely.
    modulePreload: { polyfill: false },
  },
})
