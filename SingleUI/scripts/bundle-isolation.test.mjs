import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { apps } from './app.mjs';

for (const app of apps) {
  test(`${app} ships only its own app and bounded dependencies`, async () => {
    const output = new URL(`../dist/app-${app}/`, import.meta.url);
    const stats = JSON.parse(await readFile(new URL('stats.json', output), 'utf8'));
    const inputs = Object.keys(stats.inputs).map((path) => path.replaceAll('\\', '/'));
    const appInputs = inputs.filter((path) => /src\/app-[^/]+\//.test(path));
    assert.ok(inputs.includes('src/selected-app.ts'), 'Static selected entry must be present');
    assert.ok(
      appInputs.every((path) => path.includes(`src/app-${app}/`)),
      appInputs.join('\n'),
    );
    const includesThree = inputs.some((path) => /node_modules\/three\//.test(path));
    assert.equal(
      includesThree,
      ['car-3d-models', 'car-knowledge', 'para-ai'].includes(app),
      'Only apps with their own 3D scene need Three.js',
    );
    if (app !== 'car-3d-models') {
      assert.ok(
        !inputs.some((path) => /src\/domains\/cars\//.test(path)),
        'Car domain is not shared eagerly',
      );
      const assets = await readdir(new URL('browser/', output));
      assert.ok(
        !assets.includes('media') && !assets.includes('books'),
        'Car assets must be car-only',
      );
    }
    assert.ok(
      !inputs.some((path) => /node_modules\/(react|react-dom)\//.test(path)),
      'Angular-only application',
    );
  });
}
