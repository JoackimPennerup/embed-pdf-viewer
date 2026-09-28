import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  use: {
    baseURL: 'http://127.0.0.1:4179',
    browserName: 'chromium',
  },
  webServer: {
    command: 'pnpm exec vite preview --strictPort',
    url: 'http://127.0.0.1:4179/snippet.html',
    reuseExistingServer: false,
  },
});
