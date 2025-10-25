import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Simple Vite config without Capacitor
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@shared/themes': path.resolve(__dirname, '../shared/themes')
    }
  },
  build: {
    outDir: 'dist',
    target: 'es2015',
    minify: 'esbuild'
  },
  server: {
    port: 3002,
    host: 'localhost'
  }
})
