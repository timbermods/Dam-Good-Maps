// Tiny software renderer for our generated heightfields. No imported assets or image packages.
import { deflateSync } from 'node:zlib';
function crc32(buf) {
  let c=0xffffffff;
  for(const b of buf) { c^=b; for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0); }
  return (c^0xffffffff)>>>0;
}
function chunk(type, data) {
  const name=Buffer.from(type), len=Buffer.alloc(4), crc=Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([len,name,data,crc]);
}
export function render(h, d, W, H, cap) {
  const width=640, height=470, rgba=Buffer.alloc(width*height*4);
  for(let i=0;i<width*height;i++)rgba.set([239,237,226,255],i*4);
  function polygon(pts,color) {
    const minY=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))));
    const maxY=Math.min(height-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
    for(let y=minY;y<=maxY;y++) {
      const xs=[];
      for(let i=0;i<pts.length;i++) {
        const a=pts[i],b=pts[(i+1)%pts.length], yy=y+.5;
        if((a[1]<=yy && b[1]>yy)||(b[1]<=yy && a[1]>yy))xs.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);
      for(let k=0;k+1<xs.length;k+=2)for(let x=Math.max(0,Math.ceil(xs[k]));x<Math.min(width,xs[k+1]);x++)rgba.set([...color,255],(y*width+x)*4);
    }
  }
  const scale=290/W, sy=scale*.51, sz=5;
  const point=(x,y,z)=>[320+(x-y)*scale,145+(x+y)*sy-z*sz];
  for(let sum=0;sum<W+H-1;sum++)for(let y=0;y<H;y++) {
    const x=sum-y;if(x<0||x>=W)continue;
    const i=y*W+x,z=h[i], a=point(x,y,z),b=point(x+1,y,z),c=point(x+1,y+1,z),e=point(x,y+1,z);
    const hx=x+1<W?h[i+1]:0,hy=y+1<H?h[i+W]:0;
    if(z>hx)polygon([b,c,point(x+1,y+1,hx),point(x+1,y,hx)],[99,107,96]);
    if(z>hy)polygon([e,c,point(x+1,y+1,hy),point(x,y+1,hy)],[126,130,110]);
    const t=z/cap;
    const color=d.keep[i]?[40,137,160]:[Math.round(145+55*t),Math.round(167+29*t),Math.round(107+42*t)];
    polygon([a,b,c,e],color);
  }
  const scan=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++)rgba.copy(scan,y*(1+width*4)+1,y*width*4,(y+1)*width*4);
  const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
