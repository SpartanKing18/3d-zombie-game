import { defineConfig } from 'vite';

// Relative base so the built site works when served from any host or sub-path
// (Render static site root, Netlify, GitHub Pages project pages, or file://).
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  },
  optimizeDeps: {
    include: ['three', 'cannon-es', 'simplex-noise']
  }
});
