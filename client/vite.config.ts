import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// In dev mode, rewrite /shelters/* to /app/ so the SPA loads correctly
function cityRoutesDev(): Plugin {
  return {
    name: 'city-routes-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith('/shelters/')) {
          req.url = '/app/'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: '/app/',
  plugins: [cityRoutesDev(), react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
  },
})
