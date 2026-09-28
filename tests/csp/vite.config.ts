import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const policy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'nonce-embedpdf-host'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        snippet: resolve(__dirname, 'snippet.html'),
        react: resolve(__dirname, 'react.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4179,
    headers: {
      'Content-Security-Policy': policy,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4179,
    headers: {
      'Content-Security-Policy': policy,
    },
  },
});
