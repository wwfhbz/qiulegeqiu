import { defineConfig } from 'vite';

export default defineConfig({
  // Served by Nginx at https://ball.gmgnclaw.com/.
  base: '/',
  server: { proxy: { '/api': 'http://127.0.0.1:8091' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8091' } },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
