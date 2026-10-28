import { expect, test } from '@playwright/test';
import { rgb } from '../scripts/palette.mjs';
test.use({ locale: 'en-US' });

for (const width of [375, 1440]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`original mailbox chooser · ${colorScheme} · ${width}px`, async ({ page }, info) => {
      let selected = null;
      const accounts = ['owner@example.invalid', 'second@example.invalid'];
      const requests = [];
      await page.route('**/api/mail/**', route => {
        const path = new URL(route.request().url()).pathname;
        requests.push(path);
        if (path === '/api/mail/session') return route.fulfill({ json: {
          domain: 'example.invalid', email: selected, csrf: 'fixture-csrf',
          oauthConfigured: true, mailboxes: selected ? [] : accounts,
          authErrors: selected ? [] : ['Explicit authentication guidance'],
        } });
        return route.fulfill({ json: { messages: [], more: false } });
      });
      await page.route('**/auth/select', route => {
        const form = new URLSearchParams(route.request().postData());
        expect(form.get('csrf')).toBe('fixture-csrf');
        expect(form.get('address')).toBe(accounts[1]);
        selected = form.get('address');
        return route.fulfill({ status: 302, headers: { location: '/' } });
      });
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/auth/choose?api=live');
      await expect(page.getByRole('heading', { name: 'You manage multiple mailboxes.' })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveText('Explicit authentication guidance');
      await expect(page.getByRole('button', { name: accounts[0], exact: true })).toBeVisible();
      expect(requests).toEqual(['/api/mail/session']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`choose-${width}-${colorScheme}.png`), fullPage: true });
      await page.getByRole('button', { name: accounts[1], exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
      await expect(page.locator('.account')).toContainText(accounts[1]);
    });
  }
}

for (const scenario of ['default', 'signed-out', 'empty', 'failure', 'loading']) {
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      test(`Mail ${scenario} scenario · ${colorScheme} · ${width}px`, async ({ page }, info) => {
        const errors = [];
        const apiRequests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (new URL(request.url()).pathname.startsWith('/api/mail/')) apiRequests.push(request.url());
        });
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.goto(`/?api=substitute&scenario=${scenario}`);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`api=substitute&scenario=${scenario}`));
        await expect(page.locator('#mail-content')).toBeFocused();
        await expect(page.locator('mail-page')).toHaveCSS('background-color', rgb(colorScheme, 'canvas'));
        await expect(page.locator('body')).not.toContainText(/SingleUI|workspace portal|appearance/i);
        if (scenario === 'default') {
          await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: /Maya Chen.*A few notes/ })).toBeVisible();
        } else if (scenario === 'signed-out') {
          await expect(page.getByRole('heading', { name: 'A mailbox session is required to continue.' })).toBeVisible();
          await expect(page.getByRole('link', { name: 'Sign in with SSO' })).toHaveCount(0);
        } else if (scenario === 'empty') {
          await expect(page.getByRole('heading', { name: 'No messages yet', exact: true })).toBeVisible();
        } else if (scenario === 'failure') {
          await expect(page.getByRole('alert')).toContainText('Mail is unavailable');
        } else {
          await expect(page.getByRole('status', { name: 'Loading mail…' })).toBeVisible();
          await expect(page.locator('emfc-service-status .spin')).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(apiRequests).toEqual([]);
        await page.screenshot({ path: info.outputPath(`${scenario}-${colorScheme}-${width}.png`), fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('message detail and local compose preserve mailbox privacy and never claim delivery', async ({ page }, info) => {
  await page.goto('/?api=substitute&scenario=default');
  const apiRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/mail/')) apiRequests.push(request.url());
  });
  await page.getByRole('button', { name: /Maya Chen.*A few notes/ }).click();
  await expect(page.getByRole('heading', { name: 'A few notes from the design review' })).toBeVisible();
  await expect(page.getByText('review-notes.pdf')).toBeVisible();
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: info.outputPath(`message-${colorScheme}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.getByRole('button', { name: 'Back to mailbox' }).click();
  await page.getByRole('button', { name: 'Compose', exact: true }).click();
  await page.getByLabel('To', { exact: true }).fill('friend@example.invalid');
  await page.getByLabel('Subject', { exact: true }).fill('Review notes');
  await page.getByLabel('Message', { exact: true }).fill('This stays in this browser.');
  await expect(page.getByRole('note')).toContainText('Saved locally · not sent');
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: info.outputPath(`compose-${colorScheme}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.getByRole('button', { name: 'Save locally · not sent', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved locally · not sent.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved locally', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Review notes/ })).toBeVisible();
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: info.outputPath(`saved-${colorScheme}-${width}.png`), fullPage: true });
    }
  }
  expect(await page.evaluate(() => localStorage.getItem('emfc-mail-local-saved-v1'))).toContain('This stays in this browser.');
  expect(apiRequests).toEqual([]);
});

test('language follows browser preferences in the signed-out session screen', async ({ page }) => {
  await page.goto('/?api=substitute&scenario=signed-out');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page).toHaveTitle('Thư');
  await expect(page.getByRole('heading', { name: 'Cần có phiên hộp thư để tiếp tục.' })).toBeVisible();
});
