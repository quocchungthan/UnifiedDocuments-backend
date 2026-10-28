import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });
const identity = '**';
const sampleSession = {
  isAuthenticated: true,
  brandName: 'Fixture Identity',
  name: 'Fixture Owner',
  email: 'owner@example.com',
  githubLogin: 'fixture-owner',
  avatarUrl: null,
  hasGithubToken: true,
  apps: [
    {
      key: 'storage',
      name: 'Storage',
      description: 'File and artifact storage.',
      url: 'https://storage.eldervibe.dev',
    },
  ],
};

for (const authenticated of [false, true]) {
  test(`configured brand is used throughout the ${authenticated ? 'signed-in' : 'signed-out'} page`, async ({
    page,
  }) => {
    const brandName = 'Elder & Vibe <Identity>';
    await page.route('**/api/**', (route) => {
      if (new URL(route.request().url()).pathname === '/api/session')
        return route.fulfill({
          json: authenticated
            ? { ...sampleSession, brandName }
            : { isAuthenticated: false, brandName, loginUrl: '/auth/login', apps: [] },
        });
      return route.fulfill({ status: 403, body: '' });
    });
    await page.goto('/');
    await expect(page).toHaveTitle(`Identity | ${brandName}`);
    await expect(page.locator('.topbar .brand')).toContainText(brandName);
    await expect(page.locator('body')).not.toContainText('Shuneo');
    await expect(page.locator('.topbar .brand')).not.toContainText('Fixture Identity');
    if (!authenticated)
      await expect(
        page.getByRole('heading', { name: `Welcome to ${brandName}`, exact: true }),
      ).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'languages', { value: ['vi-VN'], configurable: true });
      window.dispatchEvent(new Event('languagechange'));
    });
    await expect(page).toHaveTitle(`Danh tính | ${brandName}`);
    if (!authenticated)
      await expect(
        page.getByRole('heading', { name: `Chào mừng đến với ${brandName}`, exact: true }),
      ).toBeVisible();
  });
}

test('older session responses use a neutral identity label, not a fabricated brand', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { isAuthenticated: false, loginUrl: '/auth/login', apps: [] } }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Identity');
  await expect(page.locator('.topbar .brand')).toHaveText('Identity');
});
const audience = (clientId, days) => ({
  source: 'fences',
  clientId,
  from: '2026-10-16',
  through: '2026-10-22',
  totalUsers: 2,
  newUsers: 1,
  returningUsers: 1,
  growth: [{ date: '2026-10-20', users: 1 }],
  users: [
    {
      subject: 'fixture-user',
      username: 'fixture-user',
      firstSeen: '2026-10-20',
      lastSeen: '2026-10-22',
      observedDays: 2,
      seenInPeriod: true,
    },
  ],
  coverage: `Fixture range ${days}`,
});

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const scenario of ['default', 'signed-out', 'empty', 'failure', 'loading']) {
      test(`${scenario} ${theme} ${width}px`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/?api=substitute&scenario=${scenario}`);
        await expect(page).toHaveTitle(
          ['failure', 'loading'].includes(scenario) ? 'Identity' : 'Identity | Shuneo',
        );
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(
          page.getByText('Substitute data · stays in this browser', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
        expect(
          await page
            .getByRole('link', { name: 'Skip to content' })
            .evaluate((node) => getComputedStyle(node).outlineStyle),
        ).not.toBe('none');
        const selectedUrl = page.url();
        await page.keyboard.press('Enter');
        await expect(page.locator('#main-content')).toBeFocused();
        expect(page.url()).toBe(selectedUrl);
        if (scenario === 'default') {
          await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
          await expect(page.getByRole('link', { name: /^Open service:/ })).toHaveCount(3);
          await expect(page.getByRole('heading', { name: 'Audience', exact: true })).toBeVisible();
          await expect(
            page.getByText('alex-nguyen/workspace-tools', { exact: true }),
          ).toBeVisible();
          await page.getByRole('button', { name: '7 days', exact: true }).click();
          await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          await expect(
            page.getByRole('figure', { name: 'New observed users per day' }),
          ).toBeVisible();
          await page.getByRole('button', { name: '90 days', exact: true }).click();
          await expect(page.getByRole('button', { name: '90 days', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
        } else if (scenario === 'signed-out') {
          await expect(page.getByRole('heading', { name: 'Welcome to Shuneo' })).toBeVisible();
          const href = await page
            .getByRole('link', { name: 'Continue with GitHub' })
            .getAttribute('href');
          const url = new URL(href);
          expect(url.origin).toBe(new URL(page.url()).origin);
          expect(url.pathname).toBe('/auth/login');
          expect(url.searchParams.get('returnUrl')).toBe(page.url());
          await expect(page.getByRole('heading', { name: 'Audience', exact: true })).toHaveCount(0);
        } else if (scenario === 'empty') {
          await expect(page.getByText('No services assigned', { exact: true })).toBeVisible();
          await expect(page.getByText('No authorizations observed', { exact: true })).toBeVisible();
          await expect(page.getByText('No repositories found', { exact: true })).toBeVisible();
        } else if (scenario === 'failure') {
          await expect(page.getByRole('alert')).toContainText('Unable to load your session');
          await page.getByRole('button', { name: 'Try again', exact: true }).click();
          await expect(page.getByRole('alert')).toBeVisible();
        } else
          await expect(page.getByRole('status', { name: 'Loading your workspace' })).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`${scenario}-${theme}-${width}.png`),
          fullPage: true,
        });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('live owner endpoints use credentials, client ID and all supported ranges', async ({
  page,
}) => {
  const calls = [];
  await page.route(`${identity}/api/**`, (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    if (url.pathname === '/api/session') return route.fulfill({ json: sampleSession });
    if (url.pathname === '/api/audience')
      return url.searchParams.get('clientId')
        ? route.fulfill({
            json: audience(url.searchParams.get('clientId'), url.searchParams.get('days')),
          })
        : route.fulfill({
            status: 400,
            json: { error: 'Specify clientId and a range of 7, 30 or 90 days.' },
          });
    return route.fulfill({
      json: {
        count: 1,
        repos: [
          {
            id: '1',
            name: 'tools',
            fullName: 'fixture-owner/tools',
            isPrivate: true,
            defaultBranch: 'main',
            htmlUrl: 'https://github.com/fixture-owner/tools',
            cloneUrl: null,
            pushedAt: null,
          },
        ],
      },
    });
  });
  await page.goto('/?api=live');
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'OAuth client ID' }).fill('configured client');
  await page.getByRole('button', { name: 'Load audience', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'fixture-user', exact: true })).toBeVisible();
  for (const days of [7, 90, 30]) {
    await page.getByRole('button', { name: `${days} days`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${days} days`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('cell', { name: 'fixture-user', exact: true })).toBeVisible();
    expect(calls).toContain(`/api/audience?clientId=configured+client&days=${days}`);
  }
  await expect(page.getByRole('link', { name: 'fixture-owner/tools' })).toHaveAttribute(
    'href',
    'https://github.com/fixture-owner/tools',
  );
  const logout = new URL(await page.getByRole('link', { name: 'Logout' }).getAttribute('href'));
  expect(logout.pathname).toBe('/auth/logout');
  expect(logout.origin).toBe(new URL(page.url()).origin);
  expect(logout.searchParams.get('returnUrl')).toBe(new URL('/', page.url()).href);
});

test('non-owners do not get owner analytics or substituted authentication', async ({ page }) => {
  await page.route(`${identity}/api/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session') return route.fulfill({ json: sampleSession });
    return route.fulfill({ status: path === '/api/audience' ? 403 : 401, body: '' });
  });
  await page.goto('/?api=auto');
  await expect(
    page.getByText('Reconnect GitHub to view repositories', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audience', exact: true })).toHaveCount(0);
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await expect(page.getByText('Fixture Owner', { exact: true }).first()).toBeVisible();
});

test.describe('Vietnamese system language', () => {
  test.use({ locale: 'vi-VN' });
  for (const width of [375, 1440])
    for (const theme of ['light', 'dark']) {
      test(`localized hub and sign-in ${theme} ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto('/?api=substitute');
        await expect(page).toHaveTitle('Danh tính | Shuneo');
        await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
        await expect(page.getByRole('heading', { name: 'Không gian của bạn' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Kho mã GitHub' })).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        await page.screenshot({
          path: info.outputPath(`hub-vi-${theme}-${width}.png`),
          fullPage: true,
        });
        await page.goto('/?api=substitute&scenario=signed-out');
        await expect(page.getByRole('link', { name: 'Tiếp tục với GitHub' })).toBeVisible();
        await page.screenshot({
          path: info.outputPath(`login-vi-${theme}-${width}.png`),
          fullPage: true,
        });
      });
    }
});

test('unreachable session uses explicitly labeled substitutes, then reconnects to live', async ({
  page,
}) => {
  await page.route(`${identity}/api/session`, (route) => route.abort('connectionrefused'));
  await page.goto('/?api=auto');
  await expect(
    page.getByText('Service unreachable · substitute data', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('alex-nguyen/workspace-tools', { exact: true })).toBeVisible();
  await page.unroute(`${identity}/api/session`);
  await page.route(`${identity}/api/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session') return route.fulfill({ json: sampleSession });
    return route.fulfill({ status: path === '/api/audience' ? 403 : 401, body: '' });
  });
  await page.getByRole('button', { name: 'Try live service' }).click();
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Reconnect GitHub to view repositories', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audience', exact: true })).toHaveCount(0);
  await expect(page.getByText('alex-nguyen/workspace-tools', { exact: true })).toHaveCount(0);
});

test('session permission failures are never substituted', async ({ page }) => {
  await page.route(`${identity}/api/session`, (route) => route.fulfill({ status: 403, body: '' }));
  await page.goto('/?api=auto');
  await expect(page.getByRole('alert')).toContainText('Unable to load your session');
  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toHaveCount(0);
});

test('original callback aliases and app path keep server-owned authentication', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { isAuthenticated: false, loginUrl: '/auth/login', apps: [] },
    }),
  );
  for (const key of ['returnUrl', 'callbackUrl']) {
    const target = 'https://mail.example.invalid/compose?draft=1&folder=sent';
    await page.goto(`/?api=live&${key}=${encodeURIComponent(target)}`);
    const login = page.getByRole('link', { name: 'Continue with GitHub' });
    await expect(login).toBeVisible();
    const url = new URL(await login.getAttribute('href'));
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('returnUrl')).toBe(target);
  }
  await page.goto('/apps?api=live');
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
});
