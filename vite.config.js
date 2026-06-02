import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/nomads': {
        target: 'https://nomads.ncep.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nomads/, ''),
      },
      '/openmeteo': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openmeteo/, ''),
      },
      '/marine': {
        target: 'https://marine-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/marine/, ''),
      },
    },
  },
})
