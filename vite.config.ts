import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Server-only secret (no VITE_ prefix) — used by the dev proxy, never bundled.
  const allEnv = loadEnv(mode, process.cwd(), '')
  const { N8N_DASH_TOKEN } = allEnv

  // Dev stand-in for the Vercel function api/marketing-demand.ts (it joins n8n and Airtable server-side).
  const marketingDemandDev: Plugin = {
    name: 'marketing-demand-dev',
    configureServer(server) {
      // Node's 250 ms per-address connect attempt times out on some local networks; give it 2 s.
      setDefaultAutoSelectFamilyAttemptTimeout(2000)
      server.middlewares.use('/api/marketing-demand', async (_req, res) => {
        Object.assign(process.env, allEnv)
        const { GET } = await server.ssrLoadModule('/api/marketing-demand.ts')
        const r: Response = await GET()
        res.statusCode = r.status
        res.setHeader('Content-Type', 'application/json')
        res.end(await r.text())
      })
    },
  }

  return {
    plugins: [react(), tailwindcss(), marketingDemandDev],
    server: {
      // Dev stand-in for the Vercel function in api/voice-stats.ts.
      proxy: {
        '/api/voice-stats': {
          target: 'https://n8n.srv1303295.hstgr.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/voice-stats/, '/webhook/voice-call-stats'),
          headers: N8N_DASH_TOKEN ? { 'x-dashboard-token': N8N_DASH_TOKEN } : {},
        },
      },
    },
  }
})
