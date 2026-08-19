import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Docker Desktop's Windows bind-mount file sharing doesn't reliably
    // propagate native filesystem-change events into the container, so
    // native watching silently misses edits there — fall back to stat
    // polling only in that context (docker-compose.dev.yml sets this env
    // var; plain local `npm run dev` never does, so native watching stays
    // the default — polling is slower/more CPU, not worth it when unneeded).
    watch: {
      usePolling: process.env.VITE_USE_POLLING === "true",
    },
  },
})
