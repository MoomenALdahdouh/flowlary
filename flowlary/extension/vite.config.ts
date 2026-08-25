import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import devManifest from './manifest.json' with { type: 'json' }
import prodManifest from './manifest.prod.json' with { type: 'json' }

const isReleaseBuild = process.env.FLOWLARY_RELEASE === '1'
const manifest = isReleaseBuild ? prodManifest : devManifest

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      contentScripts: { hmrTimeout: 60_000 },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
  },
})
