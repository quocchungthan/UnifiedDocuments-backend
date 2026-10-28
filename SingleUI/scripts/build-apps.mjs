import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { apps } from './app.mjs';

for (const app of apps) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('app.mjs', import.meta.url)), 'build', `--app=${app}`, '--stats-json',
      ...(['productioncore-aids', 'disklens', 'exploring-local', 'para-ai'].includes(app) ? ['--base-href=./'] : [])],
    {
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`Build failed for ${app}${result.signal ? ` (${result.signal})` : ''}.`);
    process.exit(result.status ?? 1);
  }
}
