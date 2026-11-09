import { defineConfig } from 'vite';

export default defineConfig({
  // Served by Nginx at https://ball.gmgnclaw.com/.
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
