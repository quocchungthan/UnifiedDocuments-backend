import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Space+Grotesk:wght@400..700&display=swap';
async function download(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Font download failed: HTTP ${response.status}`);
  return response;
}
const stylesheet = await (await download(url)).text();
const fonts = [];
const blocks = stylesheet.match(/\/\*[^*]+\*\/\s*@font-face\s*\{[^}]+\}/g);
if (!blocks?.length) throw new Error('No font-face blocks returned.');
const output = [];
for (const block of blocks) {
  if (!/\/\* (latin|latin-ext|vietnamese) \*\//.test(block)) continue;
  const source = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!source) throw new Error('Unexpected font source.');
  const bytes = Buffer.from(await (await download(source)).arrayBuffer());
  fonts.push({
    source,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  });
  output.push(block.replace(source, `data:font/woff2;base64,${bytes.toString('base64')}`));
}
if (
  !output.some((block) => block.includes("'DM Sans'")) ||
  !output.some((block) => block.includes("'Space Grotesk'"))
)
  throw new Error('Both 30s font families are required.');
await writeFile(
  new URL('../src/design-system/font-faces.css', import.meta.url),
  '/* Generated self-contained OFL font faces; see font-sources.json. */\n' +
    output.join('\n') +
    '\n',
);
await writeFile(
  new URL('../src/design-system/font-sources.json', import.meta.url),
  JSON.stringify({ stylesheet: url, license: 'SIL Open Font License 1.1', fonts }, null, 2) + '\n',
);
const licenses = [];
for (const family of ['dmsans', 'spacegrotesk']) {
  licenses.push(
    `${family}\n${(await (await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`)).text()).replace(/[ \t]+$/gm, '')}`,
  );
}
await writeFile(
  new URL('../src/design-system/font-licenses.txt', import.meta.url),
  licenses.join('\n\n'),
);
await writeFile(new URL('../public/FONT-LICENSES.txt', import.meta.url), licenses.join('\n\n'));
console.log(
  `Embedded ${output.length} original 30s font subsets with no runtime network dependency.`,
);
