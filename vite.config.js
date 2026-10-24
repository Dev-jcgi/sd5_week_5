import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages el sitio vive en https://<usuario>.github.io/<repositorio>/
// El workflow define VITE_BASE=/<repositorio>/ automáticamente.
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react()],
  define: { __BUILD__: JSON.stringify((process.env.GITHUB_SHA || 'local').slice(0, 7)) },
  build: { chunkSizeWarningLimit: 1500 },
});
