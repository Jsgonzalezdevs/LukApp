/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Connect, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Serves the finance entry at `/finanzas` as well as `/finanzas/`.
 *
 * A multi-page entry lives at `finanzas/index.html`, which Vite only resolves for
 * the trailing-slash form. Without this, the bare `/finanzas` — the URL anyone
 * actually types — falls through to the SPA fallback and silently renders the
 * PORTFOLIO instead. Rewriting (rather than redirecting) keeps the address bar
 * clean and matches the 200 rewrite configured in netlify.toml for production.
 */
const finanzasTrailingSlash = (): PluginOption => {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.url === '/finanzas') req.url = '/finanzas/'
    else if (req.url?.startsWith('/finanzas?')) req.url = `/finanzas/${req.url.slice('/finanzas'.length)}`
    next()
  }

  return {
    name: 'finanzas-trailing-slash',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    finanzasTrailingSlash(),
  ],
  build: {
    rollupOptions: {
      // Two independent HTML entries. The private finance app needs its own
      // <head> (noindex, iOS standalone metas, manifest) which a single shared
      // index.html cannot provide, and this keeps the two bundles disjoint.
      input: {
        main: resolve(__dirname, 'index.html'),
        finanzas: resolve(__dirname, 'finanzas/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})

