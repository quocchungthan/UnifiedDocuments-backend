import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const storagePort = process.env.SKIN_STORAGE_PORT ?? '8113';
if (!/^[1-9][0-9]{0,4}$/.test(storagePort) || Number(storagePort) > 65535)
  throw new Error('SKIN_STORAGE_PORT must be a valid TCP port.');
export const storageOrigin = `http://localhost:${storagePort}`;

export async function localEnvironment() {
  if (process.env.SKIN_TEST_STORAGE_PASSWORD || process.env.SKIN_TEST_NOTE_PASSWORD) {
    if (process.env.SKIN_HOST !== 'note' && !process.env.SKIN_TEST_STORAGE_PASSWORD)
      throw new Error('Provide SKIN_TEST_STORAGE_PASSWORD for Seafile tests.');
    if (process.env.SKIN_HOST !== 'storage' && !process.env.SKIN_TEST_NOTE_PASSWORD)
      throw new Error('Provide SKIN_TEST_NOTE_PASSWORD for AFFiNE tests.');
    return {
      STORAGE_ADMIN_PASSWORD: process.env.SKIN_TEST_STORAGE_PASSWORD,
      NOTE_ADMIN_PASSWORD: process.env.SKIN_TEST_NOTE_PASSWORD,
    };
  }
  const contents = await readFile(new URL('../../.local/skins.env', import.meta.url), 'utf8');
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const split = line.indexOf('=');
        if (split < 1) throw new Error('Malformed local skins environment file.');
        return [line.slice(0, split), line.slice(split + 1)];
      }),
  );
}

export async function waitForHost(url) {
  let last = 'no response';
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await setTimeout(1000);
  }
  throw new Error(`${url} did not become ready: ${last}`);
}

export default async function configureHosts() {
  const host = process.env.SKIN_HOST;
  if (host && !['storage', 'note'].includes(host))
    throw new Error('SKIN_HOST must be storage or note.');
  await Promise.all(
    [
      ...(host !== 'storage' ? ['http://localhost:8112/admin/'] : []),
      ...(host !== 'note' ? [`${storageOrigin}/accounts/login/`] : []),
    ].map(waitForHost),
  );
  const env = await localEnvironment();
  if (host !== 'note') {
    const auth = await fetch(`${storageOrigin}/api2/auth-token/`, {
      method: 'POST',
      body: new URLSearchParams({
        username: 'admin@example.invalid',
        password: env.STORAGE_ADMIN_PASSWORD,
      }),
    });
    if (!auth.ok) throw new Error(`Local Seafile authentication failed: HTTP ${auth.status}`);
    const { token } = await auth.json();
    if (typeof token !== 'string' || !token)
      throw new Error('Local Seafile returned no administrator token.');
    const branding = await fetch(`${storageOrigin}/api/v2.1/admin/web-settings/`, {
      method: 'PUT',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ENABLE_BRANDING_CSS: '1',
        CUSTOM_CSS: await readFile(new URL('../../dist-ui/seafile.css', import.meta.url), 'utf8'),
        SERVICE_URL: storageOrigin,
        FILE_SERVER_ROOT: `${storageOrigin}/seafhttp`,
      }),
    });
    if (!branding.ok)
      throw new Error(`Native Seafile branding installation failed: HTTP ${branding.status}`);
    console.log('Installed CSS through the original Seafile administrator web-settings API.');
  }
  if (host === 'storage') return;
  if (!env.NOTE_ADMIN_PASSWORD)
    throw new Error('Run skins:prepare to generate the local note account.');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:8112/admin/');
    if (new URL(page.url()).pathname === '/admin/setup') {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.locator('input[type=email]').fill('admin@example.invalid');
      await page.locator('input[type=text]').fill('Local UI Administrator');
      await page.locator('input[type=password]').fill(env.NOTE_ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page
        .getByRole('heading', { name: 'All Settings Done', exact: true })
        .waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForURL((url) => !url.pathname.includes('/setup'));
      console.log('Initialized the isolated AFFiNE administrator through its original setup UI.');
    }
  } catch (error) {
    await mkdir('test-results/hosts', { recursive: true });
    await page.screenshot({ path: 'test-results/hosts/setup-failure.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await configureHosts();
