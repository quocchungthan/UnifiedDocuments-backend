import { expect } from '@playwright/test';
import { rgb } from '../scripts/palette.mjs';

export async function checkRenderedContrast(locator, minimum = 4.5, colorProperty = 'color') {
  const ratio = await locator.evaluate((element, property) => {
    const rgba = (color) => {
      const values = color.match(/[\d.]+/g).map(Number);
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const composite = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [
        ...front
          .slice(0, 3)
          .map((value, index) =>
            alpha ? (value * front[3] + back[index] * back[3] * (1 - front[3])) / alpha : 0,
          ),
        alpha,
      ];
    };
    const ancestors = [];
    for (
      let node = property === 'outlineColor' ? element.parentElement : element;
      node;
      node = node.parentElement
    )
      ancestors.push(node);
    let background = [0, 0, 0, 0];
    let foreground = rgba(getComputedStyle(element)[property]);
    if (property === 'outlineColor') foreground[3] *= Number(getComputedStyle(element).opacity);
    for (const node of ancestors) {
      const style = getComputedStyle(node);
      const surface = rgba(style.backgroundColor);
      background = composite(background, surface);
      foreground = composite(foreground, surface);
      background[3] *= Number(style.opacity);
      foreground[3] *= Number(style.opacity);
    }
    background = composite(background, [255, 255, 255, 1]);
    foreground = composite(foreground, [255, 255, 255, 1]);
    const luminance = (color) => {
      const linear = color
        .slice(0, 3)
        .map((value) =>
          value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4,
        );
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, colorProperty);
  expect(ratio).toBeGreaterThanOrEqual(minimum);
}

export async function checkButtonStates(page, action) {
  const background = () => action.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.mouse.move(0, 0);
  const normal = await background();
  await checkRenderedContrast(action);
  await action.hover();
  await expect.poll(background).not.toBe(normal);
  const hover = await background();
  await checkRenderedContrast(action);
  await page.mouse.down();
  await expect.poll(background).not.toBe(hover);
  await checkRenderedContrast(action);
  await page.mouse.move(page.viewportSize().width - 1, 0);
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await action.focus();
  await expect(action).toHaveCSS('outline-style', 'solid');
  await checkRenderedContrast(action, 3, 'outlineColor');
}

export async function checkPresentation(page, info, width, heading, path = '/') {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  await expect(page.locator('body')).not.toContainText(
    /workspace portal|appearance|Choose app|SingleUI framework/i,
  );
  await expect(page.locator('html')).toHaveAttribute('data-emfc-theme', 'system');
  await expect(page.locator('body')).toHaveCSS('font-family', /DM Sans/);
  if (await page.locator('canvas').count())
    await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  for (const [colorScheme, color] of [
    ['light', rgb('light', 'canvas')],
    ['dark', rgb('dark', 'canvas')],
  ]) {
    await page.emulateMedia({ colorScheme });
    await expect
      .poll(() => page.locator('html').evaluate((root) => getComputedStyle(root).backgroundColor))
      .toBe(color);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`${width}-${colorScheme}.png`), fullPage: true });
    const ratios = await page.locator('html').evaluate((root) => {
      const style = getComputedStyle(root);
      const luminance = (token) => {
        const probe = document.createElement('span');
        probe.style.color = style.getPropertyValue(token);
        root.append(probe);
        const values = getComputedStyle(probe).color.match(/\d+/g).slice(0, 3).map(Number);
        probe.remove();
        const linear = values.map((value) =>
          value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4,
        );
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      return [
        ['--emfc-ink', '--emfc-surface'],
        ['--emfc-muted', '--emfc-surface'],
        ['--emfc-on-accent', '--emfc-accent'],
      ].map(([a, b]) => {
        const left = luminance(a),
          right = luminance(b);
        return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
      });
    });
    ratios.forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5));
    const action = page
      .locator('button.button:visible:not(:disabled), button.primary-button:visible:not(:disabled)')
      .first();
    if (await action.count()) {
      await checkButtonStates(page, action);
    }
  }
  await page.locator('body').evaluate((body) => {
    body.tabIndex = -1;
    body.focus();
    body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  await expect(page.locator('a').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.setViewportSize({ width: 740, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width, height: 900 });
  expect(errors).toEqual([]);
}
