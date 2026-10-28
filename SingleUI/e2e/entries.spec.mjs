import { expect, test } from '@playwright/test';
import { color, rgb } from '../scripts/palette.mjs';

const identities = {
  lingobridge: [
    'LingoBridge',
    'Keep meaning across languages.',
    'LingoBridge',
    'Giữ trọn ý nghĩa qua từng ngôn ngữ.',
  ],
  'chinese-chess-lovers': [
    'Chinese Chess Lovers',
    'Every move tells a story.',
    'Kỳ Hội',
    'Mỗi nước đi là một câu chuyện.',
  ],
  disklens: [
    'DiskLens',
    'See where your space goes.',
    'DiskLens',
    'Hiểu dung lượng được sử dụng ra sao.',
  ],
  'productioncore-aids': [
    'ProductionCore Aids',
    'Keep essential services in sight.',
    'ProductionCore Aids',
    'Theo dõi các dịch vụ thiết yếu.',
  ],
  'exploring-local': [
    'Exploring Local',
    'Find something worth stepping out for.',
    'Khám phá quanh đây',
    'Tìm một nơi đáng để bước ra ngoài.',
  ],
};

test.use({ locale: 'en-US' });

for (const width of [375, 768, 1440]) {
  test(`selected app only, shared style and system theme at ${width}px`, async ({ page }, info) => {
    const [title, heading] = identities[info.project.metadata.app];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByText('Entry preview', { exact: true })).toBeVisible();
    await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
    await expect(page.locator('nav, aside, select, button')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      /workspace|SingleUI|foundation|appearance/i,
    );
    await expect(page.locator('body')).not.toContainText('Explore cars in every dimension.');
    await expect(page.locator('html')).toHaveAttribute('data-emfc-theme', 'system');
    for (const [colorScheme, canvas, accent] of [
      ['light', rgb('light', 'canvas'), color('light', 'accent-hover')],
      ['dark', rgb('dark', 'canvas'), color('dark', 'accent-hover')],
    ]) {
      await page.emulateMedia({ colorScheme });
      await expect
        .poll(() => page.locator('html').evaluate((root) => getComputedStyle(root).backgroundColor))
        .toBe(canvas);
      expect(
        await page
          .locator('html')
          .evaluate((root) => getComputedStyle(root).getPropertyValue('--emfc-accent').trim()),
      ).toBe(accent);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`entry-${width}-${colorScheme}.png`),
        fullPage: true,
      });
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test('live system locale updates all entry copy and falls back explicitly', async ({
  page,
}, info) => {
  const [, , title, heading] = identities[info.project.metadata.app];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      get: () => ['fr-FR', 'vi-VN'],
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page).toHaveTitle(title);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  await expect(page.getByRole('link', { name: 'Chuyển đến nội dung' })).toBeAttached();
  await expect(page.locator('body')).not.toContainText(/Entry preview|Not connected|Designed for/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['fr-FR'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle(identities[info.project.metadata.app][0]);
  await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
});
