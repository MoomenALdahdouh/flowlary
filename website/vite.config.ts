import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const shared = new URL('../packages/shared/src', import.meta.url).pathname
const websiteRoot = new URL('./', import.meta.url).pathname

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, websiteRoot, '')
  const apiTarget = (env.VITE_FLOWLARY_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
  const proxy = {
    '/__flowlary-api': {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/__flowlary-api/, ''),
    },
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@flowlary/shared/tokens.css': `${shared}/tokens.css`,
        '@flowlary/shared/buttons.css': `${shared}/buttons.css`,
        '@flowlary/shared/theme': `${shared}/theme.ts`,
        '@flowlary/shared': `${shared}/index.ts`,
        '@flowlary/layout-repair': new URL('../extension/src/core/engine/layoutSequence.ts', import.meta.url).pathname,
        '@flowlary/layout-registry': new URL('../extension/src/features/layout/layouts/registry.ts', import.meta.url).pathname,
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: ['flowlary.test', 'www.flowlary.test', 'localhost', '127.0.0.1'],
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      allowedHosts: ['flowlary.test', 'www.flowlary.test', 'localhost', '127.0.0.1'],
      proxy,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: new URL('./index.html', import.meta.url).pathname,
      },
    },
  }
})
