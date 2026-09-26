// Diagnostic colour transforms of our captures, matching tools/capture-look.ts.
// Machado et al. (2009), severity 1, in linear RGB. No game/reference images.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  for(const name of ['river-128-start','river-128-soil','river-256-meeting']){
    const image=readFileSync(`captures/${name}.jpg`).toString('base64');
    const result=await page.evaluate(async({image})=>{
      const img=new Image();img.src=`data:image/jpeg;base64,${image}`;await img.decode();
      const source=document.createElement('canvas');source.width=960;source.height=Math.round(img.height*960/img.width);
      const g=source.getContext('2d');g.drawImage(img,0,0,source.width,source.height);
      const original=g.getImageData(0,0,source.width,source.height);
      const out=document.createElement('canvas');out.width=960;out.height=(source.height+27)*4;
      const context=out.getContext('2d');
      const matrices={
        Greyscale:[.2126,.7152,.0722,.2126,.7152,.0722,.2126,.7152,.0722],
        Protanopia:[.152286,1.052583,-.204868,.114503,.786281,.099216,-.003882,-.048116,1.051998],
        Deuteranopia:[.367322,.860646,-.227968,.280085,.672501,.047413,-.01182,.04294,.968881],
        Tritanopia:[1.255528,-.076749,-.178779,-.078411,.930809,.147602,.004733,.691367,.3039],
      };
      const linear=v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4;
      const encode=v=>Math.min(255,Math.max(0,Math.round(255*(v<=.0031308?v*12.92:1.055*Math.max(0,v)**(1/2.4)-.055))));
      let row=0;
      for(const[name,m]of Object.entries(matrices)){
        const data=new ImageData(source.width,source.height),s=original.data;
        for(let k=0;k<s.length;k+=4){const r=linear(s[k]),gg=linear(s[k+1]),b=linear(s[k+2]);for(let c=0;c<3;c++)data.data[k+c]=encode(m[c*3]*r+m[c*3+1]*gg+m[c*3+2]*b);data.data[k+3]=255;}
        g.putImageData(data,0,0);
        const y=row++*(source.height+27);context.fillStyle='#edf0e8';context.fillRect(0,y,960,27);context.fillStyle='#263c35';context.font='14px sans-serif';context.fillText(`${name} · Standard left / High right`,14,y+19);context.drawImage(source,0,y+27);
      }
      return out.toDataURL('image/jpeg',.72).split(',')[1];
    },{image});
    writeFileSync(`captures/${name}-readability.jpg`,Buffer.from(result,'base64'));
    console.log('Readability sheet',name);
  }
}finally{await browser.close();}
