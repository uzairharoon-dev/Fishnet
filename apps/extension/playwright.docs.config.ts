import { defineConfig } from '@playwright/test';

// README screenshots only; run `pnpm screenshots`.
export default defineConfig({
  testDir: 'e2e/docs',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
