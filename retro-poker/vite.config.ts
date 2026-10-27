import { defineConfig } from 'vite';
export default defineConfig({
  root: 'frontend',
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { outDir: '../dist/frontend', emptyOutDir: true },
});
