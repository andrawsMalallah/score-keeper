import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    // The game logic is pure, so it needs no DOM. Phases that add component
    // tests will want a jsdom environment here.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
