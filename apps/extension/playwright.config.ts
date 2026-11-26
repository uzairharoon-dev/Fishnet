import { defineConfig } from '@playwright/test';

// Loads the built extension (.output/chrome-mv3); run `pnpm e2e`, which builds first.
export default defineConfig({
  testDir: 'e2e',
  testIgnore: 'docs/**',
  timeout: 30_000,
  // Each test launches its own browser with the extension; keep it gentle on CI.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { trace: 'retain-on-failure' },
});
