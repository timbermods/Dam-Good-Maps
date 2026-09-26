import http from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { waterProxy } from './water-proxy.mjs';
import path from 'node:path';
export function serve(port=4178) {
  const root=path.resolve('dist');
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/worldcover/')) {
        if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end('GET required');return;}
        const range=req.headers.range??'',key=createHash('sha256').update(url.pathname+range).digest('hex'),dir=path.resolve('.cache/worldcover');
        await mkdir(dir,{recursive:true});
        let entry;
        try{entry=JSON.parse(await readFile(path.join(dir,key+'.json'),'utf8'));}catch{}
        if(!entry){const r=await waterProxy(new Request(url,{headers:{Range:range}}));entry={status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer()).toString('base64')};if(r.status===206||r.status===404)await writeFile(path.join(dir,key+'.json'),JSON.stringify(entry));}
        res.writeHead(entry.status,entry.headers);res.end(Buffer.from(entry.body,'base64'));return;
      }
      const file=path.resolve(root, '.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if (!file.startsWith(root+path.sep)) throw Error('outside root');
      const bytes=await readFile(file);
      res.writeHead(200, {'Content-Type':({'.html':'text/html','.js':'text/javascript','.md':'text/plain','.json':'application/json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(bytes);
    } catch {res.writeHead(404);res.end('Not found');}
  }).listen(port,'127.0.0.1');
}
if (process.argv[1]?.endsWith('server.mjs')) { serve(); console.log('http://127.0.0.1:4178'); }
