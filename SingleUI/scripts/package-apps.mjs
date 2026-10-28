import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps } from './app.mjs';

export async function fileHashes(directory) {
  const files = {};
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) {
        files[relative(directory, full).split(sep).join('/')] =
          createHash('sha256').update(await readFile(full)).digest('hex');
      } else throw new Error(`Unsupported bundle entry: ${full}`);
    }
  }
  await visit(directory);
  return files;
}

export async function packageApp(source, destination, app, revision) {
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error(`Output must be empty: ${destination}`);
  await cp(source, destination, { recursive: true });
  const html = await readFile(resolve(destination, 'index.html'), 'utf8');
  const baseHref = html.match(/<base href="([^"]+)"/)?.[1];
  if (!['/', './'].includes(baseHref)) throw new Error(`Unsupported base href for ${app}`);
  if (/<style\b|\son[a-z]+\s*=/i.test(html)) {
    throw new Error(`Inline styles/event handlers cannot ship in a CSP-compatible entry: ${app}`);
  }
  const manifest = {
    schemaVersion: 1, app, revision, baseHref,
    files: await fileHashes(destination),
  };
  await writeFile(resolve(destination, 'bundle-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const revision = process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) {
    throw new Error('Set GITHUB_SHA to the exact source commit before packaging.');
  }
  for (const app of apps) {
    await packageApp(resolve(root, 'dist', `app-${app}`, 'browser'),
      resolve(root, 'dist-bundles', `app-${app}`), app, revision);
  }
  await cp(resolve(root, 'docs', 'bundle-installation.md'), resolve(root, 'dist-bundles', 'INSTALL.md'));
}
