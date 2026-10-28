import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    // The persistent module cache keeps a stale list of import.meta.glob matches (the plant library
    // files), so a newly added plant would silently go untested. Correctness over cold-start speed.
    fsModuleCache: false,
  },
});
