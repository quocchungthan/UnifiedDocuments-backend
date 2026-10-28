import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const selected = process.argv[2] ?? 'all';
if (process.argv.length > 3 || !['storage', 'note', 'all'].includes(selected))
  throw new Error('Expected one host: storage, note or all.');

const sources = JSON.parse(await readFile(new URL('./sources.json', import.meta.url), 'utf8'));
const run = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });

for (const host of selected === 'all' ? ['storage', 'note'] : [selected]) {
  const temporary = await mkdtemp(join(tmpdir(), 'singleui-skins-'));
  const emptyEnvironment = join(temporary, 'empty.env');
  await writeFile(emptyEnvironment, '');
  const storagePassword = randomBytes(24).toString('hex');
  const env = {
    ...process.env,
    COMPOSE_DISABLE_ENV_FILE: '1',
    STORAGE_DB_PASSWORD: randomBytes(24).toString('hex'),
    STORAGE_ADMIN_PASSWORD: storagePassword,
    NOTE_DB_PASSWORD: randomBytes(24).toString('hex'),
    SKIN_TEST_STORAGE_PASSWORD: storagePassword,
    SKIN_TEST_NOTE_PASSWORD: `A1!${randomBytes(12).toString('base64url')}`,
    SKIN_HOST: host,
    AFFINE_BASE: sources.note.image,
  };
  const compose = [
    'compose',
    '--env-file',
    emptyEnvironment,
    '--project-name',
    `singleui-skins-test-${process.pid}-${host}`,
    '-f',
    'deployment/local/compose.yml',
  ];
  try {
    await run(
      'docker',
      [...compose, 'up', '-d', ...(host === 'note' ? ['--build'] : []), host],
      env,
    );
    await run('npm', ['run', 'test:hosts'], env);
  } finally {
    try {
      await run('docker', [...compose, 'down', '--volumes'], env);
    } finally {
      await unlink(emptyEnvironment);
      await rmdir(temporary);
    }
  }
}
