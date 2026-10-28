import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

for (const width of [375, 1440]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`VIN suggestions overlay without layout shifts at ${width}px in ${colorScheme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      let releaseInitial;
      const initialReady = new Promise(resolve => { releaseInitial = resolve; });
      await page.route('**/vehicles/identifiers?*', async route => {
        const query = new URL(route.request().url()).searchParams.get('query');
        if (!query) await initialReady;
        await route.fulfill({ json: query === 'ZZZ' ? [] : ['1HGCM82633A004352', '1HGCM82633A004360'] });
      });
      await page.goto('/');
      const input = page.getByRole('combobox');
      const button = page.getByRole('button', { name: 'Search VIN', exact: true });
      const hint = page.locator('#vin-hint');
      const bounds = async () => ({
        input: await input.boundingBox(),
        button: await button.boundingBox(),
        hint: await hint.boundingBox(),
        section: await page.locator('.search-section').boundingBox(),
      });
      const before = await bounds();
      await input.focus();
      await expect(page.getByRole('status')).toHaveText('Loading indexed VINs...');
      expect(await bounds()).toEqual(before);
      releaseInitial();
      await expect(page.getByRole('option')).toHaveCount(2);
      expect(await bounds()).toEqual(before);
      const popup = await page.locator('.vin-suggestions').boundingBox();
      expect(popup.y).toBeGreaterThanOrEqual(before.button.y + before.button.height);
      expect(popup.x).toBe(before.input.x);
      expect(popup.x + popup.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`suggestions-${width}-${colorScheme}.png`), fullPage: true });
      await input.fill('ZZZ');
      await expect(page.getByRole('status')).toHaveText('No matching indexed VINs');
      expect(await bounds()).toEqual(before);
      await input.press('Escape');
      await expect(page.locator('.vin-suggestions')).toHaveCount(0);
      expect(await bounds()).toEqual(before);
    });
  }
}