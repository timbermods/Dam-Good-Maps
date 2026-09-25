// Shared by Node and Chromium. All assertions compare bytes, including signed zero.
export const variants = ['baseline', 'saturation', 'topology', 'clear', 'unroll', 'drought', 'combined'];
export const themes = ['riverValley', 'canyon', 'highlands', 'lakeBasin', 'islands', 'delta'];
const cpuNow = () => globalThis.simCpuUsage ? globalThis.simCpuUsage() : null;
const cpuElapsed = before => before ? (() => { const after=cpuNow(); return (after.user-before.user+after.system-before.system)/1000; })() : null;
export async function load() {
  globalThis.simBuildId=(await import('./.work/bundles/version.mjs')).buildId;
  return Object.fromEntries(await Promise.all(variants.map(async v => [v, await import('./.work/bundles/' + v + '.mjs')])));
}
export function bytes(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }
export function equal(a, b, label) {
  a = bytes(a); b = bytes(b);
  if (a.length !== b.length) throw new Error(label + ': byte length');
  const n = a.length;
  const av = new DataView(a.buffer, a.byteOffset, n), bv = new DataView(b.buffer, b.byteOffset, n);
  let i = 0;
  for (; i + 4 <= n; i += 4) if (av.getUint32(i) !== bv.getUint32(i)) throw new Error(label + ': byte ' + i);
  for (; i < n; i++) if (a[i] !== b[i]) throw new Error(label + ': byte ' + i);
}
export async function sha(a) {
  const hash = await crypto.subtle.digest('SHA-256', bytes(a));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export function snapshot(s) {
  return {D:s.D.slice(), C:s.C.slice(), Dold:s.Dold.slice(), out:s.out.slice(), sat:s.saturation(), volume:s.volume(), ticks:s.ticks};
}
export function compare(a, b, label) {
  for (const k of Object.keys(a)) {
    if (ArrayBuffer.isView(a[k])) equal(a[k], b[k], label + '/' + k);
    else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) throw new Error(label + '/' + k);
  }
}
export async function digest(s) {
  const result = {};
  for (const k of Object.keys(s)) result[k] = ArrayBuffer.isView(s[k]) ? await sha(s[k]) : typeof s[k]==='string' ? await sha(new TextEncoder().encode(s[k])) : s[k];
  return result;
}
export function editedModel(m, depth) {
  const floor = m.floor.slice(), W = m.W, H = m.H;
  let center = (H >> 1) * W + (W >> 1);
  for (let i = 0; i < depth.length; i++) {
    const x = i % W, y = (i - x) / W;
    if (x > 5 && x < W - 6 && y > 5 && y < H - 6 && depth[i] > .3) {center=i; break;}
  }
  const cx = center % W, cy = (center - cx) / W;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = (cy + dy) * W + cx + dx; floor[i] = Math.max(0, floor[i] - 2);
  }
  return {...m, floor};
}
export async function verifyMap(api, {theme, size, seed}) {
  const spec = api.baseline.makeSpec({theme, seed, size:{x:size,y:size}});
  const generated = {}, timings = {}, hashes = {}, cpuTimings = {};
  for (const v of variants) {
    const cpu=cpuNow(), t = performance.now(); generated[v] = api[v].generate(spec); timings[v] = performance.now() - t; cpuTimings[v]=cpuElapsed(cpu);
    if (!generated[v].report.passed || !generated[v].bytes.length) throw new Error(v + ': generation failed ' + JSON.stringify({theme,size,seed}));
    hashes[v] = await sha(generated[v].bytes);
    if (v !== 'baseline') {
      equal(generated.baseline.bytes, generated[v].bytes, v + '/timber');
      for (const k of ['water','contamination','moisture','soilContamination','heights'])
        equal(generated.baseline.built[k], generated[v].built[k], v + '/built/' + k);
      compare(generated.baseline.built.settle, generated[v].built.settle, v + '/settle');
      if (JSON.stringify(generated.baseline.report) !== JSON.stringify(generated[v].report)) throw new Error(v + '/report');
    }
  }
  const b = generated.baseline.built, m = b.waterModel, checkpoints = [];
  const next = editedModel(m, b.water);
  for (const mode of ['canonical', 'warm']) {
    const sims = {}, runs = {};
    for (const v of variants) {
      const a = api[v];
      const init = mode === 'canonical' ? {state:a.prefill(m),out:null} : a.warmStart({model:m,water:b.settle}, next);
      const s = sims[v] = new a.WaterSim(mode === 'canonical' ? m : next, init.state);
      if (init.out) s.out.set(init.out);
      runs[v] = new a.SettleRun(s, mode === 'canonical' ? {} : {checkEvery:64,maxDays:1,movedShare:.0005,tol:.05});
    }
    let done = false;
    while (!done) {
      const results = {};
      for (const v of variants) results[v] = runs[v].advance(mode === 'canonical' ? 128 : 64);
      const ref = snapshot(sims.baseline);
      for (const v of variants.slice(1)) {
        compare(ref, snapshot(sims[v]), v + '/' + mode);
        if (JSON.stringify(results[v]) !== JSON.stringify(results.baseline)) throw new Error(v + ': stopping schedule');
      }
      checkpoints.push({mode, ...await digest(ref)});
      done = !!results.baseline;
    }
  }
  const drought = [];
  for (const days of [0,1,9,25]) {
    const ref = api.baseline.droughtStorage(m,b.water,days);
    for (const v of variants.slice(1)) equal(ref,api[v].droughtStorage(m,b.water,days),v + '/drought/' + days);
    drought.push({days, sha256:await sha(ref)});
  }
  return {buildId:globalThis.simBuildId,theme,size,seed,hashes,timings,cpuTimings,checkpoints,drought,accepted:generated.baseline.spec.accepted};
}
export function cases(a) {
  const first = mode => a.schedule(mode,1729).find(p=>p.weather==='drought');
  const bad = a.schedule('normal',1729).find(p=>p.weather==='badtide');
  const later = a.schedule('hard',1729,40).find(p=>p.weather==='drought' && p.occurrence===13);
  return [
    {id:'normal', phases:[{weather:'normal',days:a.schedule('normal',1729)[0].days,cycle:1,occurrence:1}]},
    ...['easy','normal','hard'].map(mode=>({id:'first-'+mode,phases:[
      {weather:'normal',days:1,cycle:1,occurrence:1,next:'drought'},first(mode),
      {weather:'normal',days:3,cycle:2,occurrence:2,previous:'drought'}]})),
    {id:'first-badtide',phases:[bad,{weather:'normal',days:5,cycle:bad.cycle+1,occurrence:bad.cycle+1,previous:'badtide'}]},
    {id:'late-hard',phases:[{weather:'normal',days:1,cycle:later.cycle,occurrence:later.cycle,next:'drought'},later,
      {weather:'normal',days:5,cycle:later.cycle+1,occurrence:later.cycle+1,previous:'drought'}]}
  ];
}
function cycleSnapshot(m) {
  return {...snapshot(m.sim), M:m.M.slice(),SC:m.SC.slice(),candidates:m.candidates.slice(),
    plants:JSON.stringify(m.plants),elapsedTicks:m.elapsedTicks};
}
export async function cycles(api,builtByVariant,onProgress=()=>{},waterWithin) {
  const records = [];
  for (const scenario of cases(api.baseline)) {
    const refs = [], hashes = [], times = {}, cpuTimes = {}, simulationTimes = {}, simulationCpuTimes = {};
    for (const v of variants) {
      const initCpu=cpuNow(),initTime=performance.now();
      const m = new api[v].CycleModel(builtByVariant[v]),measure=new api[v].Measures(m,waterWithin);
      let index = 0, ms = 0, cpuMs = 0, elapsed=0, overheadMs=performance.now()-initTime, overheadCpuMs=cpuElapsed(initCpu)??0;
      const capture=(day)=>{
        const cpu=cpuNow(),t=performance.now(),metrics=measure.sample(day);
        overheadMs+=performance.now()-t;overheadCpuMs+=cpuElapsed(cpu)??0;
        return {...cycleSnapshot(m),metrics:JSON.stringify(metrics),firstDry:measure.firstDry.slice(),firstBad:measure.firstBad.slice(),firstWaterLost:measure.firstWaterLost};
      };
      const check=async s=>{
        if(v==='baseline'){refs.push(s);hashes.push(await digest(s));}
        else compare(refs[index],s,v+'/'+scenario.id+'/checkpoint/'+index);
        index++;
      };
      await check(capture(0)); // batch.ts's separate baseline sample
      for (const phase of scenario.phases) {
        const ticks = Math.round(phase.days*768);
        await check(capture(elapsed)); // CycleModel.run's phase-start callback
        for (let start = 0; start < ticks; start += 768) {
          const end = Math.min(ticks,start+768), cpu = cpuNow(), t = performance.now();
          for (let tick=start;tick<end;tick++) m.tick(phase,tick);
          ms += performance.now()-t;
          cpuMs += cpuElapsed(cpu) ?? 0;
          await check(capture(elapsed+end/768));
        }
        elapsed+=phase.days;
      }
      times[v] = ms+overheadMs;
      simulationTimes[v]=ms;
      simulationCpuTimes[v]=globalThis.simCpuUsage?cpuMs:null;
      cpuTimes[v] = globalThis.simCpuUsage ? cpuMs+overheadCpuMs : null;
      onProgress(scenario.id + ' ' + v + ' ' + Math.round(ms) + 'ms');
    }
    records.push({id:scenario.id,phases:scenario.phases,times,cpuTimes,simulationTimes,simulationCpuTimes,checkpoints:hashes});
  }
  return records;
}
export function timeStages(api, builds, repeat=3, targetMs=500) {
  const rows = [];
  const b=builds.baseline;
  const m = b.waterModel, next = editedModel(m,b.water);
  const nextByVariant=Object.fromEntries(variants.map(v=>[v,editedModel(builds[v].waterModel,builds[v].water)]));
  // Calibrate once on baseline, then use identical call counts for all variants.
  // Windows thread CPU counters are quantized; a single fast call is too short.
  function calls(fn,fallback){
    if(!targetMs)return fallback;
    const cpu=cpuNow(),t=performance.now();let n=0,elapsed=0;
    do{fn();n++;elapsed=cpu?cpuElapsed(cpu):performance.now()-t;}while(elapsed<125&&n<2048);
    return Math.max(1,Math.min(4096,Math.ceil(targetMs*n/Math.max(elapsed,1))));
  }
  const canonicalCalls=calls(()=>api.baseline.canonicalSettle(m),1);
  const previewCalls=calls(()=>api.baseline.previewSettle({model:m,water:b.settle},next),1);
  const droughtCalls=calls(()=>api.baseline.droughtStorage(m,b.water,9),20);
  for (let trial=0;trial<repeat;trial++) {
    // Rotate ordering to reduce a consistent warm/thermal ordering bias.
    const order = variants.slice(trial).concat(variants.slice(0,trial));
    for (const v of order) {
      const a = api[v],local=builds[v],lm=local.waterModel,ln=nextByVariant[v];
      const row = {variant:v,trial,timingMethod:targetMs?'batched-500ms-v3':'warmup',canonicalCalls,previewCalls,droughtCalls};
      let cpu=cpuNow(),t=performance.now(),c;
      for(let i=0;i<canonicalCalls;i++)c=a.canonicalSettle(lm);
      row.canonicalMs=(performance.now()-t)/canonicalCalls;row.canonicalTicks=c.ticks;row.canonicalCpuMs=cpuElapsed(cpu);if(row.canonicalCpuMs!==null)row.canonicalCpuMs/=canonicalCalls;
      cpu=cpuNow();t=performance.now();let p;
      for(let i=0;i<previewCalls;i++)p=a.previewSettle({model:lm,water:local.settle},ln);
      row.previewMs=(performance.now()-t)/previewCalls;row.previewTicks=p.ticks;row.previewCpuMs=cpuElapsed(cpu);if(row.previewCpuMs!==null)row.previewCpuMs/=previewCalls;
      cpu=cpuNow();t=performance.now();for(let i=0;i<droughtCalls;i++)a.droughtStorage(lm,local.water,9);
      row.droughtMs=(performance.now()-t)/droughtCalls;row.droughtCpuMs=cpuElapsed(cpu);if(row.droughtCpuMs!==null)row.droughtCpuMs/=droughtCalls;
      rows.push(row);
    }
  }
  return rows;
}
