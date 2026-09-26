import { fromCustomClient } from 'geotiff';
const R=6378137,DEG=Math.PI/180;
const images=new Map<string,Promise<any>>();
export const referenceRequests:any[]=[];
export const rangeRequests:any[]=[];
export function tileName(lat:number,lon:number){const y=Math.floor(lat/3)*3,x=Math.floor(lon/3)*3;return `ESA_WorldCover_10m_2021_v200_${y<0?'S':'N'}${String(Math.abs(y)).padStart(2,'0')}${x<0?'W':'E'}${String(Math.abs(x)).padStart(3,'0')}_Map.tif`;}
async function image(name:string){if(!images.has(name))images.set(name,(async()=>{const url=new URL('/worldcover/'+name,location.origin).href;
 const client={url,async request({headers}:any){const t=performance.now(),r=await fetch(url,{headers,signal:AbortSignal.timeout(45000)}),bytes=await r.arrayBuffer();rangeRequests.push({name,range:new Headers(headers).get('range'),status:r.status,bytes:bytes.byteLength,ms:performance.now()-t,etag:r.headers.get('etag'),sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')});return {ok:r.ok,status:r.status,getHeader:(n:string)=>r.headers.get(n),getData:async()=>bytes};}};
 const tiff=await fromCustomClient(client,{allowFullFile:false,blockSize:65536,cacheSize:100});return tiff.getImage();})());return images.get(name)!;}
/** Native 10 m pixels aggregated by area/count into game cells, not a DEM water guess. */
export async function referenceWater(lat:number,lon:number,W:number,mpt:number) {
 const fraction=new Float32Array(W*W),valid=new Uint8Array(W*W),xs:number[]=[],ys:number[]=[];
 for(let x=0;x<=W;x++)xs.push(lon+(x-W/2)*mpt/(R*Math.cos(lat*DEG))/DEG);
 for(let y=0;y<=W;y++)ys.push(lat+(y-W/2)*mpt/R/DEG);
 const names=new Map<string,{south:number,west:number}>();
 for(const yy of [ys[0],ys[W]])for(const xx of [xs[0],xs[W]]){const wrapped=((xx+540)%360)-180;names.set(tileName(yy,wrapped),{south:Math.floor(yy/3)*3,west:Math.floor(wrapped/3)*3});}
 const counts=new Uint32Array(W*W),wet=new Uint32Array(W*W),errors:string[]=[];
 for(const [name,{south,west}]of names){const t=performance.now();try{
  const im=await image(name),[ox,oy]=im.getOrigin(),[rx,ry]=im.getResolution();
  // Move a dateline tile's longitudes into the selected continuous local frame.
  let shift=0;if(west-lon>180)shift=-360;if(west-lon< -180)shift=360;
  const left=Math.max(0,Math.floor((xs[0]-shift-ox)/rx)),right=Math.min(im.getWidth(),Math.ceil((xs[W]-shift-ox)/rx));
  const top=Math.max(0,Math.floor((ys[W]-oy)/ry)),bottom=Math.min(im.getHeight(),Math.ceil((ys[0]-oy)/ry));
  if(right<=left||bottom<=top)continue;
  const raster=await im.readRasters({window:[left,top,right,bottom],interleave:true}),rw=right-left;
  for(let py=top;py<bottom;py++){const latitude=oy+(py+.5)*ry,y=Math.floor((latitude-ys[0])/(ys[W]-ys[0])*W);if(y<0||y>=W)continue;
   for(let px=left;px<right;px++){const longitude=ox+(px+.5)*rx+shift,x=Math.floor((longitude-xs[0])/(xs[W]-xs[0])*W);if(x<0||x>=W)continue;const value=raster[(py-top)*rw+px-left],i=y*W+x;if(value){counts[i]++;if(value===80)wet[i]++;}}
  }
  referenceRequests.push({name,window:[left,top,right,bottom],nativePixels:raster.length,ms:performance.now()-t,status:'read'});
 }catch(e){errors.push(name+': '+String(e));referenceRequests.push({name,status:'unavailable',ms:performance.now()-t});}}
 for(let i=0;i<fraction.length;i++){if(counts[i]){fraction[i]=wet[i]/counts[i];valid[i]=1;}}
 return {fraction,valid,coverage:valid.reduce((a,b)=>a+b,0)/valid.length,waterCells:fraction.reduce((a,b)=>a+b,0),errors,source:'ESA WorldCover 2021 v200 class 80; 10 m permanent-water classification',resolution:10};
}
