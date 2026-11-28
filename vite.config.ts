import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        // Mantiene las dependencias pesadas estables entre despliegues: un
        // cambio en la interfaz no obliga a descargarlas otra vez.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/tesseract.js')) return 'ocr';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // Los worktrees de otras sesiones viven dentro del repo; sin esto vitest
    // corre también sus copias, con otra versión, y falla por ellas.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
