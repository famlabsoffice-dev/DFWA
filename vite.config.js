import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    
  ],

  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: [],
      },
    },
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('ui-manager.js')) {
            return 'ui';
          }
          if (id.includes('game-modes.js') || id.includes('battle-manager.js')) {
            return 'game';
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || '';
          if (name === 'manifest.json' || name === 'manifest.webmanifest') {
            return '[name][extname]';
          }
          if (/\.(woff2?|ttf|eot)$/.test(name)) {
            return 'assets/fonts/[name][extname]';
          }
          if (/icons\//.test(name)) {
            return 'assets/icons/[name][extname]';
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return 'assets/images/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
  },
  base: './',
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
    minify: true,
  },
});
