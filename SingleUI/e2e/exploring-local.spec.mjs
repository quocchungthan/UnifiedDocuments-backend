import { expect, test } from '@playwright/test';
import { checkPresentation } from './presentation.mjs';

const query = (scenario = 'default') => `/?api=substitute&scenario=${scenario}`;

async function expectNarrowLayout(page) {
  await page.setViewportSize({ width: 375, height: 900 });
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
  }));
  expect(scrollWidth, 'narrow layout should not overflow horizontally').toBeLessThanOrEqual(
    innerWidth,
  );
}

async function startSearch(page, scenario = 'default') {
  await page.goto(query(scenario));
  if (scenario === 'loading') return;
  await page.getByLabel('District or neighborhood').fill('Thảo Điền, District 2');
  await page.getByRole('button', { name: 'Search places' }).click();
}

test('search results, saved places, local history, keyboard and responsive themes', async ({
  page,
}, info) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await startSearch(page);
  await expect(page.getByRole('heading', { name: 'Coffee places' })).toBeVisible();
  await expect(page.locator('explore-place-card')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Open place listing/ })).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Substitute data · stays in this browser' }),
  ).toBeVisible();
  await expect(page.locator('.topbar')).not.toContainText('Live service not checked');
  await page.getByRole('button', { name: 'Save place' }).first().click();
  await expect(page.getByRole('heading', { name: 'Saved places' })).toBeVisible();
  await expect(
    page.locator('.lower-grid section[aria-labelledby="saved-title"] explore-place-card'),
  ).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeVisible();
  await expect(page.getByText('Thảo Điền, District 2', { exact: true }).first()).toBeVisible();

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`default-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('default-dark.png'), fullPage: true });
  const darkCanvas = await page
    .locator('.shell')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const lightCanvas = await page
    .locator('.shell')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkCanvas).not.toBe(lightCanvas);

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  const focusStyle = await page
    .locator(':focus')
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(focusStyle).not.toBe('none');
  await page.reload();
  await expect(
    page.locator('.lower-grid section[aria-labelledby="saved-title"] explore-place-card'),
  ).toHaveCount(1);
  await expect(page.locator('.history-list')).toContainText('Thảo Điền, District 2');
  expect(consoleErrors).toEqual([]);
});

test('empty search gives a helpful next step', async ({ page }, info) => {
  await startSearch(page, 'empty');
  await expect(page.getByRole('heading', { name: 'No matching places found' })).toBeVisible();
  await expect(page.getByText(/Try another neighborhood/)).toBeVisible();
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`empty-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('empty-dark.png'), fullPage: true });
});

test('signed-out substitute explains Copilot sign-in', async ({ page }, info) => {
  await startSearch(page, 'signed-out');
  await expect(page.getByRole('alert')).toContainText('Sign in to GitHub Copilot');
  await expectNarrowLayout(page);
  await page.screenshot({ path: info.outputPath('signed-out.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('signed-out-dark.png'), fullPage: true });
});

test('failed search offers retry without hiding the form', async ({ page }, info) => {
  await startSearch(page, 'failure');
  await expect(page.getByRole('alert')).toContainText('Search could not finish');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByLabel('District or neighborhood')).toHaveValue('Thảo Điền, District 2');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('alert')).toContainText('Search could not finish');
  await expectNarrowLayout(page);
  await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('failure-dark.png'), fullPage: true });
});

test('long-running search shows elapsed progress', async ({ page }, info) => {
  await startSearch(page, 'loading');
  await expect(
    page.getByRole('status').filter({ hasText: 'Copilot is checking public guides' }),
  ).toBeVisible();
  await expect(page.getByText('Elapsed 0:00')).toBeVisible();
  await page.waitForTimeout(1_100);
  await expect(page.getByText('Elapsed 0:01')).toBeVisible();
  await page.screenshot({ path: info.outputPath('loading-progress.png'), fullPage: true });
  await expectNarrowLayout(page);
  await page.screenshot({ path: info.outputPath('loading-progress-mobile.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('loading-progress-dark.png'), fullPage: true });
});

test('nearby search records a location-based query', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 10.801, longitude: 106.731 });
  await page.goto(query());
  await page.getByRole('button', { name: 'Near me' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee places' })).toBeVisible();
  await expect(page.locator('.chip')).toContainText('Near your location');
  await expect(page.locator('.history-list')).toContainText('10.801, 106.731');
  await expectNarrowLayout(page);
});

test('browser language updates visible and accessible copy', async ({ page }, info) => {
  await page.goto(query());
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(
    page.getByRole('heading', { name: 'Tìm điểm dừng cà phê tiếp theo' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm địa điểm' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page).toHaveTitle('Khám phá quanh đây');
  await expectNarrowLayout(page);
  await page.screenshot({ path: info.outputPath('vietnamese-mobile.png'), fullPage: true });
});

test('live API client uses the original local service endpoints', async ({ page }) => {
  const cafe = {
    name: 'Verified guide fixture',
    address: 'District 2',
    rating: 4.6,
    reviews: 72,
    sourceUrl: 'https://example.com/guide',
  };
  let cafeUrl = '';
  await page.route('http://localhost:5312/**', async (route) => {
    const request = route.request();
    const origin = request.headers().origin ?? 'http://127.0.0.1:4614';
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'accept, content-type',
      'Content-Type': 'application/json',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    if (url.pathname === '/api/health')
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ ok: true, tool: 'Exploring Local', copilotReady: true }),
      });
    cafeUrl = request.url();
    return route.fulfill({ status: 200, headers, body: JSON.stringify([cafe]) });
  });
  await page.goto('/?api=live');
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await page.getByLabel('District or neighborhood').fill('District 2');
  await page.getByRole('button', { name: 'Search places' }).click();
  await expect(page.locator('explore-place-card')).toContainText('Verified guide fixture');
  expect(cafeUrl).toContain('/api/cafes?minRating=4.3&minReviews=20&district=District+2');
  await expectNarrowLayout(page);
});

test('skip link moves focus without dropping the selected source scenario', async ({ page }) => {
  await page.goto(query('signed-out'));
  const skipLink = page.locator('a[emfcSkipLink]');
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#content')).toBeFocused();
  await expect(page).toHaveURL(query('signed-out'));
});

test('every substitute scenario fits mobile and desktop in both system themes', async ({
  page,
}, info) => {
  const scenarios = [
    { id: 'default', ready: () => expect(page.locator('explore-place-card')).toHaveCount(3) },
    {
      id: 'signed-out',
      ready: () => expect(page.getByRole('alert')).toContainText('Sign in to GitHub Copilot'),
    },
    {
      id: 'empty',
      ready: () =>
        expect(page.getByRole('heading', { name: 'No matching places found' })).toBeVisible(),
    },
    {
      id: 'failure',
      ready: () => expect(page.getByRole('alert')).toContainText('Search could not finish'),
    },
    {
      id: 'loading',
      ready: () =>
        expect(
          page.getByRole('status').filter({ hasText: 'Copilot is checking public guides' }),
        ).toBeVisible(),
    },
  ];

  for (const scenario of scenarios) {
    await startSearch(page, scenario.id);
    await scenario.ready();
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth,
        }));
        expect(
          scrollWidth,
          `${scenario.id} ${colorScheme} ${width}px should not overflow`,
        ).toBeLessThanOrEqual(innerWidth);
        await page.screenshot({
          path: info.outputPath(`${scenario.id}-${colorScheme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
});

test('shared presentation tokens, controls and focus pass in both themes', async ({
  page,
}, info) => {
  await checkPresentation(page, info, 375, 'Find your next coffee stop', query());
});

test('substitute search respects districts and rating thresholds', async ({ page }) => {
  await page.goto(query());
  await expect(page.locator('explore-place-card')).toHaveCount(3);
  expect((await page.locator('explore-place-card').allTextContents()).join(' ')).not.toContain(
    'Thảo Điền',
  );

  await page.getByLabel('District or neighborhood').fill('District 2');
  await page.getByRole('button', { name: 'Search places' }).click();
  await expect(
    page.locator('explore-place-card').filter({ hasText: 'Thảo Điền' }).first(),
  ).toBeVisible();
  await expect(page.locator('explore-place-card')).toHaveCount(3);

  await page.getByLabel('Minimum rating').fill('4.5');
  await page.getByLabel('Minimum reviews').fill('500');
  await page.getByRole('button', { name: 'Search places' }).click();
  await expect(page.locator('explore-place-card')).toHaveCount(2);
  const filteredCards = (await page.locator('explore-place-card').allTextContents()).join(' ');
  expect(filteredCards).toContain('La Viet Coffee');
  expect(filteredCards).toContain('The Workshop Coffee');
});

test('unmatched substitute area never presents an unrelated address as a match', async ({
  page,
}) => {
  await page.goto(query());
  await expect(page.locator('explore-place-card')).toHaveCount(3);
  await page.getByLabel('District or neighborhood').fill('Uptown');
  await page.getByRole('button', { name: 'Search places' }).click();
  await expect(page.locator('explore-place-card')).toHaveCount(9);
  expect((await page.locator('explore-place-card').allTextContents()).join(' ')).toContain(
    'Sample for Uptown; location not verified',
  );
  expect((await page.locator('explore-place-card').allTextContents()).join(' ')).not.toContain(
    'District 1',
  );
});
