import { expect, test } from '@playwright/test';

const pages = {
  'productioncore-aids': ['/tools-w-productioncore-aids/', 'http://localhost:5311', 'dotnet run --project service'],
  disklens: ['/tools-w-disklens/', 'http://127.0.0.1:5274', 'dotnet run --project server --no-launch-profile'],
  'exploring-local': ['/tools-s-exploring-local/', 'http://localhost:5312', 'dotnet run --project service'],
};

test('Pages mount preserves assets and offline recovery instructions', async ({ page }, info) => {
  const configuration = pages[info.project.metadata.app];
  test.skip(!configuration, 'Only the three Pages bundle consumers have a subpath mount.');
  const [mount, origin, command] = configuration;
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async text => { window.copiedCode = text; } },
  }));
  await page.route(`${origin}/**`, route => route.abort('connectionrefused'));
  const assets = [];
  page.on('request', request => {
    if (/\.(js|css)(\?|$)/.test(request.url())) assets.push(new URL(request.url()).pathname);
  });
  await page.goto(mount);
  const guide = page.getByRole('region', { name: 'Connect your local service' });
  // section with an accessible name has an implicit region role.
  await expect(guide).toBeVisible();
  await expect(guide).toContainText(command);
  await expect(guide).toContainText('Do not disable browser security');
  await expect(guide.getByRole('button', { name: 'Retry connection' })).toBeVisible();
  await guide.getByRole('button', { name: 'Copy: shell', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.copiedCode)).toContain(command);
  await guide.getByRole('button', { name: 'Copy: URL', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.copiedCode)).toBe(origin);
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every(path => path.startsWith(mount))).toBe(true);
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`offline-${colorScheme}-${width}.png`), fullPage: true });
    }
  }
});

test('original Chess room path reaches the room view', async ({ page }, info) => {
  test.skip(info.project.metadata.app !== 'chinese-chess-lovers', 'Chess route compatibility.');
  await page.goto('/room/KH2A3B?api=substitute');
  await expect(page.getByRole('heading', { name: 'Khai cuộc pháo đầu' })).toBeVisible();
});

test('original Mail compose and message paths load their workflows', async ({ page }, info) => {
  test.skip(info.project.metadata.app !== 'mail', 'Mail route compatibility.');
  await page.goto('/compose?api=substitute');
  await expect(page.getByLabel('To', { exact: true })).toBeVisible();
  await page.goto('/message/42?folder=inbox&api=substitute');
  await expect(page.getByRole('heading', { name: 'A few notes from the design review' })).toBeVisible();
});
