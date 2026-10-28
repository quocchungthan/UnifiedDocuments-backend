import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const output = new URL('../dist-ui/', import.meta.url);

test('portable theme module runs without Angular or app imports', async () => {
  const { setTheme, getTheme } = await import(new URL('emfc-theme.js', output));
  const { document } = new JSDOM('<!doctype html><html></html>').window;
  setTheme(document.documentElement, 'dark');
  assert.equal(getTheme(document.documentElement), 'dark');
  assert.throws(() => setTheme(document.documentElement, 'other'), /Theme must be/);
  assert.equal(getTheme(document.documentElement), 'dark');
});

test('artifacts use the generated shared palette, unprefixed selectors and matching manifest hashes', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));
  for (const [name, { sha256 }] of Object.entries(manifest.files)) {
    const content = await readFile(new URL(name, output), 'utf8');
    assert.equal(createHash('sha256').update(content).digest('hex'), sha256, name);
    if (/\.(css|js)$/.test(name)) assert.doesNotMatch(content, /@import|https?:\/\//, name);
  }
  const css = await readFile(new URL('emfc-ui.css', output), 'utf8');
  assert.match(css, /\.button\s*\{/);
  assert.doesNotMatch(css, /[.#](?:emfc|farm|bridge|office|demo)-/);
  assert.doesNotMatch(css, /\bbody\s*\{/);
  const foundation = (await readFile(
    new URL('../src/design-system/workshop-foundation.css', import.meta.url),
    'utf8',
  )).replace(/\r\n/g, '\n');
  assert.equal(
    createHash('sha256').update(foundation).digest('hex'),
    manifest.theme.source.foundationSha256,
  );
  const palette = (await readFile(
    new URL('../src/design-system/palette.css', import.meta.url),
    'utf8',
  )).replace(/\r\n/g, '\n');
  assert.equal(css.slice(0, palette.length), palette);
  for (const name of ['mail', 'seafile', 'affine']) {
    const adapter = await readFile(new URL(`${name}.css`, output), 'utf8');
    assert.equal(adapter.slice(0, palette.length + foundation.length + 1), `${palette}\n${foundation}`);
    assert.doesNotMatch(adapter, /[.#](?:emfc|farm|bridge|office|demo)-/);
  }
  const adapter = await readFile(new URL('seafile.css', output), 'utf8');
  assert.match(adapter, /--primary-color: var\(--color-accent-hover\)/);
  assert.equal(manifest.adapters.seafile.status, 'requires-host-validation');
  const affine = await readFile(new URL('affine.css', output), 'utf8');
  assert.match(affine, /--affine-brand-color: var\(--color-accent-hover\)/);
  assert.equal(manifest.adapters.affine.status, 'requires-host-validation');
  assert.match(await readFile(new URL('INSTALL.md', output), 'utf8'), /BRANDING_CSS/);
});
