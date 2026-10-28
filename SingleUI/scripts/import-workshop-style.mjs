import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkout = resolve(process.argv[2] ?? resolve(root, '..', '..', 'internet-facing'));
const revision = '6881b93107f3ee8178500d075dd56492a0638784';
const source = 'web/src/styles.css';
const original = execFileSync('git', ['-C', checkout, 'show', `${revision}:${source}`], {
  env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  maxBuffer: 2 * 1024 * 1024,
});
const palette = JSON.parse(
  await readFile(new URL('../src/design-system/palette.json', import.meta.url), 'utf8'),
);
const foundation = await readFile(
  new URL('../src/design-system/workshop-foundation.css', import.meta.url),
);
await writeFile(
  new URL('../src/design-system/source.json', import.meta.url),
  JSON.stringify(
    {
      application: '30s',
      repository: 'quocchungthan/internet-facing',
      branch: 'sub/30s',
      revision,
      source,
      sha256: createHash('sha256').update(original).digest('hex'),
      foundationSha256: createHash('sha256').update(foundation).digest('hex'),
      palette: {
        name: palette.name,
        source: palette.source,
        definition: 'src/design-system/palette.json',
      },
      transformation:
        'Retained 30s glass geometry and typography only. All colors come from palette.json (user-selected warm French Flat UI column) via generated palette.css; contrast-safe derived text/state shades. Not a byte-for-byte stylesheet copy. App viewport layouts and remote font import are not copied.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Recorded pinned sub/30s source and adapted foundation hashes.');
