import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serve the /api functions from the dev server too, so the leaderboard works locally.
 * In production the host (e.g. Vercel) runs api/*.ts itself with REDIS_URL from its settings.
 */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process
      if (env.REDIS_URL) proc.env.REDIS_URL = env.REDIS_URL
      server.middlewares.use('/api/leaderboard', async (req, res) => {
        // a broken or failing function answers with an error; it must never take the dev server down
        try {
          const mod = await server.ssrLoadModule('/api/leaderboard.ts')
          await mod.default(req, res)
        } catch (e) {
          server.config.logger.error(`[api] ${e instanceof Error ? e.message : String(e)}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: 'leaderboard unavailable' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' = load every variable from .env files, not just VITE_ ones; they stay server-side here
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), devApi(env)],
    server: { port: 5173 },
  }
})
