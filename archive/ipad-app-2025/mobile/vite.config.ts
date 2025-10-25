import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src')
    }
  },
  build: {
    outDir: 'dist',
    // Mobile-specific optimizations
    target: 'es2015',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/ios'],
          'shared-vendor': ['@smart-reader/shared']
        }
      }
    }
  },
  server: {
    port: 3002,  // Different port from web
    host: 'localhost'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
})
