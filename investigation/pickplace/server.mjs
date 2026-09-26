import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export function serve(port=4178) {
  const root=path.resolve('dist');
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      const file=path.resolve(root, '.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if (!file.startsWith(root+path.sep)) throw Error('outside root');
      const bytes=await readFile(file);
      res.writeHead(200, {'Content-Type':({'.html':'text/html','.js':'text/javascript','.md':'text/plain','.json':'application/json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(bytes);
    } catch {res.writeHead(404);res.end('Not found');}
  }).listen(port,'127.0.0.1');
}
if (process.argv[1]?.endsWith('server.mjs')) { serve(); console.log('http://127.0.0.1:4178'); }
