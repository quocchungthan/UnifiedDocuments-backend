import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const visuals = resolve('test-results/visual-review/productioncore-aids');
mkdirSync(visuals, { recursive: true });

for (const scenario of ['default', 'signed-out', 'empty', 'failure', 'loading']) {
  test(`monitor ${scenario} state across themes and sizes`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/?api=substitute&scenario=${scenario}`);
        await expect(page).toHaveTitle('Production Core Aids');
        if (scenario === 'default' || scenario === 'signed-out')
          await expect(page.getByRole('heading', { name: 'Application API' })).toBeVisible();
        if (scenario === 'empty') {
          await expect(page.getByText('No services configured')).toBeVisible();
          await expect(
            page.locator('emfc-empty-block').getByRole('button', { name: 'Refresh checks' }),
          ).toBeVisible();
        }
        if (scenario === 'failure') {
          const alert = page.getByRole('alert');
          await expect(alert).toContainText('Could not load service checks');
          await expect(alert).not.toContainText('Error:');
          await expect(page.locator('emfc-metric .metric__value')).toHaveText(['—', '—', '—', '—']);
        }
        if (scenario === 'loading')
          await expect(page.locator('.skeleton-card').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: resolve(visuals, `${scenario}-${scheme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('live local monitor loads targets and refreshes through its contract', async ({ page }) => {
  let calls = 0;
  await page.route('http://localhost:5311/api/targets', (route) => {
    calls += 1;
    return route.fulfill({
      json: [
        {
          id: 'fixture-api',
          name: 'Test API',
          group: 'Fixture',
          kind: 'http',
          up: true,
          latencyMs: 19,
          error: null,
          checkedAt: new Date().toISOString(),
        },
      ],
    });
  });
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/?api=substitute');
      await page.getByRole('button', { name: 'Try live service' }).click();
      await expect(page.getByText('Live service', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Test API' })).toBeVisible();
      await expect(page.getByText('Live health checks from your local service')).toBeVisible();
      await page.getByRole('button', { name: 'Refresh checks' }).click();
      await expect
        .poll(() => calls)
        .toBeGreaterThanOrEqual((scheme === 'light' ? 1 : 3) + (width === 1440 ? 1 : 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: resolve(visuals, `live-${scheme}-${width}.png`),
        fullPage: true,
      });
    }
  }
});

test('system language updates visible controls and document title', async ({ page }) => {
  await page.goto('/?api=substitute');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(
    page.getByRole('heading', { name: 'Tình trạng dịch vụ', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại' })).toBeVisible();
  await expect(page).toHaveTitle('Production Core Aids');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('keyboard can reach the skip link and local sample is explicitly labeled', async ({
  page,
}) => {
  await page.goto('/?api=substitute&scenario=default');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?api=substitute&scenario=default$/);
  await expect(page.locator('#content')).toBeFocused();
  await expect(page.getByText('Example health data · stays in this browser')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unreachable local service switches to labeled substitute data with recovery guidance', async ({
  page,
}) => {
  await page.route('http://localhost:5311/api/targets', (route) =>
    route.abort('connectionrefused'),
  );
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(
        page.getByText('Preview data · service unavailable', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          'Start the local service at http://localhost:5311 to restore live health checks.',
        ),
      ).toBeVisible();
      await expect(page.getByText('Example health data · stays in this browser')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: resolve(visuals, `unavailable-${scheme}-${width}.png`),
        fullPage: true,
      });
    }
  }
});

test('tablet layout remains within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/?api=substitute');
  await expect(page.getByRole('heading', { name: 'Dependency health' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
