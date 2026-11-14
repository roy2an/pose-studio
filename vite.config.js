import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
})
