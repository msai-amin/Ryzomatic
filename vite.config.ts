import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Smart Reader',
        short_name: 'SmartReader',
        description: 'Your intelligent document reading assistant',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '32x32',
            type: 'image/x-icon'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Polyfill Node.js modules for the browser
      util: 'rollup-plugin-node-polyfills/polyfills/util',
      sys: 'util',
      events: 'rollup-plugin-node-polyfills/polyfills/events',
      stream: 'rollup-plugin-node-polyfills/polyfills/stream',
      path: 'rollup-plugin-node-polyfills/polyfills/path',
      querystring: 'rollup-plugin-node-polyfills/polyfills/qs',
      punycode: 'rollup-plugin-node-polyfills/polyfills/punycode',
      url: 'rollup-plugin-node-polyfills/polyfills/url',
      string_decoder: 'rollup-plugin-node-polyfills/polyfills/string-decoder',
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
      process: 'rollup-plugin-node-polyfills/polyfills/process-es6',
      http: 'rollup-plugin-node-polyfills/polyfills/http',
      https: 'rollup-plugin-node-polyfills/polyfills/http',
      os: 'rollup-plugin-node-polyfills/polyfills/os',
      assert: 'rollup-plugin-node-polyfills/polyfills/assert',
      constants: 'rollup-plugin-node-polyfills/polyfills/constants',
      _stream_duplex: 'rollup-plugin-node-polyfills/polyfills/readable-stream/duplex',
      _stream_passthrough: 'rollup-plugin-node-polyfills/polyfills/readable-stream/passthrough',
      _stream_readable: 'rollup-plugin-node-polyfills/polyfills/readable-stream/readable',
      _stream_writable: 'rollup-plugin-node-polyfills/polyfills/readable-stream/writable',
      _stream_transform: 'rollup-plugin-node-polyfills/polyfills/readable-stream/transform',
      timers: 'rollup-plugin-node-polyfills/polyfills/timers',
      console: 'rollup-plugin-node-polyfills/polyfills/console',
      vm: 'rollup-plugin-node-polyfills/polyfills/vm',
      zlib: 'rollup-plugin-node-polyfills/polyfills/zlib',
      tty: 'rollup-plugin-node-polyfills/polyfills/tty',
      domain: 'rollup-plugin-node-polyfills/polyfills/domain',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: [
      'pdfjs-dist',
      '@google-cloud/text-to-speech',
      '@google-cloud/storage',
      'googleapis',
      'natural',
      'citation-js',
      'neo4j-driver',
      'd3',
      'mermaid',
      'vis-timeline',
      'vis-data'
    ]
  },
  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyFill(),
      ],
      output: {
        // Manual chunking to reduce bundle size
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'pdf-vendor': ['pdfjs-dist'],
          'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ai-vendor': ['@google/generative-ai', 'openai'],
          'aws-vendor': ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
          'utils-vendor': ['marked', 'compromise'],
        },
        // Ensure PDF.js worker is copied to the correct location
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'pdf.worker.min.js') {
            return 'pdf.worker.min.js'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging (disable in production for faster builds)
    sourcemap: mode === 'development',
    // Optimize for faster builds
    minify: mode === 'production' ? 'esbuild' : false,
    // Disable source maps in production for faster builds
    cssCodeSplit: true,
  },
  server: {
    port: 3001,
    host: 'localhost', // Switch back to localhost
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    }
  },
  // Configure PDF.js worker
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  // Ensure PDF.js worker is properly handled
  assetsInclude: ['**/*.worker.js', '**/*.worker.min.js']
}))


