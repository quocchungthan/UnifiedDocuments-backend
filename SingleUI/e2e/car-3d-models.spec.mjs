import { expect, test } from '@playwright/test';
import { color } from '../scripts/palette.mjs';
import { checkPresentation, checkRenderedContrast } from './presentation.mjs';
import { readFile } from 'node:fs/promises';
test.use({ locale: 'en-US' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('onboarding-test'))
      localStorage.setItem('30s.onboarding.v1', 'dismissed');
  });
});

for (const width of [375, 768, 1440]) {
  test(`workshop presentation at ${width}px`, async ({ page }, info) => {
    await checkPresentation(page, info, width, 'Know your machine.');
    await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
    const bounds = JSON.parse(await page.locator('canvas').getAttribute('data-model-bounds'));
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.bottom).toBeLessThanOrEqual(1);
    if (width <= 1000) {
      const canvas = await page.locator('canvas').boundingBox();
      const intro = await page.locator('.scene-intro').boundingBox();
      const caption = await page.locator('.vehicle-caption').boundingBox();
      expect(canvas.y + bounds.top * canvas.height).toBeGreaterThan(intro.y + intro.height);
      expect(canvas.y + bounds.bottom * canvas.height).toBeLessThan(caption.y);
    }
    await expect(
      page.getByRole('button', { name: 'Take a guided look', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Take a guided look', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Component details' })).toBeVisible();
    await page.getByRole('button', { name: 'Next tour part' }).click();
    await expect(page).toHaveURL(/part=lubrication/);
  });
}

test('car catalog, lesson references, field book and browser history', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Component index', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search components' }).fill('cooling');
  await page.locator('.part-row').click();
  await expect(page).toHaveURL(/car=raize&part=cooling/);
  await page.getByRole('button', { name: 'Isolate selection', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-isolated', 'true');
  await expect(page.locator('canvas')).toHaveAttribute('data-subject', 'cooling');
  await page.getByRole('button', { name: 'Show whole car', exact: true }).click();
  await page.getByRole('button', { name: 'Next lesson slide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A thoughtful check' })).toBeVisible();
  await page.getByRole('tab', { name: 'References', exact: true }).click();
  await expect(page.locator('.reference-photo img').first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.reference-photo img')
        .first()
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator('.reference-photo figcaption').first()).toContainText(
    /CC|Creative Commons/,
  );
  await page.getByRole('tab', { name: 'Field book', exact: true }).click();
  const book = page.locator('emfc-markdown.field-book');
  await expect(book.getByRole('heading', { name: 'Toyota Raize — a field book' })).toBeVisible();
  await expect(book.getByRole('heading', { name: 'Start with the right car' })).toBeVisible();
  await expect(book.locator('strong').first()).toHaveText('Learning configuration:');
  await expect(book.getByRole('link', { name: 'Find the engine in 3D' })).toHaveAttribute(
    'href',
    '/?car=raize&part=engine',
  );
  const bookTab = page.getByRole('tab', { name: 'Field book', exact: true });
  await expect(bookTab).toHaveAttribute('aria-selected', 'true');
  await expect(bookTab).toHaveCSS('border-bottom-style', 'solid');
  await expect(bookTab).toHaveCSS('border-bottom-width', '2px');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await page.locator('.detail-panel').evaluate((panel) => {
        panel.scrollTop = 0;
      });
      await checkRenderedContrast(bookTab);
      await page.screenshot({ path: info.outputPath(`field-book-${width}-${colorScheme}.png`) });
    }
  }
  await bookTab.press('Home');
  await expect(page.getByRole('tab', { name: 'Learn', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Learn', exact: true }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'References', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'lesson-tab-references',
  );
  await page.getByLabel('Choose car model').selectOption('impala');
  await expect(page).toHaveURL(/car=impala$/);
  await page.goBack();
  await expect(page.getByLabel('Choose car model')).toHaveValue('raize');
  await expect(page).toHaveURL(/part=cooling/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.detail-panel')).toHaveCount(0);
});

test('scene controls, PNG capture, safe troubleshooting and persistent observations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  for (const mode of ['X-ray', 'Exploded', 'Exterior']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('canvas')).toHaveAttribute(
      'data-mode',
      mode === 'X-ray' ? 'xray' : mode.toLowerCase(),
    );
  }
  await page.getByRole('button', { name: 'Open hood and doors' }).click();
  await expect(page.getByRole('button', { name: 'Open hood and doors' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('canvas')).toHaveAttribute('data-open', 'true');
  const before = await page.locator('canvas').getAttribute('data-camera-position');
  await page.getByRole('button', { name: 'Rotate camera left', exact: true }).click();
  await expect(page.locator('canvas')).not.toHaveAttribute('data-camera-position', before);
  for (const name of [
    'Rotate camera left',
    'Rotate camera right',
    'Zoom in',
    'Zoom out',
    'Reset camera',
  ])
    await page.getByRole('button', { name, exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Capture schematic image' }).click();
  const image = await download;
  expect(image.suggestedFilename()).toBe('30s-raize-schematic.png');
  const bytes = await readFile(await image.path());
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.length).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Troubleshoot wiper streaks', exact: true }).click();
  await page
    .getByRole('button', { name: 'Cannot safely inspect or see clearly to drive', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: /^Stop:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add this check to the observation log' }).click();
  await page.getByRole('button', { name: 'Observation log', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Observation log' })).toContainText(
    'Cannot safely inspect',
  );
  await page
    .getByLabel('What did you observe?')
    .fill('Parked test: streaks on the passenger side.');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Observation log', exact: true }).click();
  await expect(page.locator('car-log-panel')).toContainText(
    'Parked test: streaks on the passenger side.',
  );
});

test('live browser locale updates typed workshop copy and title', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      get: () => ['fr', 'vi-VN'],
    });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hiểu chiếc xe của bạn.');
  await expect(page).toHaveTitle('30s — Mô hình ô tô 3D');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('portable CSS adapters follow system appearance without scripts', async ({ page }) => {
  for (const [file, variable] of [
    ['seafile', '--primary-color'],
    ['affine', '--affine-brand-color'],
  ]) {
    await page.goto('/');
    await page.setContent(
      '<!doctype html><html><head></head><body><button>Host control</button></body></html>',
    );
    await page.addStyleTag({ path: `dist-ui/${file}-candidate.css` });
    for (const [colorScheme, expected] of [
      ['light', color('light', 'accent-hover')],
      ['dark', color('dark', 'accent-hover')],
    ]) {
      await page.emulateMedia({ colorScheme });
      await expect
        .poll(() =>
          page
            .locator('html')
            .evaluate(
              (root, name) => getComputedStyle(root).getPropertyValue(name).trim(),
              variable,
            ),
        )
        .toBe(expected);
    }
  }
});

test('shared controls retain contrast and distinct interaction states in both palettes', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.setContent(`<!doctype html><html><head></head><body style="margin:32px;background:var(--emfc-canvas);color:var(--emfc-ink);font-family:var(--font-sans)">
    <main class="panel card stack">
      <h1>Shared control states</h1>
      <button class="button">Primary action</button>
      <button class="button button--secondary">Secondary action</button>
      <button class="icon-button" aria-label="More actions">...</button>
      <div class="segmented"><button aria-pressed="true">Selected</button><button aria-pressed="false">Other view</button></div>
      <input class="input" aria-label="Example input" value="Readable content">
      <button class="button" disabled>Unavailable action</button>
      <p class="notice" role="alert">Action needs attention</p>
    </main>
  </body></html>`);
  await page.addStyleTag({ path: 'dist-ui/emfc-ui.css' });
  // Color states are asserted immediately; motion is covered separately.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  const background = (control) =>
    control.evaluate((element) => getComputedStyle(element).backgroundColor);
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const name of ['Primary action', 'Secondary action', 'More actions', 'Other view']) {
      const control = page.getByRole('button', { name, exact: true });
      await page.mouse.move(0, 0);
      const normal = await background(control);
      await checkRenderedContrast(control);
      await control.hover();
      expect(await background(control)).not.toBe(normal);
      await checkRenderedContrast(control);
      await page.mouse.down();
      await checkRenderedContrast(control);
      if (name === 'Primary action' || name === 'Secondary action')
        expect(await background(control)).not.toBe(normal);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.keyboard.press('Tab');
      await control.focus();
      await expect(control).toHaveCSS('outline-style', 'solid');
      await checkRenderedContrast(control, 3, 'outlineColor');
    }
    await checkRenderedContrast(page.getByRole('button', { name: 'Selected', exact: true }));
    const input = page.getByRole('textbox');
    await checkRenderedContrast(input);
    await checkRenderedContrast(input, 3, 'borderTopColor');
    await input.focus();
    await checkRenderedContrast(input, 3, 'outlineColor');
    await expect(page.getByRole('button', { name: 'Unavailable action' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Unavailable action' })).toHaveCSS(
      'opacity',
      '0.5',
    );
    await checkRenderedContrast(page.getByRole('alert'));
    await page.screenshot({ path: info.outputPath(`controls-${colorScheme}.png`) });
  }
});

test('first visit, replay, nested engine study, occurrence isolation and public question preview', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('onboarding-test', 'true');
    localStorage.removeItem('30s.onboarding.v1');
  });
  await page.reload();
  const introduction = page.getByRole('dialog', { name: 'Welcome to 30s' });
  await expect(introduction).toBeVisible();
  await expect(page.locator('#introduction-title')).toBeFocused();
  for (let step = 0; step < 3; step++)
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Workshop help', exact: true }).click();
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(introduction).toBeVisible();
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Replay introduction', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Component index', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search components' }).fill('piston');
  await page
    .locator('.part-row')
    .filter({ hasText: /^Piston/ })
    .click();
  await expect(page).toHaveURL(/item=engine-piston-study/);
  const details = page.getByRole('complementary', { name: 'Component details' });
  await expect(details).toContainText(/Piston/);
  await details.getByRole('button', { name: 'Focus selection', exact: true }).click();
  await details.getByRole('button', { name: 'Isolate selection', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-subject', 'engine-piston-study');
  await expect(page.locator('canvas')).toHaveAttribute('data-isolated', 'true');
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-triangles')))
    .toBeGreaterThan(0);
  await page.evaluate(() =>
    localStorage.setItem(
      'emfc.30s.observations',
      JSON.stringify([
        { id: 'private', car: 'raize', text: 'PRIVATE-OBSERVATION', at: new Date().toISOString() },
      ]),
    ),
  );
  await details.getByRole('button', { name: 'Ask ChatGPT about this component' }).click();
  const question = page.getByRole('dialog', { name: 'Ask about this component', exact: true });
  await expect(question.getByRole('textbox')).not.toHaveValue(/PRIVATE-OBSERVATION/);
  await expect(question.getByRole('link', { name: 'Open ChatGPT (external)' })).toHaveAttribute(
    'href',
    /chatgpt\.com\/\?q=/,
  );
  await page.keyboard.press('Escape');
  await expect(details).toBeVisible();
  await page.goto('/?car=raize&part=body&item=wiper-rubber-left');
  await page.getByRole('button', { name: 'Isolate selection', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-subject', 'wiper-rubber-left');
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-triangles')))
    .toBeGreaterThan(0);
  await page.goto('/?car=raize&item=powertrain-assembly');
  await expect(details).toContainText('Powertrain system');
  await details.getByRole('button', { name: 'Engine', exact: true }).click();
  await expect(page).toHaveURL(/part=engine/);
});
