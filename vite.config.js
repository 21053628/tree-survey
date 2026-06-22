import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages repo name（含空格 → %20）
  base: '/Initial%20base/',
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 3000,
    open: true
  }
});