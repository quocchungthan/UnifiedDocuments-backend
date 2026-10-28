import { expect, test } from '@playwright/test';
import { checkPresentation, checkRenderedContrast } from './presentation.mjs';
test.use({ locale: 'en-US' });

const emptyPortfolio = {
  '/api/portfolio/projects': [],
  '/api/portfolio/profile-projects': [],
  '/api/portfolio/skills': [],
  '/api/portfolio/experiences': [],
  '/api/feeds': [],
  '/api/tools': [],
  '/api/feeds/clicks': [],
  '/api/metadata': {
    developerName: 'Fixture Farm',
    title: 'Native metadata',
    description: 'Native description',
  },
  '/api/portfolio/profiles': [],
  '/api/portfolio/social-links': [],
  '/api/portfolio/profile-skills': [],
  '/api/portfolio/project-skills': [],
  '/api/portfolio/gigs': [],
};

test.describe('mobile layout viewport', () => {
  test.use({ isMobile: true });
  for (const width of [375, 768, 820, 1024]) {
    test(`long table content stays within the ${width}px viewport`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1024 });
      const description =
        'A detailed integration description that should wrap inside its row header instead of widening the mobile layout viewport. '.repeat(
          3,
        );
      const payloads = {
        ...emptyPortfolio,
        '/api/metadata': {
          developerName: 'Fixture Farm',
          title: 'Responsive portfolio',
          description: 'https://example.com/' + 'long-path-segment/'.repeat(12),
        },
        '/api/portfolio/experiences': [
          {
            id: 1,
            company: 'Example engineering company',
            jobTitle: 'Software engineer',
            description: 'A multiline role description.\n\nWith additional responsibilities.',
            startDate: '2024-01-01',
            endDate: null,
            isCurrent: true,
            displayOrder: 1,
          },
        ],
        '/api/tools': [
          {
            id: 1,
            name: 'Fixture integration',
            description,
            category: 'ObserveWatching',
            directUrl: 'https://example.com/tool/',
            repositoryUrl: '',
            issueUrl: '',
            displayOrder: 1,
          },
        ],
        '/api/me': {
          isAuthenticated: false,
          signInAvailable: true,
          subject: null,
          name: null,
          username: null,
          picture: null,
          email: null,
        },
      };
      await page.route('**/api/**', (route) =>
        route.fulfill({ json: payloads[new URL(route.request().url()).pathname] }),
      );
      await page.goto('/');
      await expect(page.getByRole('rowheader', { name: /Fixture integration/ })).toBeVisible();
      const code = page.locator('farm-api-probe').first().locator('pre');
      const wrap = page
        .locator('farm-api-probe')
        .first()
        .getByRole('button', { name: 'Wrap long lines: /api/metadata', exact: true });
      await expect(wrap).toHaveAttribute('aria-pressed', 'true');
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        await expect
          .poll(() =>
            page.evaluate(() => ({
              layout: innerWidth,
              scroll: document.documentElement.scrollWidth,
            })),
          )
          .toEqual({ layout: width, scroll: width });
        await expect(page.locator('#experience tbody td').first()).toHaveCSS(
          'vertical-align',
          'top',
        );
        await expect(page.locator('#overview emfc-metric').first()).toHaveCSS(
          'align-content',
          'start',
        );
        expect(
          await code.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true);
        await checkRenderedContrast(wrap);
        await wrap.click();
        await expect(wrap).toHaveAttribute('aria-pressed', 'false');
        expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await wrap.click();
        await expect(wrap).toHaveAttribute('aria-pressed', 'true');
        await page.evaluate(() => window.scrollTo(1000, 0));
        expect(await page.evaluate(() => scrollX)).toBe(0);
        await page.screenshot({
          path: info.outputPath(`mobile-content-${colorScheme}-${width}.png`),
          fullPage: true,
        });
      }
    });
  }
});

for (const width of [375, 768, 820, 1024, 1440]) {
  test(`portfolio presentation at ${width}px`, async ({ page }, info) => {
    await checkPresentation(
      page,
      info,
      width,
      'Elder Vibe Coder',
      '/?api=substitute&scenario=signed-out',
    );
    const sections = page.getByRole('navigation', { name: 'Page sections' }).getByRole('link');
    await expect(sections).toHaveCount(8);
    await sections.filter({ hasText: 'Projects' }).click();
    await expect(page.locator('#projects')).toBeInViewport();
    await expect(sections.filter({ hasText: 'Projects' })).toHaveAttribute('aria-current', 'true');
    if (width <= 1100) {
      const nav = page.getByRole('navigation', { name: 'Page sections' });
      expect((await nav.boundingBox()).height).toBeLessThan(80);
      await expect(nav).toHaveCSS('position', 'sticky');
      expect((await page.locator('#projects').boundingBox()).y).toBeGreaterThanOrEqual(
        (await nav.boundingBox()).height,
      );
    }
  });
}

test('static host falls back to labelled substitute data in auto mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Preview data · service unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try live service', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use substitute data', exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('#projects')).toContainText('30s · Car 3D Models');
  await expect(
    page.getByRole('navigation', { name: 'Page sections' }).getByRole('link'),
  ).toHaveCount(9);
});

test('substitute API console, activity tracking and explicit tool health failure', async ({
  page,
}) => {
  await page.route('https://quocchungthan.github.io/para-bridge/**', (route) =>
    route.abort('connectionrefused'),
  );
  await page.goto('/?api=substitute');
  await expect(
    page.getByText('Substitute data · stays in this browser', { exact: true }),
  ).toBeVisible();
  const probe = page.locator('farm-api-probe').first();
  await expect(probe).toContainText('no HTTP request');
  await probe.getByRole('button', { name: 'Send request /api/metadata', exact: true }).click();
  await expect(probe).toContainText('no HTTP request');
  const github = page.locator('#sources li').filter({ hasText: 'GitHub' });
  const before = Number((await github.locator('small').textContent()).match(/(\d+) visits/)[1]);
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open GitHub', exact: true }).click();
  await (await popup).close();
  await expect(github).toContainText(`${before + 1} visits`);
  await page.getByRole('button', { name: 'Check health: PARA Bridge', exact: true }).click();
  await expect(page.locator('#tools tbody tr').first()).toContainText('Offline');
  await page.route('**/api/portfolio/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.getByRole('button', { name: 'Try live service', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('farm service unavailable');
  await page.getByRole('button', { name: 'Use substitute data', exact: true }).click();
  await expect(page.locator('#projects')).toContainText('30s · Car 3D Models');
});

for (const scenario of ['empty', 'failure', 'loading']) {
  test(`substitute ${scenario} scenario renders an explicit state`, async ({ page }) => {
    await page.goto(`/?api=substitute&scenario=${scenario}`);
    if (scenario === 'empty') await expect(page.getByText('No projects yet')).toBeVisible();
    if (scenario === 'failure')
      await expect(page.getByRole('alert').first()).toContainText('HTTP 500');
    if (scenario === 'loading')
      await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('live service loads original endpoint contracts, renders metrics and tracks visits', async ({
  page,
}, info) => {
  const payloads = {
    ...emptyPortfolio,
    '/api/portfolio/projects': [
      { id: 1, title: 'Contract fixture', slug: 'fixture', summary: 'From the test server' },
    ],
    '/api/feeds': [
      {
        id: 1,
        platform: 'Fixture',
        platformId: 'fixture',
        url: 'https://example.com/',
        description: 'Test source',
        color: '',
        displayOrder: 1,
      },
    ],
    '/api/feeds/clicks': [{ platform: 'Fixture', day: '2026-10-22', count: 2 }],
    '/api/portfolio/profiles': [
      {
        id: 7,
        displayName: 'Native profile',
        headline: 'Backend headline',
        bio: '**Backend biography**',
        location: 'Public location',
        resumeUrl: '',
      },
    ],
    '/api/portfolio/social-links': [
      {
        id: 8,
        profileId: 7,
        label: 'Native email',
        url: 'mailto:owner@example.invalid',
        displayOrder: 1,
      },
    ],
    '/api/portfolio/skills': [{ id: 9, name: 'Native skill', category: 'Engineering' }],
    '/api/portfolio/profile-skills': [{ profileId: 7, skillId: 9, displayOrder: 1 }],
    '/api/portfolio/project-skills': [{ projectId: 1, skillId: 9 }],
    '/api/portfolio/gigs': [
      {
        id: 31,
        title: 'Persisted Case File',
        slug: 'persisted-case-file',
        category: 'Engineering',
        summary: 'Loaded from the live API response.',
        problem: 'The reported problem.',
        outcome: 'The measured outcome.',
        solvedOn: '2026-10-20',
        displayOrder: 1,
        steps: [{ id: 41, stepNumber: 1, title: 'Investigate', description: 'Trace the issue.' }],
        skills: [{ id: 51, name: 'TypeScript' }],
      },
    ],
    '/api/tools': [
      {
        id: 10,
        name: 'Native tool',
        description: '',
        category: 'ObserveWatching',
        directUrl: 'https://example.com/tool/',
        repositoryUrl: '',
        issueUrl: '',
        displayOrder: 1,
      },
    ],
    '/api/metadata': {
      developerName: 'Fixture Farm',
      title: 'Native metadata',
      description: 'Native description',
    },
    '/api/me': {
      isAuthenticated: false,
      signInAvailable: false,
      subject: null,
      name: null,
      username: null,
      picture: null,
      email: null,
    },
  };
  const posts = [];
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      posts.push(path);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: payloads[path],
      headers: {
        'X-Total-Requests': '12',
        'X-Unique-Clients': '3',
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '58',
      },
    });
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Elder Vibe Coder');
  await expect(page.locator('emfc-service-status')).toBeEmpty();
  await expect(page.locator('#projects')).toContainText('Contract fixture');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#overview emfc-metric')).toHaveCount(4);
  await expect(page.locator('#overview')).not.toContainText('Backend headline');
  await expect(page.locator('#overview .profile-card, #overview emfc-markdown')).toHaveCount(0);
  await expect(page.locator('#overview emfc-heat-strip')).toHaveCount(1);
  await expect(page.locator('#projects .chip')).toHaveText('Native skill');
  await expect(page.locator('#cases table.table--stack')).toBeVisible();
  await expect(page.locator('#cases .panel .panel')).toHaveCount(0);
  await expect(page.locator('#cases')).toContainText('#31');
  await expect(page.locator('#cases')).toContainText('Persisted Case File');
  await expect(page.locator('#cases')).toContainText('Trace the issue.');
  await expect(page.locator('#cases')).toContainText('2026-10-20');
  await expect(page.locator('#cases .chip')).toHaveText('TypeScript');
  await expect(page.locator('#cases')).not.toContainText('Network spikes in the server room');
  await expect(page.locator('#overview a')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open: Native tool', exact: true })).toHaveAttribute(
    'href',
    'https://example.com/tool/',
  );
  await expect(page.locator('farm-api-probe').first()).toContainText('Requests 12');
  const feed = page.locator('farm-api-probe').filter({ hasText: '/api/feeds' }).first().locator('pre');
  await expect(feed).not.toContainText(/displayOrder|platformId|"color"/);
  await expect(feed).toContainText('https://example.com/');
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open Fixture', exact: true }).click();
  await (await popup).close();
  await expect.poll(() => posts).toEqual(['/api/feeds/Fixture/click']);
  for (const width of [375, 820, 1024, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`production-${colorScheme}-${width}.png`),
        fullPage: true,
      });
      const nav = page.getByRole('navigation', { name: 'Page sections' });
      await nav.getByRole('link', { name: 'Projects', exact: true }).click();
      const selected = nav.getByRole('link', { name: 'Projects', exact: true });
      await checkRenderedContrast(selected);
      await selected.focus();
      await checkRenderedContrast(selected, 3, 'outlineColor');
      if (width <= 1100) {
        expect((await nav.boundingBox()).height).toBeLessThan(80);
        await page.screenshot({
          path: info.outputPath(`production-scrolled-${colorScheme}-${width}.png`),
        });
      }
    }
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page.getByRole('heading', { name: 'Hồ sơ vụ việc', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await page.getByRole('navigation', { name: 'Các phần của trang' }).boundingBox()).height,
  ).toBeLessThan(100);
});

test('live empty gigs render no fabricated Case Files', async ({ page }, info) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me')
      return route.fulfill({
        json: {
          isAuthenticated: false,
          signInAvailable: false,
          subject: null,
          name: null,
          username: null,
          picture: null,
          email: null,
        },
      });
    return path in emptyPortfolio
      ? route.fulfill({ json: emptyPortfolio[path] })
      : route.fulfill({ status: 404, body: 'No fixture for endpoint' });
  });

  await page.goto('/?api=live');

  await expect(page.getByText('Live service', { exact: true })).toBeVisible();
  await expect(page.locator('#cases')).toContainText('No case files found');
  await expect(page.locator('#cases')).not.toContainText('Network spikes in the server room');
  await expect(page.locator('#cases')).not.toContainText('Inconsistent build checksums in CI/CD');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath('live-empty-case-files.png'), fullPage: true });
});

test('browser language localizes portfolio controls automatically', async ({ page }) => {
  await page.goto('/?api=substitute');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });

  await expect(page.getByRole('button', { name: 'Thử dịch vụ trực tiếp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kinh nghiệm', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('API diagnostics, linked JSON, Markdown content and business launch URLs', async ({
  page,
}, info) => {
  await page.clock.install();
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          window.copiedCode = text;
        },
      },
    }),
  );
  const sourceUrl = 'https://github.com/example/source';
  const launchUrl = 'https://example.com/launch/';
  const markdown =
    '**Readable detail** with [documentation](https://example.com/docs)\n\n- First point\n- Second point\n\n```sh\ndotnet run --project fixture\n```\n\n<script>window.injected=true</script>';
  const payloads = {
    ...emptyPortfolio,
    '/api/metadata': {
      ...emptyPortfolio['/api/metadata'],
      repositoryUrl: sourceUrl,
      specifiedIssueUrl: 'https://example.com/issues/1',
    },
    '/api/portfolio/projects': [
      {
        id: 10,
        title: 'Markdown project',
        slug: 'markdown',
        summary: 'Summary with [guide](https://example.com/guide)',
        description: markdown,
      },
      { id: 13, title: 'Featured first', slug: 'featured', summary: 'Featured study' },
    ],
    '/api/portfolio/profile-projects': [
      { profileId: 1, projectId: 10, isFeatured: false, displayOrder: 0 },
      { profileId: 2, projectId: 13, isFeatured: true, displayOrder: 10 },
    ],
    '/api/feeds': ['TikTok', 'Facebook', 'Instagram', 'Azure DevOps', 'Gmail'].map(
      (platform, index) => ({
        id: index,
        platform,
        platformId: platform.toLowerCase(),
        url: 'https://example.com/',
        description: 'Work source',
        color: '',
        displayOrder: index,
      }),
    ),
    '/api/portfolio/experiences': [
      {
        id: 11,
        company: 'Fixture company',
        jobTitle: 'Engineer',
        description: markdown,
        startDate: '2025-01-01',
        isCurrent: true,
        displayOrder: 1,
      },
    ],
    '/api/tools': [
      {
        id: 12,
        name: 'Fixture tool',
        description: 'Launch the product',
        category: 'ObserveWatching',
        directUrl: launchUrl,
        repositoryUrl: sourceUrl,
        displayOrder: 1,
      },
    ],
    '/api/me': {
      isAuthenticated: false,
      signInAvailable: false,
      subject: null,
      name: null,
      username: null,
      picture: null,
      email: null,
    },
  };
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: payloads[new URL(route.request().url()).pathname],
      headers: {
        'X-Total-Requests': '443',
        'X-Unique-Clients': '30',
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '58',
        'X-RateLimit-Reset': '60',
      },
    }),
  );
  await page.goto('/?api=live');
  const probe = page.locator('farm-api-probe').first();
  await expect(probe).toContainText('GET');
  await expect(probe).toContainText('200');
  await expect(probe).toContainText('Requests 443');
  await expect(probe).toContainText('Clients 30');
  await expect(probe).toContainText('58/60 left');
  await expect(probe).toContainText('60 seconds to reset');
  await expect(probe.locator('pre a')).toHaveAttribute('href', sourceUrl);
  const { developerName, specifiedIssueUrl, ...displayMetadata } = payloads['/api/metadata'];
  await expect(probe.locator('pre')).toHaveText(JSON.stringify(displayMetadata, null, 2));
  await expect(probe).not.toContainText('Response for');
  await expect(probe.locator('time')).toHaveText('now');
  await expect(probe.locator('time')).toHaveAttribute('datetime', /T/);
  await expect(page.locator('#api emfc-panel > section')).not.toHaveClass(/\bpanel\b/);
  await expect(page.locator('#api farm-api-probe > article.panel')).toHaveCount(2);
  await expect(page.locator('#overview emfc-panel > section.panel')).toHaveCount(1);
  await expect(page.locator('#skills emfc-panel > section.panel')).toHaveCount(1);
  await expect(page.locator('#projects .panel .panel')).toHaveCount(0);
  await expect(page.locator('#projects h3').first()).toHaveText('Featured first');
  await expect(page.locator('#projects h3').first()).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('heading', { name: 'Case files', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Case files', exact: true })).toBeVisible();
  await expect(page.locator('#sources .avatar svg path[fill="currentColor"]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Services', exact: true }).click();
  await expect(page.getByRole('link', { name: /Plan B in my 30s/ })).toHaveAttribute(
    'href',
    'https://30s.eldervibe.dev',
  );
  await page.getByRole('button', { name: 'Services', exact: true }).click();
  for (const id of ['projects', 'experience']) {
    await expect(page.locator(`#${id} emfc-markdown strong`)).toHaveText('Readable detail');
    await expect(page.locator(`#${id} emfc-markdown li`)).toHaveCount(2);
    await expect(
      page.locator(`#${id}`).getByRole('link', { name: 'documentation' }),
    ).toHaveAttribute('href', 'https://example.com/docs');
    await page
      .locator(`#${id} emfc-markdown`)
      .getByRole('button', { name: 'Copy: sh', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.copiedCode))
      .toBe('dotnet run --project fixture\n');
  }
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.getByRole('link', { name: 'Open: Fixture tool', exact: true })).toHaveAttribute(
    'href',
    launchUrl,
  );
  await page.clock.fastForward(65_000);
  await expect(probe.locator('time')).toContainText('1 min. ago');
  for (const width of [375, 820, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const code = probe.locator('pre');
      const cardBackground = await probe
        .locator('article')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      const codeBackground = await code.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      expect(codeBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(codeBackground).not.toBe(cardBackground);
      if (colorScheme === 'dark') {
        const brightness = (color) =>
          color
            .match(/\d+/g)
            .slice(0, 3)
            .map(Number)
            .reduce((a, b) => a + b);
        expect(brightness(codeBackground)).toBeLessThan(brightness(cardBackground));
      }
      const lineCount = JSON.stringify(displayMetadata, null, 2).split('\n').length;
      await expect(code.locator('.line-number')).toHaveCount(lineCount);
      await expect(code.locator('.line-number').last()).toHaveAttribute(
        'data-line',
        String(lineCount),
      );
      const lineHeights = await code.locator('.code-line').evaluateAll((lines) =>
        lines.map((line) => ({
          row: line.getBoundingClientRect().height,
          gutter: line.querySelector('.line-number').getBoundingClientRect().height,
        })),
      );
      expect(lineHeights.every(({ row, gutter }) => row === gutter)).toBe(true);
      await checkRenderedContrast(code.locator('.line-number').first());
      const selectedText = await code.locator('code').evaluate((element) => {
        const selection = getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        const text = selection.toString();
        selection.removeAllRanges();
        return text;
      });
      expect(selectedText).toBe(JSON.stringify(displayMetadata, null, 2));
      await checkRenderedContrast(code);
      await checkRenderedContrast(code.locator('a'));
      await code.focus();
      await checkRenderedContrast(code, 3, 'outlineColor');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`markdown-diagnostics-${colorScheme}-${width}.png`),
        fullPage: true,
      });
    }
  }
});

test('account connection, owner analytics, one-time client configuration and key revocation', async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          window.copiedCode = text;
        },
      },
    }),
  );
  const today = new Date().toISOString().slice(0, 10);
  let keys = [
    {
      id: 'laptop',
      name: 'Laptop agent',
      preview: 'test-…4f2a',
      createdAt: '2026-09-12T09:12:00Z',
      lastUsedAt: '2026-10-23T07:45:00Z',
    },
    {
      id: 'ci',
      name: 'CI pipeline',
      preview: 'test-…91c0',
      createdAt: '2026-10-01T15:30:00Z',
      lastUsedAt: null,
    },
  ];
  const requests = [];
  await page.route('**/api/**', (route) => {
    const request = route.request(),
      url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (url.pathname === '/api/me')
      return route.fulfill({
        json: {
          isAuthenticated: true,
          signInAvailable: true,
          subject: 'fixture',
          name: 'Fixture Owner',
          username: 'fixture',
          picture: null,
          email: null,
        },
      });
    if (url.pathname === '/api/dashboard')
      return route.fulfill({
        json: {
          source: 'demo',
          currency: 'USD',
          days: Number(url.searchParams.get('days')),
          from: today,
          through: today,
          isOwner: true,
          tasks: [
            {
              id: 'demo-task',
              date: today,
              name: 'Fixture demo task',
              model: 'Example model',
              inputTokens: 100,
              outputTokens: 50,
              durationSeconds: 90,
              inputBytes: 200,
              outputBytes: 300,
              costUsd: 1,
              feeUsd: 0.2,
              baselineCostUsd: 3,
            },
          ],
          audience: { source: 'fences', url: `${url.origin}/api/audience` },
        },
      });
    if (url.pathname === '/api/audience')
      return route.fulfill({
        json: {
          source: 'fences',
          totalUsers: 1,
          newUsers: 1,
          returningUsers: 0,
          growth: [{ date: today, users: 1 }],
          users: [
            {
              subject: 'fixture',
              username: 'Fixture Owner',
              firstSeen: today,
              lastSeen: today,
              observedDays: 1,
            },
          ],
          coverage: 'Fixture owner-only coverage.',
        },
      });
    if (url.pathname === '/api/memory/usage')
      return route.fulfill({ json: [{ date: today, readBytes: 1234, writeBytes: 56 }] });
    if (url.pathname === '/api/memory/keys' && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({ name: 'Test assistant' });
      keys = [
        ...keys,
        {
          id: 'fixture-key',
          name: 'Test assistant',
          preview: 'test-…fake',
          createdAt: today,
          lastUsedAt: null,
        },
      ];
      return route.fulfill({ json: { secret: 'TEST-ONLY-NOT-A-REAL-SECRET' } });
    }
    if (request.method() === 'DELETE') {
      keys = keys.filter((key) => !url.pathname.endsWith(`/${key.id}`));
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === '/api/memory/keys') return route.fulfill({ json: keys });
    if (url.pathname in emptyPortfolio)
      return route.fulfill({ json: emptyPortfolio[url.pathname] });
    return route.fulfill({ status: 404, body: 'No fixture for endpoint' });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Usage & savings', exact: true })).toBeVisible();
  await expect(
    page.getByText('Demo data - not your actual usage or bill.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /Fixture demo task/ })).toBeVisible();
  await expect(page.getByText('Fixture owner-only coverage.', { exact: true })).toBeVisible();
  await page.getByLabel('Time range', { exact: true }).first().selectOption('7');
  await expect.poll(() => requests.includes('GET /api/dashboard?days=7')).toBe(true);
  await page.getByRole('link', { name: 'Connect your AI', exact: true }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await page.getByRole('button', { name: 'Copy: MCP endpoint', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.copiedCode))
    .toBe(new URL('/mcp', page.url()).href);
  await page
    .getByRole('button', { name: 'Copy: Make your AI use it automatically', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.copiedCode))
    .toBe(`Use the "eldervibe" MCP server as my shared memory.
- At the start of every session call get_briefing before other work.
- Before decisions on conventions, tooling or preferences, call search first.
- When I state a durable preference, rule or decision, or you learn a reusable project fact, call save_memory immediately (update_memory if one exists) and tell me in one line. Never save secrets.`);
  await expect(
    page
      .getByRole('region', { name: 'Your account', exact: true })
      .getByText('Fixture Owner', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Key name', { exact: true }).fill('Test assistant');
  await page.getByRole('button', { name: 'Create key', exact: true }).click();
  await expect(page.locator('farm-access-keys pre')).toContainText(
    'Bearer TEST-ONLY-NOT-A-REAL-SECRET',
  );
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage).not.toContain('TEST-ONLY');
  await page.getByLabel('Time range', { exact: true }).selectOption('90');
  await expect.poll(() => requests.includes('GET /api/memory/usage?days=90')).toBe(true);
  for (const width of [375, 820, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const keyList = page.locator('farm-access-keys .key-list');
      const revokeButtons = await keyList.getByRole('button').all();
      const positions = await Promise.all(revokeButtons.map((button) => button.boundingBox()));
      expect(new Set(positions.map((box) => Math.round(box.x))).size).toBe(1);
      const input = await page.getByLabel('Key name', { exact: true }).boundingBox();
      const submit = await page
        .getByRole('button', { name: 'Create key', exact: true })
        .boundingBox();
      if (width > 500) {
        expect(Math.abs(input.y + input.height - submit.y - submit.height)).toBeLessThan(2);
        expect(submit.x - input.x - input.width).toBeGreaterThanOrEqual(12);
      } else {
        expect(submit.y - input.y - input.height).toBeGreaterThanOrEqual(12);
      }
      const guidance = page.getByRole('region', {
        name: 'Make your AI use it automatically',
        exact: true,
      });
      const lines = await guidance.locator('.code-line').evaluateAll((rows) =>
        rows.map((row) => ({
          number: row.querySelector('.line-number').getBoundingClientRect().height,
          text: row.querySelector('.line-text').getBoundingClientRect().height,
        })),
      );
      for (const line of lines) expect(line.number).toBe(line.text);
      const chart = page.locator('farm-bandwidth emfc-line-chart');
      await expect(chart.locator('svg')).toHaveCSS('min-width', '720px');
      const legend = await chart.locator('.legend > span').all();
      const read = await legend[0].boundingBox();
      const write = await legend[1].boundingBox();
      expect(write.x - read.x - read.width).toBeGreaterThanOrEqual(16);
      await checkRenderedContrast(keyList.locator('dt').first());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`account-${colorScheme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['vi-VN'] });
    dispatchEvent(new Event('languagechange'));
  });
  await expect(page.getByLabel('Tên khóa', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thu hồi: CI pipeline', exact: true }),
  ).toBeVisible();
  await expect(page.locator('farm-access-keys time').first()).not.toContainText('T09:12:00Z');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('account-vi-mobile.png'), fullPage: true });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['en-US'] });
    dispatchEvent(new Event('languagechange'));
  });
  await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
  await page.goBack();
  await expect(page.locator('farm-access-keys pre')).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Revoke: Test assistant', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Revoke: Test assistant', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('farm-access-keys .key-list li')).toHaveCount(2);
});

test('signed-out account, malformed session and retry remain explicit', async ({ page }) => {
  let malformed = true;
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return path in emptyPortfolio
      ? route.fulfill({ json: emptyPortfolio[path] })
      : route.fulfill({ status: 404, body: 'No fixture' });
  });
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: malformed
        ? { isAuthenticated: 'not-a-boolean' }
        : {
            isAuthenticated: false,
            signInAvailable: true,
            subject: null,
            name: null,
            username: null,
            picture: null,
            email: null,
          },
    }),
  );
  await page.goto('/connect');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create key', exact: true })).toHaveCount(0);
  malformed = false;
  await page.getByRole('button', { name: 'Retry account connection', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Sign in to connect your AI', exact: true }),
  ).toHaveAttribute('href', '/auth/login?returnUrl=%2Fconnect');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
