import { expect, test } from '@playwright/test';
test.use({ locale: 'en-US' });

async function screenshotVariants(page, info, name) {
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await page.screenshot({ path: info.outputPath(`${name}-${colorScheme}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
}

const scenarios = ['default', 'empty', 'failure', 'loading'];
for (const scenario of scenarios) {
  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      test(`PARA ${scenario} scenario · ${colorScheme} · ${width}px`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.goto(`/?api=substitute&scenario=${scenario}`);
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`api=substitute&scenario=${scenario}`));
        await expect(page.locator('#content')).toBeFocused();
        await expect(page.getByRole('heading', { name: 'PARA Bridge', exact: true })).toBeVisible();
        await expect(page.getByText('Substitute data · stays in this browser', { exact: true })).toBeVisible();
        if (scenario === 'default') {
          await expect(page.getByRole('button', { name: 'Review the sample interface', exact: false }).first()).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Agent office', exact: true })).toBeVisible();
          await expect(page.locator('header .status')).toHaveCount(0);
          await expect(page.locator('.office-metrics emfc-metric')).toHaveCount(4);
          const agentNodes = page.locator('bridge-network .node.agent');
          expect(await agentNodes.count()).toBeGreaterThan(2);
          for (const node of await agentNodes.all()) {
            expect(await node.innerText()).not.toMatch(/needs_human|workingStatus/);
            await expect(node).toHaveAccessibleName(/^Show only /);
          }
          await expect(page.getByRole('heading', { name: 'Activity log', exact: true })).toBeVisible();
          const nav = page.locator('.header nav');
          if (width === 375) expect(await nav.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
          const navButtons = page.locator('.header nav button');
          for (const button of await navButtons.all()) {
            await expect(button.locator('emfc-icon')).toBeVisible();
            await expect(button.locator('span').first()).toBeVisible();
          }
        } else if (scenario === 'empty') {
          await expect(page.getByRole('heading', { name: 'No sessions yet', exact: true })).toBeVisible();
        } else if (scenario === 'failure') {
          await expect(page.getByRole('alert')).toContainText('HTTP 500');
        } else {
          await expect(page.getByText('Loading substitute data', { exact: true })).toBeVisible();
          await expect(page.locator('emfc-service-status .spin')).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        await page.screenshot({ path: info.outputPath(`${scenario}-${colorScheme}-${width}.png`), fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('local session inspection, reply, task boards, agents and notifications stay in substitute mode', async ({ page }, info) => {
  await page.goto('/?api=substitute&scenario=default');
  await page.getByRole('button', { name: /^Open session · Review the sample interface/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Session details' });
  await expect(drawer).toContainText('Which sample journey');
  await expect(drawer).toContainText('copilot --allow-all --resume=demo-review');
  await expect(drawer).toContainText('no real agent log is inspected');
  await screenshotVariants(page, info, 'session-drawer');
  await expect(drawer.getByRole('button', { name: 'Send reply', exact: true })).toBeDisabled();
  await drawer.getByLabel('Your response').fill('Review the keyboard journey.');
  await drawer.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect(drawer).toContainText('No real agent received it');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team assignments', exact: true })).toBeVisible();
  await screenshotVariants(page, info, 'task-board');
  await page.getByRole('button', { name: /^Sessions/ }).click();
  await expect(page.getByRole('heading', { name: 'Work queue', exact: true })).toBeVisible();
  await screenshotVariants(page, info, 'session-board');
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  const reviewer = page.getByRole('button', { name: 'Show sessions for reviewer', exact: true });
  await expect(reviewer).toBeVisible();
  expect(await page.locator('bridge-agent-cards .agent-card').count()).toBeGreaterThan(2);
  await screenshotVariants(page, info, 'agents');
  await reviewer.click();
  await expect(page.getByRole('heading', { name: 'Work queue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await page.locator('.notice-row', { hasText: 'Review the sample interface' }).click();
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/view=sessions&session=demo-review/);
});

test('live service polling retries original Bridge endpoints and never fakes replies', async ({ page }) => {
  let online = false;
  const replies = [];
  const snapshot = {
    now: new Date().toISOString(), roles: ['Tester'], sessions: [{
      sessionId: 'live-1', agent: 'Tester', title: 'Live fixture', task: 'Test Bridge', state: 'needs_human', needs: [], attempts: 1, progress: [], question: 'Continue?',
    }], delegations: [], humanQueue: [], log: ['Fixture connected'], assignments: [],
  };
  await page.route('http://localhost:5310/**', (route) => {
    if (!online) return route.abort('connectionrefused');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/reply')) { replies.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); }
    if (path.endsWith('/inspect')) return route.fulfill({ json: { sessionId: 'live-1', available: true, diagnosis: 'Fixture inspection' } });
    return route.fulfill({ json: snapshot });
  });
  await page.goto('/?api=live');
  await expect(page.getByRole('heading', { name: 'Bridge is offline', exact: true })).toBeVisible();
  online = true;
  await page.getByRole('button', { name: 'Retry now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agent office', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Sessions/ }).click();
  await page.getByRole('button', { name: /Live fixture/ }).click();
  await page.getByLabel('Your response').fill('Continue with the fixture.');
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect.poll(() => replies).toEqual([{ message: 'Continue with the fixture.' }]);
  await expect(page.getByRole('dialog', { name: 'Session details' })).toContainText('Reply queued. The Bridge will deliver it to the session.');
});

test('system locale updates PARA navigation and source status', async ({ page }) => {
  await page.goto('/?api=substitute&scenario=default');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page).toHaveTitle('PARA Bridge · Trung tâm điều phối tác nhân');
  await expect(page.getByRole('button', { name: 'Sơ đồ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dịch vụ trực tiếp', exact: true })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('Bobby Singer chibi companion patrols PARA surfaces and only stops when clicked directly', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?api=substitute&scenario=default');
  await expect(page.locator('.header nav.animate-tabs')).toHaveAttribute('data-aui-tabs', 'ready');
  const bobby = page.locator('[data-hunter="bobby"]');
  await expect(bobby).toBeAttached();
  await expect(bobby).toHaveAttribute('data-staring', 'false');
  await page.mouse.move(420, 260);
  await page.locator('header h1').click();
  await expect(bobby).toHaveAttribute('data-staring', 'false');
  await bobby.click({ force: true });
  await expect(bobby).toHaveAttribute('data-pose', 'talk');
  await expect(bobby).toHaveAttribute('data-staring', 'true');
  const bubble = page.locator('[data-bubble-for="bobby"]');
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText('Bobby Singer');
  await page.emulateMedia({ colorScheme: 'light' });
  const lightBg = await bubble.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBg = await bubble.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkBg).not.toBe(lightBg);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: info.outputPath('bobby-companion.png') });
});
