import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// In development the browser talks only to the Vite server (e.g. http://localhost:5173).
// Vite forwards every /api request to the local backend. Because the browser sees ONE
// origin, the httpOnly login cookie is always stored and sent, so login works on localhost
// no matter what the live (cPanel) settings are.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: false,
      },
    },
  },
})