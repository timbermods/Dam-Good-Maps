export const BASE='https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const R=6378137, DEG=Math.PI/180;
const memory=new Map<string,Promise<Float32Array>>();
export const requests:any[]=[];
export function checkInput(lat:number,lon:number,size:number) {
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180) throw Error('Use latitude −85 to 85 and longitude −180 to 180. Polar support needs a different projection.');
  if(![96,128,256].includes(size)) throw Error('Choose 96, 128 or 256 tiles.');
}
export function pixel(lat:number,lon:number,z:number) {
  const n=256*2**z;
  return [(lon+180)/360*n,(1-Math.asinh(Math.tan(lat*DEG))/Math.PI)/2*n];
}
export function decode(r:number,g:number,b:number) {return r*256+g+b/256-32768;}
async function tile(z:number,x:number,y:number) {
  const n=2**z; x=((x%n)+n)%n;
  if(y<0||y>=n) throw Error('The selected area crosses the supported latitude boundary.');
  const url=`${BASE}/${z}/${x}/${y}.png`;
  if(memory.has(url)) return memory.get(url)!;
  const p=(async()=>{
    const start=performance.now();
    const cache=await caches.open('pickplace-terrain-v1');
    let response=await cache.match(url), cached=!!response;
    if(!response) {
      for(let attempt=0;attempt<3;attempt++) {
        try {
          response=await fetch(url,{mode:'cors',signal:AbortSignal.timeout(20000)});
          if(!response.ok) throw Error(`Terrain request ${response.status}`);
          break;
        } catch(e) {if(attempt===2) throw e; await new Promise(r=>setTimeout(r,500*2**attempt));}
      }
      await cache.put(url,response!.clone());
    }
    const bytes=await response!.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    const bitmap=await createImageBitmap(new Blob([bytes]),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
    if(bitmap.width!==256||bitmap.height!==256) throw Error('Unexpected terrain tile dimensions');
    const canvas=new OffscreenCanvas(256,256), ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(bitmap,0,0); bitmap.close();
    const rgba=ctx.getImageData(0,0,256,256).data, values=new Float32Array(65536);
    for(let i=0;i<values.length;i++) {if(rgba[i*4+3]!==255) throw Error('No-data terrain tile');values[i]=decode(rgba[i*4],rgba[i*4+1],rgba[i*4+2]);}
    requests.push({url,sha256:hash,bytes:bytes.byteLength,ms:performance.now()-start,cached});
    return values;
  })();
  memory.set(url,p);
  try { const result=await p; if(memory.size>160) memory.delete(memory.keys().next().value!); return result; }
  catch(e) {memory.delete(url);throw e;}
}
/** Local spherical metres, north-up game arrays, bilinear pixel-centre sampling across seams. */
export async function sample(lat:number,lon:number,size:number,mpt:number,halo=0,sampleSize=size) {
  const spacing=mpt*size/sampleSize, W=sampleSize+2*halo;
  const z=Math.max(0,Math.min(14,Math.ceil(Math.log2(156543.033928*Math.cos(lat*DEG)/spacing))));
  const xs=new Float64Array(W), ys=new Float64Array(W);
  for(let x=0;x<W;x++) xs[x]=pixel(lat,lon+(x-halo-(sampleSize-1)/2)*spacing/(R*Math.cos(lat*DEG))/DEG,z)[0]-.5;
  for(let y=0;y<W;y++) {
    const latitude=lat+(y-halo-(sampleSize-1)/2)*spacing/R/DEG;
    if(Math.abs(latitude)>85.05112878) throw Error('Area crosses Mercator limit.');
    ys[y]=pixel(latitude,lon,z)[1]-.5;
  }
  const keys=new Map<string,[number,number]>();
  for(const px of xs) for(const py of ys) for(const dx of [0,1]) for(const dy of [0,1]) {
    const tx=Math.floor((Math.floor(px)+dx)/256), ty=Math.floor((Math.floor(py)+dy)/256); keys.set(`${tx}/${ty}`,[tx,ty]);
  }
  if(keys.size>100) throw Error('Area needs too many tiles. Try a smaller area.');
  const entries=[...keys], loaded=new Map<string,Float32Array>();let next=0;
  await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{while(next<entries.length){const [key,[x,y]]=entries[next++];loaded.set(key,await tile(z,x,y));}}));
  const at=(x:number,y:number)=>loaded.get(`${Math.floor(x/256)}/${Math.floor(y/256)}`)![((y%256+256)%256)*256+((x%256+256)%256)];
  const raw=new Float32Array(W*W);
  for(let y=0;y<W;y++) for(let x=0;x<W;x++) {
    const px=xs[x],py=ys[y], ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    raw[y*W+x]=(1-fy)*((1-fx)*at(ix,iy)+fx*at(ix+1,iy))+fy*((1-fx)*at(ix,iy+1)+fx*at(ix+1,iy+1));
  }
  return {raw,W,z,pixelMetres:156543.033928*Math.cos(lat*DEG)/2**z};
}
