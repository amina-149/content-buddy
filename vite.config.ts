import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/pipeline': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/pipeline/, '/api/pipeline'),
      },
    },
  },
})
