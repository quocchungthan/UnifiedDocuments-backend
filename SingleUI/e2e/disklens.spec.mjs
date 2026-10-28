import { expect, test } from '@playwright/test';

test('substitute overview, controls, scan progress and product views', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?api=substitute&scenario=default');
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible();
  await expect(page.getByText('Substitute data · stays in this browser', { exact: true })).toBeVisible();
  await expect(page.getByText('No scan ran on your computer.', { exact: false })).toBeVisible();
  await expect(page.getByText('Live service unavailable.', { exact: false })).toHaveCount(0);
  await expect(page.locator('.coverage summary')).toContainText('1 error · 2 links skipped');
  const identity = page.locator('.file-identity').first();
  const icon = await identity.locator('button').boundingBox();
  const name = await identity.locator('.file-name').boundingBox();
  expect(icon.x + icon.width).toBeLessThanOrEqual(name.x);
  expect(Math.abs(icon.y + icon.height / 2 - name.y - name.height / 2)).toBeLessThan(3);
  await expect(page.getByText('Scanned footprint')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What fills your space?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Space hotspots' })).toBeVisible();

  await page.getByRole('button', { name: 'Scan location' }).click();
  await expect(page.getByText('Reading file metadata')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel scan' })).toBeVisible();
  await expect(page.getByText('Reading file metadata')).toBeVisible();
  await expect(page.locator('.scan-progress')).toBeVisible();
  await expect(page.locator('.scan-progress')).toBeHidden({ timeout: 12_000 });

  await page.getByRole('button', { name: 'File inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Every file. One clear view.' }).first()).toBeVisible();
  await expect(page.getByText('launch-film-4k.mp4')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  for (const label of ['Size', 'Last modified', 'Review signal', 'Inspect']) await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Shortlist launch-film-4k.mp4' }).click();
  await page.getByRole('button', { name: 'Review shortlist' }).click();
  await expect(page.getByRole('heading', { name: 'Saved for a closer look' })).toBeVisible();
  await expect(page.getByText('launch-film-4k.mp4')).toBeVisible();
  await page.getByRole('button', { name: 'Space changes' }).click();
  await expect(page.getByRole('heading', { name: 'Follow the growth, not the branches' })).toBeVisible();
  await page.getByRole('button', { name: 'Scan history' }).click();
  await expect(page.getByRole('heading', { name: 'A record, not a guess' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const scenario of ['signed-out', 'empty', 'failure', 'loading']) {
  test(`${scenario} substitute presentation remains explicit and responsive`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/?api=substitute&scenario=${scenario}`);
    await expect(page.getByText('Substitute data · stays in this browser', { exact: true })).toBeVisible();
    await expect(page.getByText('No scan ran on your computer.', { exact: false })).toBeVisible();
    if (scenario === 'empty') await expect(page.getByRole('heading', { name: 'Start with a folder. Find your opportunities.' })).toBeVisible();
    if (scenario === 'failure') await expect(page.getByRole('alert')).toBeVisible();
    if (scenario === 'loading') await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    if (scenario === 'signed-out') await expect(page.getByText('Scanned footprint')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-emfc-theme', 'system');
    expect(errors).toEqual([]);
  });
}

test('automatic system locale, light/dark appearance and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/?api=substitute&scenario=default');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page.getByRole('heading', { name: 'Dành chỗ cho điều quan trọng.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('html')).toHaveAttribute('data-emfc-theme', 'system');
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (scheme === 'light') {
      const channels = await page.evaluate(() =>
        getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g).map(Number),
      );
      expect(Math.max(...channels.slice(0, 3)) - Math.min(...channels.slice(0, 3))).toBeLessThanOrEqual(5);
    }
  }
  await page.locator('body').evaluate((body) => { body.tabIndex = -1; body.focus(); body.removeAttribute('tabindex'); });
  await page.keyboard.press('Tab');
  await expect(page.locator('a').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});


test('visual matrix captures every app view, scenario, theme and target viewport', async ({ page }, info) => {
  test.setTimeout(120_000);
  const scenarios = ['default', 'signed-out', 'empty', 'failure', 'loading'];
  const views = [
    ['Overview', 'overview'], ['File inventory', 'inventory'], ['Space changes', 'changes'],
    ['Review shortlist', 'shortlist'], ['Scan history', 'history'],
  ];
  for (const scenario of scenarios) {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 920 });
      await page.goto(`/?api=substitute&scenario=${scenario}`);
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme });
        for (const [label, slug] of views) {
          await page.getByRole('button', { name: label, exact: true }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`visual/${scenario}-${slug}-${scheme}-${width}.png`), fullPage: true });
        }
      }
    }
  }
});

test('live API client uses DiskLens contracts and the local scan command', async ({ page }) => {
  const requests = [];
  let scan = { id: null, state: 'idle', root: '', files: 0, bytes: 0, issues: 0, skippedLinks: 0, currentPath: null, message: null };
  const monitor = { enabled: false, root: '', intervalMinutes: 30, nextScan: null };
  await page.route('http://127.0.0.1:5274/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    const headers = {
      'Access-Control-Allow-Origin': request.headers().origin ?? '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-DiskLens',
      'Access-Control-Allow-Private-Network': 'true',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/api/config') return route.fulfill({ headers, json: { defaultRoot: 'C:\\Users\\Fixture', dataDirectory: 'C:\\AppData\\DiskLens', explorerSupported: true, drives: [{ root: 'C:\\', total: 1000, free: 400 }], monitor } });
    if (url.pathname === '/api/status') return route.fulfill({ headers, json: { scan, monitor } });
    if (url.pathname === '/api/scans' && request.method() === 'GET') return route.fulfill({ headers, json: [] });
    if (url.pathname === '/api/scans' && request.method() === 'POST') {
      expect(request.headers()['x-disklens']).toBe('1');
      expect(request.postDataJSON()).toEqual({ root: 'C:\\Users\\Fixture' });
      scan = { id: 'fixture-scan', state: 'scanning', root: 'C:\\Users\\Fixture', files: 0, bytes: 0, issues: 0, skippedLinks: 0, currentPath: 'C:\\Users\\Fixture', message: null };
      return route.fulfill({ status: 202, headers });
    }
    return route.fulfill({ status: 404, headers, json: { error: 'fixture endpoint missing' } });
  });
  await page.goto('/?api=live');
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start with a folder. Find your opportunities.' })).toBeVisible();
  await page.getByRole('button', { name: 'Scan location' }).click();
  await expect(page.locator('.scan-progress')).toBeVisible();
  expect(requests).toContain('POST /api/scans');
});

test('same-page links preserve substitute query and focus the main content', async ({ page }) => {
  await page.goto('/?api=substitute&scenario=empty');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveURL(/\?api=substitute&scenario=empty$/);
  await page.getByRole('link', { name: 'DiskLens' }).click();
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveURL(/\?api=substitute&scenario=empty$/);
});

 test('automatic fallback alone reports an unavailable live service', async ({ page }) => {
  await page.route('http://127.0.0.1:5274/api/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.local-notice')).toContainText('Live service unavailable.');
});

test('Dean and Sam Winchester chibi companions patrol DiskLens surfaces and only stop when clicked directly', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?api=substitute&scenario=default');
  await expect(page.locator('disklens-sidebar nav.animate-tabs')).toHaveAttribute('data-aui-tabs', 'ready');
  const dean = page.locator('[data-hunter="dean"]');
  const sam = page.locator('[data-hunter="sam"]');
  await expect(dean).toBeAttached();
  await expect(sam).toBeAttached();
  await expect(dean).toHaveAttribute('data-staring', 'false');
  await expect(sam).toHaveAttribute('data-staring', 'false');
  await page.mouse.move(520, 240);
  await page.locator('.heading-row h1').click();
  await expect(dean).toHaveAttribute('data-staring', 'false');
  await expect(sam).toHaveAttribute('data-staring', 'false');
  await dean.click();
  await expect(dean).toHaveAttribute('data-pose', 'talk');
  await expect(dean).toHaveAttribute('data-staring', 'true');
  await expect(sam).toHaveAttribute('data-staring', 'false');
  await sam.click();
  await expect(sam).toHaveAttribute('data-pose', 'talk');
  await expect(sam).toHaveAttribute('data-staring', 'true');
  await expect(page.locator('[data-bubble-for="dean"]')).toContainText('Dean Winchester');
  await expect(page.locator('[data-bubble-for="sam"]')).toContainText('Sam Winchester');
  const deanBubble = page.locator('[data-bubble-for="dean"]');
  await page.emulateMedia({ colorScheme: 'light' });
  const lightBg = await deanBubble.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBg = await deanBubble.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: info.outputPath('winchesters-companion.png') });
});
