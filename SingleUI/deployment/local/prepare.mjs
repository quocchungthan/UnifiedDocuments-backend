import { execFileSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = resolve(root, '.local');
const source = resolve(
  process.env.INTERNET_FACING_DIR ?? resolve(root, '..', '..', 'internet-facing'),
);
const sources = JSON.parse(await readFile(new URL('sources.json', import.meta.url), 'utf8'));
await mkdir(local, { recursive: true });
let web;
if (process.env.INCLUDE_MAIL_REFERENCE === '1') {
  const revision = execFileSync('git', ['-C', source, 'rev-parse', sources.mail.revision], {
    encoding: 'utf8',
  }).trim();
  const directory = resolve(local, `mail-source-${revision.slice(0, 12)}`);
  await mkdir(directory, { recursive: true });
  const assets = [
    'css/shared/variables.css',
    'css/shared/base.css',
    'favicon.ico',
    'favicon.svg',
    'apple-touch-icon.svg',
    'icons.svg',
  ];
  const archive = resolve(local, 'mail-source.tar');
  await writeFile(
    archive,
    execFileSync(
      'git',
      [
        '-C',
        source,
        'archive',
        revision,
        'MailBox',
        ...assets.map((asset) => `Farm/wwwroot/${asset}`),
      ],
      { maxBuffer: 32 * 1024 * 1024 },
    ),
  );
  const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
  execFileSync(tar, ['-xf', archive, '-C', directory], { stdio: 'inherit' });
  web = resolve(directory, 'MailBox', 'web');
  await mkdir(resolve(web, 'static', 'shared'), { recursive: true });
  for (const asset of assets) {
    const name = asset.replace('css/', '');
    await copyFile(resolve(directory, 'Farm', 'wwwroot', asset), resolve(web, 'static', name));
  }
  await copyFile(
    resolve(root, 'dist-ui', 'mail.css'),
    resolve(web, 'static', 'shared', 'variables.css'),
  );
  await writeFile(
    resolve(local, 'mail-source.json'),
    JSON.stringify(
      {
        repository: 'internet-facing',
        revision,
        product: 'MailBox',
        application:
          'Optional original Flask styling reference; not the Angular app-mail backend integration.',
      },
      null,
      2,
    ),
  );
}
const env = resolve(local, 'skins.env');
let previous = '';
try {
  previous = await readFile(env, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const variables = new Map(
  previous
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf('=');
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
if (web) variables.set('MAIL_SOURCE_DIR', web.replaceAll('\\', '/'));
for (const name of [
  'MAIL_SESSION_SECRET',
  'NOTE_DB_PASSWORD',
  'STORAGE_DB_PASSWORD',
  'STORAGE_ADMIN_PASSWORD',
])
  if (!variables.has(name)) variables.set(name, randomBytes(32).toString('base64url'));
if (!variables.has('NOTE_ADMIN_PASSWORD'))
  variables.set('NOTE_ADMIN_PASSWORD', randomBytes(18).toString('base64url'));
if (process.env.AFFINE_BASE) variables.set('AFFINE_BASE', process.env.AFFINE_BASE);
else if (!variables.has('AFFINE_BASE')) variables.set('AFFINE_BASE', sources.note.image);
await writeFile(env, [...variables].map(([name, value]) => `${name}=${value}`).join('\n') + '\n', {
  mode: 0o600,
});
await access(resolve(root, 'dist-ui', 'seafile.css'));
console.log(
  'Prepared isolated note/storage credentials and optional mail reference. No production configuration was read or changed.',
);
