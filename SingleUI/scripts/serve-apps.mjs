import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps } from './app.mjs';

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};
const roots = apps.map((app) =>
  fileURLToPath(new URL(`../dist/app-${app}/browser/`, import.meta.url)),
);
await Promise.all(roots.map((root) => access(resolve(root, 'index.html'))));

await Promise.all(
  roots.map(
    (root, index) =>
      new Promise((ready, reject) => {
        const server = createServer(async (request, response) => {
          if (!['GET', 'HEAD'].includes(request.method)) {
            response.writeHead(405).end('Method not allowed');
            return;
          }
          let pathname;
          try {
            pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
          } catch {
            response.writeHead(400).end('Invalid URL');
            return;
          }
          const mounts = {
            'para-ai': '/para-bridge/',
            disklens: '/tools-w-disklens/',
            'productioncore-aids': '/tools-w-productioncore-aids/',
            'exploring-local': '/tools-s-exploring-local/',
          };
          const mount = mounts[apps[index]];
          if (mount && pathname.startsWith(mount)) pathname = '/' + pathname.slice(mount.length);
          const entry = pathname === '/' ||
            (apps[index] === 'identity' && pathname === '/apps') ||
            (apps[index] === 'farm' && ['/connect', '/winchester', '/tracker', '/brick', '/bricks'].includes(pathname)) ||
            (apps[index] === 'mail' && (['/compose', '/login', '/auth/choose'].includes(pathname) || /^\/message\/[1-9][0-9]*$/.test(pathname))) ||
            (apps[index] === 'chinese-chess-lovers' && (
              /^\/(?:admin\/)?room\/[A-Za-z2-9]{6}$/.test(pathname) ||
              pathname === '/admin' || /^\/admin\/pair\/[a-f0-9]{24}$/.test(pathname)));
          const path = resolve(root, `.${entry ? '/index.html' : pathname}`);
          const within = relative(root, path);
          if (within === '..' || within.startsWith(`..${sep}`) || within.includes(':')) {
            response.writeHead(403).end('Forbidden');
            return;
          }
          try {
            const content = await readFile(path);
            response.writeHead(200, {
              'Content-Type': types[extname(path)] ?? 'application/octet-stream',
            });
            response.end(request.method === 'HEAD' ? undefined : content);
          } catch (error) {
            if (!['ENOENT', 'EISDIR'].includes(error.code)) console.error(error);
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to serve file');
          }
        });
        server.once('error', reject);
        server.listen(4327 + index, '127.0.0.1', ready);
      }),
  ),
);
console.log(
  `Serving ${apps.length} built app entries at http://127.0.0.1:4327 through :${4326 + apps.length}`,
);
