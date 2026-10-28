import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { packageApp } from './package-apps.mjs';
import { installBundle, installUi } from '../deployment/artifacts/import-app.mjs';

const revision = 'a'.repeat(40);
for (const scenario of ['valid', 'tampered', 'extra', 'revision', 'traversal', 'occupied', 'inline-style', 'inline-handler']) {
  test(`artifact installation: ${scenario}`, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'single-ui-test-'));
    try {
      const source = resolve(root, 'browser');
      const bundle = resolve(root, 'bundle');
      const output = resolve(root, 'installed');
      await mkdir(source);
      await writeFile(resolve(source, 'index.html'), '<base href="./"><script src="main.js"></script>');
      await writeFile(resolve(source, 'main.js'), 'export {};');
      if (scenario.startsWith('inline-')) {
        await writeFile(resolve(source, 'index.html'), '<base href="/">' +
          (scenario === 'inline-style' ? '<style>body{color:red}</style>' : '<link rel="stylesheet" onload="this.media=\'all\'">'));
        await assert.rejects(() => packageApp(source, bundle, 'disklens', revision), /CSP-compatible/);
        return;
      }

      await packageApp(source, bundle, 'disklens', revision);
      if (scenario === 'tampered') await writeFile(resolve(bundle, 'main.js'), 'changed');
      if (scenario === 'extra') await writeFile(resolve(bundle, 'extra.js'), 'unlisted');
      if (scenario === 'traversal') {
        const file = resolve(bundle, 'bundle-manifest.json');
        const manifest = JSON.parse(await readFile(file));
        manifest.files['../outside'] = '0'.repeat(64);
        await writeFile(file, JSON.stringify(manifest));
      }
      if (scenario === 'occupied') {
        await mkdir(output);
        await writeFile(resolve(output, 'keep.txt'), 'unrelated');
      }
      const install = () => installBundle(bundle, output, 'disklens',
        scenario === 'revision' ? 'b'.repeat(40) : revision);
      if (scenario === 'valid') {
        await install();
        assert.match(await readFile(resolve(output, 'index.html'), 'utf8'), /base href="\.\/"/);
      } else await assert.rejects(install);
      if (scenario === 'occupied') assert.equal(await readFile(resolve(output, 'keep.txt'), 'utf8'), 'unrelated');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

for (const scenario of ['valid', 'tampered', 'revision', 'extra']) {
  test(`portable skin installation: ${scenario}`, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'single-ui-skin-test-'));
    try {
      const source = resolve(root, 'skin');
      const output = resolve(root, 'installed');
      await mkdir(source);
      const names = ['affine.css', 'affine-image.txt', 'affine-install-style.mjs', 'Dockerfile.affine', 'seafile.css', 'INSTALL.md'];
      const files = {};
      for (const name of names) {
        await writeFile(resolve(source, name), name);
        files[name] = { sha256: createHash('sha256').update(name).digest('hex') };
      }
      await writeFile(resolve(source, 'manifest.json'), JSON.stringify({ schemaVersion: 1, revision, files }));
      if (scenario === 'tampered') await writeFile(resolve(source, 'affine.css'), 'changed');
      if (scenario === 'extra') await writeFile(resolve(source, 'unlisted.js'), 'extra');
      const install = () => installUi(source, output, scenario === 'revision' ? 'b'.repeat(40) : revision);
      if (scenario === 'valid') {
        await install();
        assert.equal(await readFile(resolve(output, 'affine.css'), 'utf8'), 'affine.css');
      } else await assert.rejects(install);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
