import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Server-only secret (no VITE_ prefix) — used by the dev proxy, never bundled.
  const allEnv = loadEnv(mode, process.cwd(), '')
  const { N8N_DASH_TOKEN } = allEnv

  // Dev stand-ins for these Vercel functions (otherwise Vite serves their source). They use the
  // real .env, so a save from the dev Edit targets panel writes the live settings, as in production.
  const DEV_FUNCTIONS = ['marketing-demand', 'marketing-settings']
  const vercelFunctionsDev: Plugin = {
    name: 'vercel-functions-dev',
    configureServer(server) {
      // Node's 250 ms per-address connect attempt times out on some local networks; give it 2 s.
      setDefaultAutoSelectFamilyAttemptTimeout(2000)
      for (const fn of DEV_FUNCTIONS) {
        server.middlewares.use(`/api/${fn}`, async (req, res) => {
          Object.assign(process.env, allEnv)
          const handlers = await server.ssrLoadModule(`/api/${fn}.ts`)
          const handler = handlers[req.method ?? 'GET']
          if (!handler) { res.statusCode = 405; res.end(); return }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const r: Response = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          }))
          res.statusCode = r.status
          res.setHeader('Content-Type', 'application/json')
          res.end(await r.text())
        })
      }
    },
  }

  return {
    plugins: [react(), tailwindcss(), vercelFunctionsDev],
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
