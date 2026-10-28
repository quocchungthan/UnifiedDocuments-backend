import { test, expect } from '@playwright/test';
import { color, rgb } from '../../scripts/palette.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { localEnvironment, storageOrigin } from './configure-hosts.mjs';
import { checkButtonStates, checkRenderedContrast } from '../../e2e/presentation.mjs';

const hosts = {
  storage: {
    url: `${storageOrigin}/accounts/login/`,
    css: `${storageOrigin}/custom-css/`,
  },
  note: { url: 'http://localhost:8112/', css: 'http://localhost:8112/single-ui.css' },
};

async function signInStorage(page) {
  const env = await localEnvironment();
  const welcome = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Welcome to Seafile', exact: true }),
  });
  await page.addLocatorHandler(welcome, async () => {
    await welcome.getByRole('button').click();
  });
  await page.goto(hosts.storage.url, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=login]').fill('admin@example.invalid');
  await page.locator('input[name=password]').fill(env.STORAGE_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await expect(page.getByRole('link', { name: 'My Library', exact: true })).toBeVisible();
}

for (const [name, host] of Object.entries(hosts)) {
  for (const width of [375, 1440]) {
    test(`${name} real container presentation at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(host.url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toHaveCSS('font-family', /DM Sans/);
      const response = await page.request.get(host.css);
      expect(response.status()).toBe(200);
      const actual = createHash('sha256')
        .update(await response.body())
        .digest('hex');
      const expected = createHash('sha256')
        .update(
          await readFile(
            new URL(
              `../../dist-ui/${name === 'storage' ? 'seafile' : name === 'note' ? 'affine' : 'mail'}.css`,
              import.meta.url,
            ),
          ),
        )
        .digest('hex');
      expect(actual).toBe(expected);
      if (name === 'note') {
        await checkRenderedContrast(
          page.getByTestId('local-demo-tips').locator(':scope > div').first(),
        );
        await expect(page.getByText('Welcome to AFFiNE!', { exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        if (width === 375) {
          const sidebar = page.getByTestId('app-sidebar-wrapper');
          if ((await sidebar.getAttribute('data-open')) === 'true') {
            await page
              .getByTestId('app-sidebar-arrow-button-collapse')
              .filter({ visible: true })
              .first()
              .getByRole('button')
              .click();
          }
          await expect(sidebar).toHaveAttribute('data-open', 'false');
          await expect(sidebar).toHaveAttribute('data-transition-state', 'exited');
          const welcome = await page.getByText('Welcome to AFFiNE!', { exact: true }).boundingBox();
          expect(welcome.x).toBeGreaterThanOrEqual(0);
          expect(welcome.x + welcome.width).toBeLessThanOrEqual(width);
          const paragraph = await page
            .locator('affine-paragraph')
            .filter({ hasText: 'You can start with' })
            .boundingBox();
          expect(paragraph.x + paragraph.width).toBeLessThanOrEqual(width);
        }
      }
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        await expect(page.locator('body')).toHaveCSS(
          'background-color',
          rgb(colorScheme, 'canvas'),
        );
        if (name === 'storage') {
          await expect(page.locator('.login-panel')).toHaveCSS(
            'background-color',
            rgb(colorScheme, 'raised'),
          );
          await expect(page.getByRole('button', { name: 'Log In', exact: true })).toHaveCSS(
            'background-color',
            rgb(colorScheme, 'action'),
          );
          await checkButtonStates(page, page.getByRole('button', { name: 'Log In', exact: true }));
        }
        if (name === 'note') {
          await expect
            .poll(() =>
              page
                .locator('html')
                .evaluate((e) =>
                  getComputedStyle(e).getPropertyValue('--affine-v2-button-primary').trim(),
                ),
            )
            .toBe(color(colorScheme, 'accent-hover'));
          await checkButtonStates(
            page,
            page.getByTestId('local-demo-tips').getByRole('button', { name: 'Sign in and enable' }),
          );
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`${name}-${width}-${colorScheme}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
    });
  }
}

test('Seafile native account, library list and new-library dialog retain usable styling', async ({
  page,
}, info) => {
  await signInStorage(page);
  await page.getByRole('button', { name: /New Library$/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/\bshow\b/);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(dialog.locator('.modal-content')).toHaveCSS('background-color', rgb('dark', 'raised'));
  await expect(dialog.locator('.form-control')).toHaveCSS('background-color', rgb('dark', 'raised'));
  await dialog.locator('.form-control').fill('Visual check only');
  await expect(dialog.getByRole('button', { name: 'Submit', exact: true })).toHaveCSS(
    'background-color',
    rgb('dark', 'action'),
  );
  await page.screenshot({
    path: info.outputPath('storage-library-dialog-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({
    path: info.outputPath('storage-library-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('.side-panel')).toHaveCSS('background-color', rgb('dark', 'surface'));
  await expect(page.getByRole('link', { name: 'My Libraries', exact: true })).toHaveCSS(
    'color',
    rgb('dark', 'ink'),
  );
  await checkRenderedContrast(page.getByRole('link', { name: 'Help', exact: true }));
  await page.screenshot({
    path: info.outputPath('storage-library-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

for (const width of [375, 1440]) {
  test(`Seafile native menus, file states and editor chrome at ${width}px`, async ({ page, request }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1000 });
    await signInStorage(page);
    const env = await localEnvironment();
    const auth = await request.post(`${storageOrigin}/api2/auth-token/`, {
      form: { username: 'admin@example.invalid', password: env.STORAGE_ADMIN_PASSWORD },
    });
    expect(auth.ok()).toBe(true);
    const { token } = await auth.json();
    const headers = { Authorization: `Token ${token}` };
    const repos = await request.get(`${storageOrigin}/api2/repos/`, { headers });
    expect(repos.ok()).toBe(true);
    const library = (await repos.json()).find((repo) => repo.name === 'My Library');
    expect(library).toBeDefined();
    const filename = `Contrast-${width}.md`;
    const created = await request.post(
      `${storageOrigin}/api2/repos/${library.id}/file/?p=/${filename}`,
      { headers, form: { operation: 'create' } },
    );
    expect(created.ok()).toBe(true);
    await page.getByRole('link', { name: 'My Library', exact: true }).click();
    const file = page.getByRole('link', { name: filename, exact: true }).filter({ visible: true });
    const filePath = await file.getAttribute('href');
    const libraryPath = new URL(page.url()).pathname;
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await page.goto(`${storageOrigin}${libraryPath}`);
      const row = page.locator('tr').filter({ has: file });
      await expect(file).toBeVisible();
      await checkRenderedContrast(file);
      await row.hover();
      await expect(row).toHaveCSS('background-color', rgb(colorScheme, 'surface-hover'));
      await checkRenderedContrast(file);
      for (const cell of await row.locator('td:visible').all())
        await checkRenderedContrast(cell);
      for (const metadata of await row.locator('.item-meta-info:visible').all())
        await checkRenderedContrast(metadata);
      const checkbox = row.getByRole('checkbox');
      if (await checkbox.isVisible()) {
        await checkbox.check();
        await expect(row).toHaveClass(/tr-active/);
        await page.mouse.move(0, 0);
        await expect(row).toHaveCSS('background-color', rgb(colorScheme, 'accent-soft'));
        await checkRenderedContrast(file);
        await row.hover();
        await checkRenderedContrast(file);
        await page.keyboard.press('Tab');
        await file.focus();
        await expect(file).toHaveCSS('outline-style', 'solid');
        await checkRenderedContrast(file, 3, 'outlineColor');
      }
      await page.screenshot({
        path: info.outputPath(`storage-files-${width}-${colorScheme}.png`),
        fullPage: true,
      });
      await page.goto(`${storageOrigin}/sys/web-settings/`);
      const selected = page.locator('.side-panel .nav-link.active').filter({ visible: true });
      if (width >= 768 && await selected.count()) {
        await checkRenderedContrast(selected);
        await selected.hover();
        await checkRenderedContrast(selected);
      }
      await checkRenderedContrast(page.locator('.cur-view-path .sf-heading'));
      await page.locator('.account-toggle').filter({ visible: true }).click();
      const menu = page.locator('#user-info-popup');
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS('background-color', rgb(colorScheme, 'raised'));
      await checkRenderedContrast(menu.locator('.txt'));
      const settings = menu.getByRole('link', { name: 'Settings', exact: true });
      await checkRenderedContrast(settings);
      await settings.hover();
      await checkRenderedContrast(settings);
      await page.keyboard.press('Tab');
      await settings.focus();
      await expect(settings).toHaveCSS('outline-style', 'solid');
      await checkRenderedContrast(settings, 3, 'outlineColor');
      await page.screenshot({
        path: info.outputPath(`storage-account-${width}-${colorScheme}.png`),
        fullPage: true,
      });
      await page.goto(`${storageOrigin}${filePath}`);
      const topbar = page.locator('.sf-md-viewer-topbar-first, .sf-md-viewer-topbar-first-narrow')
        .filter({ visible: true });
      await expect(topbar).toBeVisible();
      await expect(topbar).toHaveCSS('background-color', rgb(colorScheme, 'raised'));
      await checkRenderedContrast(topbar.locator('.file-name'));
      await checkRenderedContrast(topbar.locator('.file-state'));
      const editorToolbar = page.locator('.sf-slate-editor-toolbar');
      await expect(editorToolbar).toHaveCSS('background-color', rgb(colorScheme, 'raised'));
      for (const button of await editorToolbar.locator('button:visible').all())
        await checkRenderedContrast(button, 3);
      const action = topbar.locator('.btn-secondary:visible:not(:disabled)').first();
      await checkRenderedContrast(action, 3);
      await action.hover();
      await checkRenderedContrast(action, 3);
      await page.screenshot({
        path: info.outputPath(`storage-editor-${width}-${colorScheme}.png`),
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
