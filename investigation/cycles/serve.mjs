import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.gz':'application/gzip','.md':'text/plain; charset=utf-8','.timber':'application/octet-stream'};
const server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(302,{Location:'/viewer/index.html'});res.end();return;}const rel=decodeURIComponent(url.pathname);
    const file=path.resolve(root,'.'+rel);
    if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){res.writeHead(403);res.end('Not available');return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT??4178),'127.0.0.1',()=>console.log(`Local viewer: http://127.0.0.1:${server.address().port}/`));
