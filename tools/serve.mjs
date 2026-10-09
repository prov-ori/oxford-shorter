import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json; charset=utf-8'};
export function serve(root = directory, rewrite) {
  return http.createServer(async(req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      if (rewrite && await rewrite(url, res)) return;
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      const data = await readFile(file); res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = serve(); server.listen(Number(process.argv[2]) || 4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port));
}
