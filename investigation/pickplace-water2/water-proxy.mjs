// Proposal only: same handler can run as a Cloudflare Worker. No deployment.
export const upstream='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/';
export async function waterProxy(request) {
  const name=new URL(request.url).pathname.split('/').at(-1);
  if(request.method!=='GET'||!/^ESA_WorldCover_10m_2021_v200_[NS]\d{2}[EW]\d{3}_Map\.tif$/.test(name))return new Response('Unknown dataset',{status:400});
  const range=request.headers.get('range'),match=/^bytes=(\d+)-(\d+)$/.exec(range??'');
  if(!match||!Number.isSafeInteger(Number(match[1]))||!Number.isSafeInteger(Number(match[2]))||Number(match[2])<Number(match[1])||Number(match[2])-Number(match[1])>=8*1024*1024)return new Response('One bounded byte range required',{status:400});
  const r=await fetch(upstream+name,{headers:{Range:range},signal:AbortSignal.timeout(30000)});
  const headers=new Headers({'Content-Type':'application/octet-stream','Cache-Control':'public, max-age=86400'});
  for(const h of ['content-range','etag','last-modified'])if(r.headers.has(h))headers.set(h,r.headers.get(h));
  if(r.status!==206)return new Response('Dataset unavailable',{status:r.status===404?404:502});
  return new Response(r.body,{status:206,headers});
}
export default {fetch:waterProxy};
