// Local static HTTP server for game/ (Node 22+, standard library only).
// Usage: node serve.ts [--port 8080]

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const requestedPort = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 8080;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const parsed = new URL(req.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(gameRoot, normalize(pathname)));
  if (filePath !== gameRoot && !filePath.startsWith(gameRoot + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let fileSize: number;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    fileSize = stat.size;
  } catch {
    res.writeHead(404).end('Not Found');
    return;
  }

  res.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': fileSize,
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Solaris Wing game/ served at http://127.0.0.1:${port}`);
});
