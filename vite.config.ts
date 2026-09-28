import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Server-only secret (no VITE_ prefix) — used by the dev proxy, never bundled.
  const { N8N_DASH_TOKEN } = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Dev stand-in for the Vercel function in api/voice-stats.ts.
      proxy: {
        '/api/voice-stats': {
          target: 'https://n8n.srv1303295.hstgr.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/voice-stats/, '/webhook/voice-call-stats'),
          headers: N8N_DASH_TOKEN ? { Authorization: N8N_DASH_TOKEN } : {},
        },
      },
    },
  }
})
