import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { apps, selectApp } from './app.mjs';

const launcher = fileURLToPath(new URL('./app.mjs', import.meta.url));

function run(...args) {
  const result = spawnSync(process.execPath, [launcher, ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('every app selects its own static entry for start, build and test', async () => {
  const workspace = JSON.parse(await readFile(new URL('../angular.json', import.meta.url), 'utf8'));
  for (const app of apps) {
    for (const selection of [[`--app=${app}`], ['--app', app]]) {
      assert.deepEqual(selectApp('serve', [...selection, '--port=4209']), [
        'serve',
        'single-ui',
        `--build-target=single-ui:build:development,app-${app}`,
        '--port=4209',
      ]);
      assert.deepEqual(selectApp('build', [...selection, '--configuration', 'development']), [
        'build',
        'single-ui',
        `--configuration=development,app-${app}`,
        `--output-path=dist/app-${app}`,
      ]);
      assert.deepEqual(selectApp('test', [...selection, '--watch=false']), [
        'test',
        'single-ui',
        `--build-target=single-ui:build:development,app-${app}`,
        '--watch=false',
      ]);
    }
    const configuration =
      workspace.projects['single-ui'].architect.build.configurations[`app-${app}`];
    assert.ok(configuration, app);
    const entry =
      app === 'car-3d-models' ? 'src/selected-app.ts' : configuration.fileReplacements[0].with;
    if (app !== 'car-3d-models') assert.equal(entry, `src/app-${app}/app.ts`);
    await readFile(new URL(`../${entry}`, import.meta.url));
  }
  assert.deepEqual(selectApp('build', []), selectApp('build', ['--app=car-3d-models']));
});

test('CLI forwards help to the real Angular target', () => {
  for (const command of ['serve', 'build', 'test']) {
    const result = run(command, '--app=farm', '--help');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /single-ui/);
  }
});

test('legacy names resolve to canonical entries rather than duplicate apps', () => {
  assert.deepEqual(selectApp('build', ['--app=30s']), selectApp('build', ['--app=car-3d-models']));
  assert.deepEqual(selectApp('serve', ['--app=para-ui']), selectApp('serve', ['--app=para-ai']));
  assert.equal(apps.includes('30s'), false);
});

test('invalid selections fail explicitly before invoking Angular', () => {
  for (const [args, message] of [
    [['build', '--app=other'], /Unknown app "other"/],
    [['build', '--app=car-research'], /Unknown app "car-research"/],
    [['serve', '--app'], /Missing --app value/],
    [['build', '--app', '--help'], /Missing --app value/],
    [['serve', '--app='], /Missing --app value/],
    [['build', '--app=car-3d-models', '--app=other'], /Specify --app only once/],
    [['build', '--app=farm', '--configuration=app-disklens'], /Use production or development/],
    [['serve', '--app=farm', '--build-target=other:build'], /managed by --app/],
    [['build', '--app=farm', '--output-path=dist/shared'], /managed by --app/],
    [['build', '-c', 'development', '-c', 'production'], /Specify --configuration only once/],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
  }
});
