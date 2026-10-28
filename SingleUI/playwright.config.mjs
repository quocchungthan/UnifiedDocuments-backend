import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { apps } from './scripts/app.mjs';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/apps',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  projects: apps.map((app, index) => ({
    name: app,
    metadata: { app },
    // An app with its own journeys owns e2e/<app>.spec.mjs; previews share entries.spec.
    testMatch: existsSync(new URL(`./e2e/${app}.spec.mjs`, import.meta.url))
      ? [`${app}.spec.mjs`, 'deployment.spec.mjs']
      : ['entries.spec.mjs', 'deployment.spec.mjs'],
    use: { baseURL: `http://127.0.0.1:${4327 + index}` },
  })),
  use: {
    baseURL: 'http://127.0.0.1:4327',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'node scripts/serve-apps.mjs',
    url: `http://127.0.0.1:${4326 + apps.length}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
