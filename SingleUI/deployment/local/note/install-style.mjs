import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = '/app/static';
const revision = createHash('sha256')
  .update(await readFile(join(root, 'single-ui.css')))
  .digest('hex')
  .slice(0, 16);
for (const directory of ['', 'admin', 'mobile']) {
  for (const file of ['index.html', 'selfhost.html']) {
    const path = join(root, directory, file);
    const html = await readFile(path, 'utf8');
    const link = `<link rel="stylesheet" href="/single-ui.css?v=${revision}">`;
    if (!html.includes('</head>'))
      throw new Error(`No head closing tag in upstream ${path}. Revalidate this AFFiNE version.`);
    if (html.includes(link)) throw new Error(`Stylesheet already installed in ${path}.`);
    await writeFile(path, html.replace('</head>', `${link}</head>`));
  }
}
console.log(
  'Added one same-origin stylesheet link to the six original AFFiNE entry pages. Application bundles and CSP are unchanged.',
);
