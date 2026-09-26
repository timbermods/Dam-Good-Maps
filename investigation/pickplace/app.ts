const $=(id:string)=>document.getElementById(id)!;
let worker:Worker|null=null,downloadURL:string|null=null;
let rejectActive:((reason:Error)=>void)|null=null;
export function render(canvas:HTMLCanvasElement,h:Uint8Array,d:Float32Array,size:number,start:any) {
  canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d')!,im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=y*size+x,k=((size-1-y)*size+x)*4;
    const shade=Math.max(.5,Math.min(1.3,1+(h[i]-h[y*size+Math.max(0,x-1)])*.08));
    const color=d[i]>.05?[45,135,163]:[85+h[i]*6,105+h[i]*5,65+h[i]*5];
    for(let c=0;c<3;c++) im.data[k+c]=color[c]*shade;im.data[k+3]=255;
  }
  ctx.putImageData(im,0,0);if(start){ctx.strokeStyle='#ffdb6b';ctx.lineWidth=2;ctx.strokeRect(start.x-2,size-start.y-5,7,7);}
}
export function convert(input:any,onProgress=(s:string)=>{},onPrediction=(p:any)=>{}) {
  return new Promise<any>((resolve,reject)=>{
    const w=new Worker('./worker.js',{type:'module'});worker=w;rejectActive=reject;
    w.onmessage=e=>{if(e.data.type==='progress') onProgress(e.data.phase);else if(e.data.type==='prediction'){onPrediction(e.data.prediction);}else {w.terminate();worker=null;rejectActive=null;e.data.type==='error'?reject(Error(e.data.error)):resolve(e.data);}};
    w.onerror=e=>{w.terminate();worker=null;rejectActive=null;reject(Error(e.message));};w.postMessage(input);
  });
}
// Exposed only by this isolated investigation, to run the same UI worker in browser tests.
(window as any).pickplace={convert,render};
let generation=0;
$('form').addEventListener('submit',async e=>{
  e.preventDefault();const run=++generation;
  $('download').hidden=true;$('result').hidden=true;$('prediction').hidden=true;
  if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}
  const coords=($('coordinates') as HTMLInputElement).value.trim().split(/[,\s]+/).map(Number);
  if(coords.length!==2||coords.some(v=>!Number.isFinite(v))){$('status').textContent='Enter two decimal numbers: latitude, longitude.';return;}
  ($('generate') as HTMLButtonElement).disabled=true;($('cancel') as HTMLButtonElement).disabled=false;
  const scale=($('scale') as HTMLSelectElement).value;
  try {
    const r=await convert({lat:coords[0],lon:coords[1],size:Number(($('size') as HTMLSelectElement).value),...(scale==='auto'?{}:{mpt:Number(scale)})},s=>$('status').textContent=s,p=>{$('prediction').hidden=false;$('prediction').textContent=`Terrain preview: ${p.verdict}. ${p.warnings.join(' ')} ${p.suggestions.join(' ')}`;});
    if(run!==generation)return;
    const s=r.summary,p=s.selected.prediction;$('prediction').hidden=true;
    render($('preview') as HTMLCanvasElement,r.heights,r.depth,s.size,s.start);$('result').hidden=false;
    $('details').textContent=`${s.passed?'Prototype checks passed.':'This place needs changes.'}\n${s.selected.mpt} metres per tile · ${(s.size*s.selected.mpt/1000).toFixed(2)} km across\n${s.vertical.levels+1} terrain levels · ${(s.timings.totalMs/1000).toFixed(1)} seconds\nPreview prediction: ${p.verdict}.\n${p.warnings.join('\n')}\n${p.suggestions.join('\n')}\n${s.current.failures.map((c:any)=>c.message).join('\n')}`;
    if(s.passed) {downloadURL=URL.createObjectURL(new Blob([r.bytes],{type:'application/zip'}));const a=$('download') as HTMLAnchorElement;a.href=downloadURL;a.download=`Place-${coords[0]}-${coords[1]}-${s.size}.timber`;a.hidden=false;}
    $('status').textContent=s.passed?'Map ready.':'Conversion finished. Try another area or scale.';
  } catch(e) {if(run===generation)$('status').textContent=String(e);}
  finally {if(run===generation){($('generate') as HTMLButtonElement).disabled=false;($('cancel') as HTMLButtonElement).disabled=true;}}
});
$('cancel').addEventListener('click',()=>{generation++;worker?.terminate();worker=null;rejectActive?.(Error('Cancelled'));rejectActive=null;$('prediction').hidden=true;$('status').textContent='Cancelled.';($('generate') as HTMLButtonElement).disabled=false;($('cancel') as HTMLButtonElement).disabled=true;});
fetch('./ATTRIBUTION.md').then(r=>r.text()).then(t=>$('credits').textContent=t);
