import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pesquisas-eleitorais-br/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  publicDir: 'public',
})
