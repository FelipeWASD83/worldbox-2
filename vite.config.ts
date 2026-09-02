import { defineConfig } from 'vite';

// base relativa: o Electron carrega o build por file:// em produção.
export default defineConfig({
  base: './',
  root: 'src',
  publicDir: false,
  server: { port: 5174, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
