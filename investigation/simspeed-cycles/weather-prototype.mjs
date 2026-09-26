import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const read=f=>readFileSync('weather/reference/'+f,'utf8').replaceAll('\r\n','\n');
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing prototype anchor '+a);return s.replace(a,b);};
function save(variant,file,code){mkdirSync('weather/prototypes/'+variant,{recursive:true});writeFileSync('weather/prototypes/'+variant+'/'+file,code.replaceAll('../../../../src/','../../../../../src/'));}
function sparseWater(code){
  code=replace(code,'    private readonly nb: Int32Array;',`    private readonly nb: Int32Array;
    // Conservative radius-two support of old contamination, rebuilt each substep.
    private readonly contaminationMark: Int32Array;
    private readonly contaminationFrontier: Int32Array;
    private contaminationStamp = 0;`);
  code=replace(code,'        this.nb = new Int32Array(4 * N);',`        this.nb = new Int32Array(4 * N);
        this.contaminationMark = new Int32Array(N);
        this.contaminationFrontier = new Int32Array(N);`);
  code=replace(code,'    private substep(): void {',`    /** Mixing reaches one edge and diffusion reaches one further edge. Outside that
     * support all concentrations and relevant mixed neighbours are positive zero.
     * Dense contamination uses the unchanged full passes. No water work is skipped. */
    private contaminationSupport(): number {
        const mark = this.contaminationMark, list = this.contaminationFrontier, C = this.C, nb = this.nb;
        if (++this.contaminationStamp === 2147483647) { mark.fill(0); this.contaminationStamp = 1; }
        const s = this.contaminationStamp;
        let n = 0;
        for (let a = 0; a < this.activeCount; a++) {
            const i = this.active[a];
            // Preserve signed-zero behaviour by treating negative zero as a seed too.
            if (C[i] !== 0 || Object.is(C[i], -0)) { mark[i] = s; list[n++] = i; }
            if (n > this.activeCount / 4) return 0;
        }
        let begin = 0, end = n;
        for (let radius = 0; radius < 2; radius++) {
            for (let a = begin; a < end; a++) {
                const i = list[a];
                for (let k = 0; k < 4; k++) {
                    const j = nb[4 * i + k];
                    if (j >= 0 && mark[j] !== s) { mark[j] = s; list[n++] = j; }
                }
            }
            begin = end; end = n;
        }
        return s;
    }

    private substep(): void {`);
  code=replace(code,'        const buf = this.buf, count = this.count, flags = this.flags;',`        const buf = this.buf, count = this.count, flags = this.flags;
        const support = this.contaminationSupport(), supportMark = this.contaminationMark;`);
  code=replace(code,'            count[c] = 0; flags[c] = 0; buf[c] = 0;',`            count[c] = 0; flags[c] = 0; buf[c] = 0;
            if (support && supportMark[c] !== support) continue;`);
  code=replace(code,'            if (!(Dc > 0)) { C[c] = 0; continue; }',`            if (!(Dc > 0)) { C[c] = 0; continue; }
            if (support && supportMark[c] !== support) continue;`);
  return code;
}
function cacheSoil(code){
  code=replace(code,'        if (full || this.first) for', '        const initializing = full || this.first;\n        if (initializing) for');
  code=replace(code,`                if (bad !== this.pBad[i] || (bad >= 0 && surf !== this.pSurf[i]))
                    for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) addC(j); }
            };`,`                if (bad !== this.pBad[i] || (bad >= 0 && surf !== this.pSurf[i]))
                    for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) addC(j); }
                // No other check reads this tile's old descriptors. Publish the exact
                // values already calculated, after all of this tile's comparisons.
                this.pWet[i] = wet; this.pSurf[i] = surf; this.pDepth[i] = depth;
                this.pC[i] = c; this.pSat[i] = sat[i]; this.pGive[i] = give; this.pBad[i] = bad;
            };`);
  code=replace(code,'            for (let k = 0; k < this.prevWetCount; k++) check(this.prevWetList[k]);',`            // A still-wet tile was already checked; repeated add/addC calls were no-ops.
            for (let k = 0; k < this.prevWetCount; k++) {
                const i = this.prevWetList[k]; if (!(D[i] > 0)) check(i);
            }`);
  code=replace(code,'        // Remember the water this pass read.', '        // The first/full pass does not execute check; initialize its descriptors here.\n        if (initializing) {\n        // Remember the water this pass read.');
  code=replace(code,'        // MoistureCalculationTask: read last tick\'s values, then write.', '        }\n\n        // MoistureCalculationTask: read last tick\'s values, then write.');
  return code;
}
function sparseSaturation(code){
  code=replace(code,'    private readonly wn: Uint8Array;',`    private readonly wn: Uint8Array;
    private readonly countMark: Uint8Array;
    private readonly saturationMark: Uint8Array;
    private readonly countDirty: Int32Array;
    private readonly saturationDirty: Int32Array;`);
  code=replace(code,'        this.wn = new Uint8Array(N);',`        this.wn = new Uint8Array(N);
        this.countMark = new Uint8Array(N);
        this.saturationMark = new Uint8Array(N);
        this.countDirty = new Int32Array(N);
        this.saturationDirty = new Int32Array(N);`);
  const begin=code.indexOf('        let wc = 0;'),end=code.indexOf('        // WaterEvaporationCalculationTask.',begin);
  if(begin<0||end<0)throw Error('Saturation anchors');
  code=code.slice(0,begin)+`        let wc = 0, countN = 0, saturationN = 0;
        const cm = this.countMark, sm = this.saturationMark, cd = this.countDirty, sd = this.saturationDirty;
        const addCount = (i: number) => { if (!cm[i]) { cm[i] = 1; cd[countN++] = i; } };
        const addSaturation = (i: number) => { if (!sm[i]) { sm[i] = 1; sd[saturationN++] = i; } };
        for (let i = 0; i < N; i++) {
            const wet = D[i] > 0 ? 1 : 0;
            if (wet) this.wetList[wc++] = i;
            if (wet !== this.pWet[i]) {
                addCount(i);
                for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0) addCount(j); }
            }
        }
        this.wetCount = wc;
        // Only a changed wet bit (own or one of eight neighbours) can alter wn.
        for (let k = 0; k < countN; k++) {
            const i = cd[k]; cm[i] = 0;
            let c = 0;
            if (D[i] > 0) {
                c = 1;
                for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0 && D[j] > 0) c++; }
            }
            if (c !== wn[i]) {
                wn[i] = c;
                addSaturation(i);
                for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) addSaturation(j); }
            }
        }
        // All counts are final before any saturation reads them. The per-tile order is unchanged.
        for (let k = 0; k < saturationN; k++) {
            const i = sd[k]; sm[i] = 0;
            if (!(D[i] > 0)) { sat[i] = 0; continue; }
            let s = wn[i];
            for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0 && wn[j] > s) s = wn[j] - 1; }
            sat[i] = s > MAX_SAT ? MAX_SAT : s;
        }
`+code.slice(end);
  return code;
}
function wasmWater(code,sparse){
  code='declare const __waterWasm: WebAssembly.Module;\n'+code;
  code=replace(code,'    private readonly nb: Int32Array;','    private readonly kernel: any;\n    private readonly nb: Int32Array;');
  const keys=['F','dam','D','Dold','C','out','evapBuffered','evapCurrent','f','buf','count','flags','wall','mark','wet','prevWet','active','sourceCells','nb',...(sparse?['contaminationMark','contaminationFrontier']:[])];
  code=replace(code,'        for (let i = 0; i < N; i++) if (this.D[i] > 0) this.wet[this.wetCount++] = i;',`        for (let i = 0; i < N; i++) if (this.D[i] > 0) this.wet[this.wetCount++] = i;
        this.kernel = new WebAssembly.Instance(__waterWasm, { env: { abort: () => { throw new Error('Water kernel aborted'); } } }).exports;
        const fields = ${JSON.stringify(keys)};
        let bytes = 0;
        for (const key of fields) { const value = (this as any)[key]; if (value) bytes += (value.byteLength + 7) & ~7; }
        let cursor = this.kernel.alloc(bytes);
        const memory = (this.kernel.memory as WebAssembly.Memory).buffer;
        for (const key of fields) {
            const value = (this as any)[key]; if (!value) continue;
            const view = new value.constructor(memory, cursor, value.length); view.set(value);
            (this as any)[key] = view; cursor += (value.byteLength + 7) & ~7;
        }`);
  code=replace(code,'    private substep(): void {',`    private substep(): void {
        // Historical fidelity switches keep their untouched JS implementation.
        if (this.legacy.bookkeeping || this.legacy.contamination) return this.substepJS();
        const D = this.D, out = this.out, f = this.f;
        for (let k = 0; k < this.prevWetCount; k++) {
            const i = this.prevWet[k], b = 4 * i;
            f[b] = f[b + 1] = f[b + 2] = f[b + 3] = 0;
            if (!(D[i] > 0)) out[b] = out[b + 1] = out[b + 2] = out[b + 3] = 0;
        }
        this.buildActive();
        const p = (a: ArrayBufferView | null) => a ? a.byteOffset : 0;
        this.kernel.hydraulics(p(this.F), p(D), p(this.Dold), p(out), p(f), p(this.dam), p(this.nb),
            p(this.wall), p(this.wet), this.wetCount, p(this.active), this.activeCount, p(this.evapBuffered));
        const support = ${sparse?'this.contaminationSupport()':'0'};
        this.kernel.contamination(p(this.F), p(D), p(this.C), p(out), p(this.dam), p(this.nb),
            p(this.active), this.activeCount, p(this.buf), p(this.count), p(this.flags), ${sparse?'p(this.contaminationMark)':'0'}, support);
        this.sourcesStep();
        this.finishSubstep();
    }

    private substepJS(): void {`);
  return code;
}
save('water-sparse','game-water.ts',sparseWater(read('game-water.ts')));
save('water-wasm','game-water.ts',wasmWater(read('game-water.ts'),false));
save('combined','game-water.ts',wasmWater(sparseWater(read('game-water.ts')),true));
save('soil-cache','game-soil.ts',cacheSoil(read('game-soil.ts')));
save('soil-saturation','game-soil.ts',sparseSaturation(read('game-soil.ts')));
save('combined','game-soil.ts',cacheSoil(sparseSaturation(read('game-soil.ts'))));
console.log('Generated four exact-weather prototypes and their combined copies');
