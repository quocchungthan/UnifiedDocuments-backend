import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function installBundle(source, destination, app, revision) {
  const manifest = JSON.parse(await readFile(resolve(source, 'bundle-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.app !== app || manifest.revision !== revision ||
      !/^[a-f0-9]{40}$/.test(revision) || !['/', './'].includes(manifest.baseHref) ||
      !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) ||
      !manifest.files['index.html']) throw new Error('Bundle identity/manifest mismatch.');
  await verifyFiles(source, manifest.files, 'bundle-manifest.json');
  await copyIntoEmpty(source, destination);
}

async function verifyFiles(source, files, manifestName) {
  const expected = new Set([manifestName, ...Object.keys(files)]);
  async function verify(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await verify(resolve(directory, entry.name), `${name}/`);
      else if (!entry.isFile() || !expected.delete(name)) throw new Error(`Unexpected bundle file: ${name}`);
    }
  }
  await verify(source);
  if (expected.size) throw new Error(`Missing bundle files: ${[...expected].join(', ')}`);
  for (const [name, hash] of Object.entries(files)) {
    if (isAbsolute(name) || name.includes('\\') || name.split('/').some((part) => !part || part === '..' || part === '.') ||
        !/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid manifest entry: ${name}`);
    const file = resolve(source, name);
    if (!(await lstat(file)).isFile()) throw new Error(`Not a regular bundle file: ${name}`);
    if (createHash('sha256').update(await readFile(file)).digest('hex') !== hash) {
      throw new Error(`Bundle hash mismatch: ${name}`);
    }
  }
}

async function copyIntoEmpty(source, destination) {
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error(`Destination must be empty: ${destination}`);
  await cp(source, destination, { recursive: true });
}

export async function installUi(source, destination, revision) {
  const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.revision !== revision ||
      !/^[a-f0-9]{40}$/.test(revision) || !manifest.files ||
      typeof manifest.files !== 'object' || Array.isArray(manifest.files) ||
      !['affine.css', 'affine-image.txt', 'affine-install-style.mjs', 'Dockerfile.affine', 'seafile.css', 'INSTALL.md']
        .every(name => manifest.files[name]?.sha256))
    throw new Error('UI skin identity/manifest mismatch.');
  const files = Object.fromEntries(Object.entries(manifest.files).map(([name, value]) => [name, value?.sha256]));
  await verifyFiles(source, files, 'manifest.json');
  await copyIntoEmpty(source, destination);
}

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GitHub artifact retrieval failed: ${result.stderr}`);
  return result.stdout;
}

export async function downloadApp(app, destination, runId = process.env.SINGLE_UI_RUN_ID) {
  if (!/^[a-z0-9-]+$/.test(app) || !/^[1-9][0-9]*$/.test(runId ?? '')) {
    throw new Error('Provide an app ID and SINGLE_UI_RUN_ID from a successful main-branch SingleUI run.');
  }
  return downloadArtifact('single-ui-apps', destination, runId,
    (temporary, revision) => installBundle(resolve(temporary, `app-${app}`), destination, app, revision));
}

export async function downloadUi(destination, runId = process.env.SINGLE_UI_RUN_ID) {
  if (!/^[1-9][0-9]*$/.test(runId ?? ''))
    throw new Error('Provide SINGLE_UI_RUN_ID from a successful trusted SingleUI run.');
  return downloadArtifact('single-ui-css', destination, runId,
    (temporary, revision) => installUi(temporary, destination, revision));
}

async function downloadArtifact(artifact, destination, runId, install) {
  const repo = 'quocchungthan/EMFc-experiments';
  const run = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${runId}`]));
  if (run.status !== 'completed' || run.conclusion !== 'success' || run.head_branch !== 'main' ||
      !['push', 'workflow_dispatch'].includes(run.event) ||
      run.path !== '.github/workflows/single-ui.yml' || run.head_repository?.full_name !== repo) {
    throw new Error('Only successful trusted main-branch SingleUI apps and skins runs are accepted.');
  }
  if (process.env.SINGLE_UI_REVISION && process.env.SINGLE_UI_REVISION !== run.head_sha) {
    throw new Error('SINGLE_UI_REVISION does not match the selected artifact run.');
  }
  const temporary = await mkdtemp(resolve(tmpdir(), 'single-ui-artifact-'));
  try {
    gh(['run', 'download', runId, '--repo', repo, '--name', artifact, '--dir', temporary]);
    await install(temporary, run.head_sha);
    console.log(`Installed ${artifact} into ${destination} from ${repo} run ${runId} (${run.head_sha}).`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node import-app.mjs APP EMPTY_DESTINATION');
  await downloadApp(process.argv[2], resolve(process.argv[3]));
}
