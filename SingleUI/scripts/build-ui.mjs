import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const output = new URL('dist-ui/', root);
const source = async (path) => {
  const url = new URL(`src/${path}`, root);
  let contents = await readFile(url, 'utf8');
  if (path.endsWith('.css')) {
    contents = contents.replace(/\r\n/g, '\n');
    for (const match of contents.matchAll(/^@import ['"](\.\/[^'"]+)['"];$/gm)) {
      contents = contents.replace(match[0], (await readFile(new URL(match[1], url), 'utf8')).replace(/\r\n/g, '\n'));
    }
  }
  return contents;
};
const files = new Map();
const css = (
  await Promise.all([
    source('design-system/palette.css'),
    source('design-system/workshop-foundation.css'),
    source('design-system/font-faces.css'),
    source('design-system/typography.css'),
    source('design-system/focus.css'),
    source('design-system/primitives.css'),
    source('design-system/theme.css'),
    source('design-system/controls.css'),
    source('ui/components.css'),
  ])
).join('\n');

files.set('emfc-ui.css', css);

for (const [input, destination] of [
  ['contracts/theme.ts', 'contracts/theme.js'],
  ['theme/runtime.ts', 'theme/runtime.js'],
]) {
  const result = ts.transpileModule(await source(input), {
    fileName: input,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    reportDiagnostics: true,
  });
  const errors = result.diagnostics?.filter(
    (item) => item.category === ts.DiagnosticCategory.Error,
  );
  if (errors?.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(errors, {
        getCurrentDirectory: () => fileURLToPath(root),
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }),
    );
  }
  files.set(destination, result.outputText);
}
files.set('emfc-theme.js', "export { getTheme, setTheme } from './theme/runtime.js';\n");

for (const adapter of ['mail', 'seafile', 'affine']) {
  const tokens = (
    await Promise.all([
      source('design-system/palette.css'),
      source('design-system/workshop-foundation.css'),
      source('design-system/font-faces.css'),
      source('design-system/typography.css'),
      source('design-system/focus.css'),
      source(`adapters/${adapter}.css`),
    ])
  ).join('\n');

  files.set(`${adapter}.css`, tokens);
  if (adapter !== 'mail') files.set(`${adapter}-candidate.css`, tokens);
}
files.set('INSTALL.md', await readFile(new URL('docs/css-installation.md', root), 'utf8'));
const hostSources = JSON.parse(await readFile(new URL('deployment/local/sources.json', root), 'utf8'));
files.set('affine-image.txt', hostSources.note.image + '\n');
files.set('affine-install-style.mjs',
  await readFile(new URL('deployment/local/note/install-style.mjs', root), 'utf8'));
files.set('Dockerfile.affine',
  `ARG AFFINE_BASE=${hostSources.note.image}\nFROM \${AFFINE_BASE}\nCOPY affine.css /app/static/single-ui.css\nCOPY affine-install-style.mjs /tmp/install-style.mjs\nRUN node /tmp/install-style.mjs\n`);
files.set('FONT-LICENSES.txt', await source('design-system/font-licenses.txt'));
files.set('package.json', JSON.stringify({ private: true, type: 'module' }, null, 2) + '\n');

const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const manifest = {
  schemaVersion: 1,
  version,
  revision: process.env.GITHUB_SHA ?? null,
  theme: {
    baseline: 'french-warm-palette-30s-geometry',
    status: 'selected',
    source: JSON.parse(await source('design-system/source.json')),
    palette: JSON.parse(await source('design-system/palette.json')),
    preferences: ['system'],
  },
  adapters: {
    mail: {
      file: 'mail.css',
      status: 'requires-host-validation',
      installation: 'MailBox static/shared/variables.css',
    },
    seafile: {
      file: 'seafile.css',
      status: 'requires-host-validation',
      installation: 'Seafile 11 System Admin custom CSS (ENABLE_BRANDING_CSS and CUSTOM_CSS)',
    },
    affine: {
      file: 'affine.css',
      status: 'requires-host-validation',
      installation: 'Operator-owned derived image: additional stylesheet link in selfhost HTML',
      variables: 'AFFiNE V1, V2 interface roles and selfhost administrator controls',
    },
  },
  files: Object.fromEntries(
    [...files].map(([name, content]) => [
      name,
      { sha256: createHash('sha256').update(content).digest('hex') },
    ]),
  ),
};
files.set('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

await rm(output, { recursive: true, force: true });
for (const [name, content] of files) {
  const destination = new URL(name, output);
  await mkdir(new URL('.', destination), { recursive: true });
  await writeFile(destination, content);
}
console.log(`Built ${files.size} portable UI files in ${fileURLToPath(output)}`);
