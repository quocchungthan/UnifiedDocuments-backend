import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './deployment/local',
  testMatch: '*.spec.mjs',
  grep:
    process.env.SKIN_HOST === 'storage'
      ? /storage|Seafile/
      : process.env.SKIN_HOST === 'note'
        ? /note|AFFiNE/
        : undefined,
  globalSetup: './deployment/local/configure-hosts.mjs',
  outputDir: `./test-results/hosts/${process.env.SKIN_HOST ?? 'all'}`,
  workers: 1,
  timeout: 60_000,
  globalTimeout: 600_000,
  use: { browserName: 'chromium', reducedMotion: 'reduce', locale: 'en-US' },
});
