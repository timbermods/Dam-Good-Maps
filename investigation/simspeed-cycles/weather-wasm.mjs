// Generate the scalar WASM kernels from the pinned reference's ordered expressions.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import asc from 'assemblyscript/asc';
import binaryen from 'binaryen';
const ref=readFileSync('weather/reference/game-water.ts','utf8').replaceAll('\r\n','\n');
const cut=(a,b)=>{const i=ref.indexOf(a),j=ref.indexOf(b,i);if(i<0||j<0)throw Error('Kernel anchor');return ref.slice(i,j);};
let flow=cut('        // OutflowsUpdateTask,','        // WaterParametersUpdateTask:');
let depth=cut('        for (let a = 0; a < this.activeCount; a++) {','        if (mixed) {\n            for (let a');
depth=depth.slice(0,depth.indexOf('            if (mixed) {'))+'        }\n';
let contamination=cut('        // SimulateContaminationTask:','\n        this.sourcesStep();\n        this.finishSubstep();');
contamination=contamination.replace('        const buf = this.buf, count = this.count, flags = this.flags;','');
function convert(s){return s.replaceAll('this.wetCount','wetCount').replaceAll('this.activeCount','activeCount').replaceAll('this.wet[','wet[')
  .replaceAll('this.Dold[','Dold[').replaceAll('this.legacy.bookkeeping','false').replaceAll('legacy.bookkeeping','false')
  .replaceAll('this.limit(c, n, Hc)','limit(F, dam, c, n, Hc)').replaceAll('OPP[k]','((k + 2) & 3)')
  .replaceAll('let fk: number;','let fk: f64;').replaceAll('let net = 0;','let net: f64 = 0;')
  .replaceAll('let received = 0, change = 0;','let received: f64 = 0, change: f64 = 0;').replaceAll('let sum = 0;','let sum: f64 = 0;')
  .replaceAll('const share = 1 / count[c];','const share: f64 = 1 / f64(count[c]);');}
contamination=convert(contamination)
  .replace('            count[c] = 0; flags[c] = 0; buf[c] = 0;','            count[c] = 0; flags[c] = 0; buf[c] = 0;\n            if (support && supportMark[c] != support) continue;')
  .replace('            if (!(Dc > 0)) { C[c] = 0; continue; }','            if (!(Dc > 0)) { C[c] = 0; continue; }\n            if (support && supportMark[c] != support) continue;');
const views=`// Unmanaged views are just addresses. No headers, GC objects, or bounds conversions.
@unmanaged class F64 {
  @inline @operator("[]") get(i: i32): f64 { return load<f64>(changetype<usize>(this) + (usize(i) << 3)); }
  @inline @operator("[]=") set(i: i32, v: f64): void { store<f64>(changetype<usize>(this) + (usize(i) << 3), v); }
}
@unmanaged class I32 {
  @inline @operator("[]") get(i: i32): i32 { return load<i32>(changetype<usize>(this) + (usize(i) << 2)); }
  @inline @operator("[]=") set(i: i32, v: i32): void { store<i32>(changetype<usize>(this) + (usize(i) << 2), v); }
}
@unmanaged class U8 {
  @inline @operator("[]") get(i: i32): i32 { return load<u8>(changetype<usize>(this) + usize(i)); }
  @inline @operator("[]=") set(i: i32, v: i32): void { store<u8>(changetype<usize>(this) + usize(i), u8(v)); }
}
export function alloc(bytes: i32): usize { return heap.alloc(usize(bytes)); }
const DT: f64 = 0.3, K: f64 = 2.25 * DT, SPILL: f64 = 0.1, KEEP: f64 = 0.999;
const DAM_KEEP: f64 = 0.995, BAL: f64 = 0.8, FAST_DEPTH: f64 = 0.02, FAST: f64 = 0.001, NORMAL: f64 = 0.0001;
const DIFFUSION_FLOW: f64 = 0.125, DIFFUSION_HEIGHT: f64 = 0.1, DIFFUSION_RATE: f64 = 0.45;
@inline function clamp01(v: f64): f64 { return v < 0 ? 0 : v > 1 ? 1 : v; }
@inline function clamp(v: f64, lo: f64, hi: f64): f64 { return v < lo ? lo : v > hi ? hi : v; }
@inline function limit(F: F64, dam: F64 | null, c: i32, n: i32, Hc: f64): f64 {
  if (!dam || n < 0) return -1;
  const lim = dam[n];
  return lim >= 0 && F[c] <= F[n] && F[n] < Math.ceil(Hc) ? lim : -1;
}
`;
const hydraulic=`export function hydraulics(F: F64, D: F64, Dold: F64, out: F64, f: F64, dam: F64 | null, nb: I32,
  wall: U8, wet: I32, wetCount: i32, act: I32, activeCount: i32, evap: F64): void {
${convert(flow)}${convert(depth)}}\n`;
const transport=`export function contamination(F: F64, D: F64, C: F64, out: F64, dam: F64 | null, nb: I32,
  act: I32, activeCount: i32, buf: F64, count: U8, flags: U8, supportMark: I32, support: i32): void {
${contamination}}\n`;
writeFileSync('weather/kernel.ts',views+hydraulic+transport);
binaryen.setFastMath(false);
// asc changes Binaryen's global fast-math flag. Emit without its optimization
// pass, then explicitly optimize the emitted module with fast math disabled.
const options=['weather/kernel.ts','--outFile','.work/weather/kernel-unoptimized.wasm','--textFile','.work/weather/kernel-unoptimized.wat','--runtime','stub','--optimizeLevel','0','--shrinkLevel','0','--noAssert'];
const result=await asc.main(options);
if(result.error){console.error(result.stderr.toString());throw result.error;}
binaryen.setFastMath(false);binaryen.setOptimizeLevel(3);binaryen.setShrinkLevel(0);
const module=binaryen.readBinary(readFileSync('.work/weather/kernel-unoptimized.wasm'));
module.optimize();if(!module.validate())throw Error('Invalid strict kernel');
if(binaryen.getFastMath())throw Error('Fast math unexpectedly enabled');
const code=Buffer.from(module.emitBinary()),wat=module.emitText();
writeFileSync('.work/weather/kernel.wasm',code);writeFileSync('weather/kernel.wat',wat);module.dispose();
if(/f32\.|v128|relaxed|f64x2|f32x4/.test(wat))throw Error('Unexpected reduced precision or SIMD');
writeFileSync('weather/kernel-bytes.json',JSON.stringify({sha256:createHash('sha256').update(code).digest('hex'),base64:code.toString('base64')})+'\n');
writeFileSync('results/weather/compiler.json',JSON.stringify({assemblyscript:asc.version,binaryenFastMath:binaryen.getFastMath(),options,strictBinaryenOptimizeLevel:3,strictBinaryenShrinkLevel:0,bytes:code.length,
  scalarF64:true,float32Instructions:false,simd:false,relaxedSimd:false,sha256:createHash('sha256').update(code).digest('hex')},null,2)+'\n');
console.log('Compiled scalar water kernel',code.length,'bytes; fastMath:',binaryen.getFastMath());
