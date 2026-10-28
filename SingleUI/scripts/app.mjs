import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const apps = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));

export function selectApp(command, args) {
  if (!['serve', 'build', 'test'].includes(command)) {
    throw new Error('Expected command: serve, build, or test.');
  }
  const options = [];
  let app = 'car-3d-models';
  let selected = false;
  let mode = command === 'serve' ? 'development' : 'production';
  let configured = false;
  const supported = `Supported apps: ${apps.join(', ')}.`;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--app' || argument.startsWith('--app=')) {
      if (selected) throw new Error('Specify --app only once.');
      selected = true;
      app = argument === '--app' ? args[++index] : argument.slice(6);
      if (!app || app.startsWith('-')) throw new Error(`Missing --app value. ${supported}`);
    } else if (
      ['-c', '--configuration'].includes(argument) ||
      argument.startsWith('--configuration=')
    ) {
      if (configured) throw new Error('Specify --configuration only once.');
      configured = true;
      mode = argument.startsWith('--configuration=') ? argument.slice(16) : args[++index];
      if (!['production', 'development'].includes(mode) || command === 'test') {
        throw new Error(
          'Use production or development for build/start; tests have no configuration flag.',
        );
      }
    } else if (
      /^--(browser|build-target|project|file-replacements|output-path)(=|$)/.test(argument)
    ) {
      throw new Error(`${argument.split('=')[0]} is managed by --app.`);
    } else {
      options.push(argument);
    }
  }
  app = { '30s': 'car-3d-models', 'para-ui': 'para-ai' }[app] ?? app;
  if (!apps.includes(app)) throw new Error(`Unknown app "${app}". ${supported}`);

  const configuration = `${mode},app-${app}`;
  const selection =
    command === 'serve'
      ? [`--build-target=single-ui:build:${configuration}`]
      : command === 'build'
        ? [`--configuration=${configuration}`, `--output-path=dist/app-${app}`]
        : [`--build-target=single-ui:build:development,app-${app}`];
  return [command, 'single-ui', ...selection, ...options];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let args;
  try {
    args = selectApp(process.argv[2], process.argv.slice(3));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve('@angular/cli/bin/ng.js'), ...args], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
  });
  if (result.error) console.error(`Unable to launch Angular CLI: ${result.error.message}`);
  if (result.signal) console.error(`Angular CLI terminated by ${result.signal}.`);
  process.exit(result.status ?? 1);
}
