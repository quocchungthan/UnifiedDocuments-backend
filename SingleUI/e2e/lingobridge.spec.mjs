import { expect, test } from '@playwright/test';

const fixtureHash = '7b9f848b3d24e8a3c17f0b1e8f64c7a2276c8f19a04d3bb2d62a5c5e19f2a410';
const errorsByPage = new WeakMap();
test.beforeEach(({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(({ page }) => expect(errorsByPage.get(page)).toEqual([]));

const sampleUrl = (scenario = 'default', route = '/') =>
  `/?api=substitute&scenario=${scenario}#${route}`;

async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('gallery, public hash lookup and substitute labeling', async ({ page }) => {
  await page.goto(sampleUrl());
  await expect(page.getByRole('heading', { name: 'Your English PDFs, bridged into Vietnamese.' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Substitute data');
  await expect(page.getByRole('heading', { name: 'Public translations' })).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByRole('article')).toHaveCount(5);
  await expect(page.locator('lingo-public-gallery').getByText('Sample · Completed').first()).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByText('Sample · Translating')).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByText('Sample · Queued')).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByText('5 documents')).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByRole('textbox', { name: 'Search public translations' })).toHaveAttribute('placeholder', 'Search translations');
  await page.getByLabel('SHA-256 fingerprint').fill(fixtureHash);
  await page.getByRole('button', { name: 'Check status' }).click();
  await expect(page).toHaveURL(/#\/jobs\//);
  const job = page.locator('lingo-job-page');
  await expect(job.getByRole('heading', { name: 'Vietnamese literature review.pdf' })).toBeVisible();
  await expect(job.getByText('Sample · Completed', { exact: true })).toBeVisible();
  await expect(page.getByText(/does not generate files/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('file upload becomes a local job, file visibility and profile are manageable', async ({ page }) => {
  await page.goto(sampleUrl());
  await page.goto(sampleUrl('default', '/upload'));
  await page.locator('#document-file').setInputFiles({ name: 'field-guide.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') });
  await page.getByRole('button', { name: 'Start translation' }).click();
  await expect(page).toHaveURL(/#\/jobs\//);
  await expect(page.getByText('Sample status only. Substitute mode does not generate files.')).toBeVisible();
  await page.goto(sampleUrl('default', '/files'));
  await expect(page.getByRole('heading', { name: 'My files' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('columnheader')).toHaveCount(4);
  const toggle = page.getByLabel('Visible to everyone').last();
  await toggle.check();
  await expect(toggle).toBeChecked();
  const removable = page.getByRole('row').filter({ hasText: 'Community health policy.pdf' });
  await removable.getByRole('button', { name: 'Delete file' }).click();
  await expect(removable.getByRole('group')).toContainText('Remove this file');
  await removable.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(removable).toHaveCount(0);
  await page.goto(sampleUrl('default', '/account'));
  await page.getByLabel('Display name').fill('Alex Tran');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
});

test('signed-out, empty, failure and loading substitute scenarios are explicit', async ({ page }) => {
  await page.goto(sampleUrl('signed-out', '/upload'));
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('This session is local demo data', { exact: false })).toBeVisible();
  await page.getByLabel('Email address').fill('reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByRole('heading', { name: 'Your English PDFs, bridged into Vietnamese.' })).toBeVisible();

  await page.goto(sampleUrl('empty'));
  await expect(page.getByText('No public translations yet')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('empty-gallery.png'), fullPage: true });

  await page.goto(sampleUrl('failure'));
  await expect(page.getByRole('alert')).toContainText('Could not load service data');
  await page.screenshot({ path: test.info().outputPath('failure-gallery.png'), fullPage: true });

  await page.goto(sampleUrl('loading'));
  await expect(page.getByRole('status', { name: 'Loading translations' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('loading-gallery.png'), fullPage: true });
});

test('registration validates its confirmation and creates only a local substitute session', async ({ page }) => {
  await page.goto(sampleUrl('signed-out', '/login'));
  await page.getByRole('button', { name: 'New to LingoBridge? Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Email address').fill('new.reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('sample-password');
  await page.getByLabel('Confirm password').fill('different-password');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  await page.getByLabel('Confirm password').fill('sample-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your English PDFs, bridged into Vietnamese.' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Substitute data');
});

test('switching from substitute to live changes the selected source', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config') return route.fulfill({ json: { maxSizeBytes: 20_000_000, accept: ['.pdf'], languagePairs: [{ source: 'en', target: 'vi' }] } });
    if (path === '/api/engine') return route.fulfill({ json: { queued: 0, running: 0 } });
    if (path === '/api/uploads/public') return route.fulfill({ json: [] });
    if (path === '/api/auth/me') return route.fulfill({ json: { email: 'reader@example.test', roles: ['User'], displayName: 'Reader' } });
    if (path === '/api/uploads/mine') return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto(sampleUrl());
  await expect(page.getByRole('status')).toContainText('Substitute data');
  await page.getByRole('button', { name: 'Try live service' }).click();
  await expect(page.getByRole('status')).toHaveText('Live service');
  await expect(page.getByRole('button', { name: 'Use substitute data' })).toBeVisible();
});

test('live API paths match the original same-origin REST contract', async ({ page }) => {
  const requests = [];
  const upload = { id: 'fixture', hash: 'a'.repeat(64), fileName: 'Live source.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-22T00:00:00Z' };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === '/api/config') return route.fulfill({ json: { maxSizeBytes: 20_000_000, accept: ['.pdf'], languagePairs: [{ source: 'en', target: 'vi' }] } });
    if (path === '/api/engine') return route.fulfill({ json: { queued: 1, running: 2 } });
    if (path === '/api/uploads/public') return route.fulfill({ json: [upload] });
    if (path === '/api/auth/me') return route.fulfill({ json: { email: 'reader@example.test', roles: ['User'], displayName: 'Reader' } });
    if (path === '/api/uploads/mine') return route.fulfill({ json: [] });
    if (path.endsWith('/status')) return route.fulfill({ json: { state: 'Completed', fileName: upload.fileName, sizeBytes: 1024, queuePosition: null, stage: null, chunksCompleted: 12, chunksTotal: 12, message: null, resultAvailable: true, createdAt: upload.createdAtUtc, startedAt: upload.createdAtUtc, completedAt: upload.createdAtUtc } });
    return route.fulfill({ status: 404, contentType: 'application/problem+json', body: '{"title":"not found"}' });
  });
  await page.goto('/');
  await expect(page.locator('emfc-service-status')).toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Live source.pdf' })).toBeVisible();
  await expect.poll(() => requests).toContain('/api/config');
  expect(requests).toContain('/api/uploads/public');
});

test('browser language, system themes, responsive widths and screen captures', async ({ page }) => {
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 920 });
      await page.goto(sampleUrl());
      await expect(page.getByRole('heading', { name: 'Public translations' })).toBeVisible();
      await expect(page.locator('lingo-public-gallery').getByRole('article')).toHaveCount(5);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: test.info().outputPath(`gallery-${colorScheme}-${width}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page.getByRole('heading', { name: 'Bản dịch công khai' })).toBeVisible();
  await expect(page.locator('lingo-public-gallery').getByText('5 tài liệu')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');

  const localizedRoutes = [
    ['/', 'Bản dịch công khai'],
    ['/upload', 'Dịch PDF'],
    ['/files', 'Tệp của tôi'],
    ['/account', 'Hồ sơ'],
    ['/jobs/' + fixtureHash, 'Vietnamese literature review.pdf'],
    ['/login', 'Chào mừng trở lại'],
  ];
  await page.setViewportSize({ width: 375, height: 900 });
  for (const [route, heading] of localizedRoutes) {
    await page.goto(sampleUrl('default', route));
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.goto(sampleUrl('default', '/account'));
  await expect(page.getByLabel('Tên hiển thị')).toBeVisible();
});

test('all substitute scenarios fit mobile and desktop in both system themes', async ({ page }) => {
  const scenarios = [
    ['default', '/', 'Public translations'],
    ['signed-out', '/upload', 'Welcome back'],
    ['empty', '/', 'No public translations yet'],
    ['failure', '/', 'Could not load service data. Try again.'],
    ['loading', '/', 'Loading translations'],
  ];
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [scenario, route, content] of scenarios) {
        await page.goto(sampleUrl(scenario, route));
        if (scenario === 'failure') await expect(page.getByText(content, { exact: false }).first()).toBeVisible();
        else if (scenario === 'loading') await expect(page.getByRole('status', { name: content })).toBeVisible();
        else if (scenario === 'empty') await expect(page.getByText(content)).toBeVisible();
        else await expect(page.getByRole('heading', { name: content }).first()).toBeVisible();
        await noHorizontalOverflow(page);
        await page.screenshot({ path: test.info().outputPath(`scenario-${scenario}-${colorScheme}-${width}.png`), fullPage: true });
      }
    }
  }
});

test('skip and section links preserve substitute selection and focus their targets', async ({ page }) => {
  await page.goto(sampleUrl());
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#content');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/api=substitute/);
  await expect(page.locator('#content')).toBeFocused();
  await page.getByRole('link', { name: 'Browse translations' }).click();
  await expect(page).toHaveURL(/api=substitute/);
  await expect(page.locator('#gallery')).toBeFocused();
  expect(await page.locator('#gallery').evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(900);
});

test('keyboard focus reaches visible primary navigation', async ({ page }) => {
  await page.goto(sampleUrl());
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#content');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'LingoBridge home');
  await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid');
});

test('upload, status, files, account and sign-in screens hold their layout', async ({ page }) => {
  const screens = [
    ['upload', '/upload', 'Translate a PDF'],
    ['files', '/files', 'My files'],
    ['account', '/account', 'Alex Nguyen'],
    ['job', `/jobs/${fixtureHash}`, 'Vietnamese literature review.pdf'],
    ['auth', '/login', 'Welcome back'],
  ];
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, route, heading] of screens) {
        await page.goto(sampleUrl('default', route));
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
        await noHorizontalOverflow(page);
        await page.screenshot({ path: test.info().outputPath(`${name}-${colorScheme}-${width}.png`), fullPage: true });
      }
    }
  }
});
