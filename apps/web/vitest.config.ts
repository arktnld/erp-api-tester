import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    environmentOptions: {
      jsdom: { url: 'http://localhost' },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
