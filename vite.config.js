import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Minifizierung mit esbuild (Vite-Standard, sehr schnell)
    minify: 'esbuild',
    target: 'es2018',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Stabile Dateinamen für SW-Cache-Verwaltung
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || '';
          // manifest.json bleibt im Root (kein Hash)
          if (name === 'manifest.json') {
            return '[name][extname]';
          }
          // Fonts behalten ihre Struktur
          if (/\.(woff2?|ttf|eot)$/.test(name)) {
            return 'assets/fonts/[name][extname]';
          }
          // Icons behalten ihre Struktur
          if (/icons\//.test(name)) {
            return 'assets/icons/[name][extname]';
          }
          // Bilder behalten ihre Struktur
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return 'assets/images/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Source Maps für Produktion (optional, kann deaktiviert werden)
    sourcemap: false,
    // CSS wird automatisch extrahiert und minifiziert
    cssMinify: true,
    // Chunk-Größen-Warnung auf 500KB setzen
    chunkSizeWarningLimit: 500,
    // Asset-Inline-Limit: Dateien < 4KB werden als Base64 eingebettet
    assetsInlineLimit: 4096,
  },
  // Basis-URL für GitHub Pages Deployment (kann überschrieben werden)
  base: './',
  // Optimierungen für den Dev-Server
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Esbuild-Optionen für maximale Komprimierung
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
});
