// Unmanaged views are just addresses. No headers, GC objects, or bounds conversions.
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
export function hydraulics(F: F64, D: F64, Dold: F64, out: F64, f: F64, dam: F64 | null, nb: I32,
  wall: U8, wet: I32, wetCount: i32, act: I32, activeCount: i32, evap: F64): void {
        // OutflowsUpdateTask, for every wet tile, from the start-of-substep state.
        for (let w = 0; w < wetCount; w++) {
            const c = wet[w], Fc = F[c], Dc = D[c], Hc = Fc + Dc, b = 4 * c;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k], inside = n >= 0;
                const Fn = inside ? F[n] : 0, Dn = inside ? D[n] : 0;
                if (wall[c] & (1 << k) || Fn >= Hc) { f[b + k] = 0; continue; }
                let e = Hc - (Fn + Dn);
                let prev = KEEP * out[b + k];
                let fk: f64;
                const lim = inside ? limit(F, dam, c, n, Hc) : -1;
                if (lim >= 0) {
                    prev *= DAM_KEEP;
                    const hd = Hc - Fn;
                    if (hd < lim) {
                        const a = clamp01(clamp01((lim - hd) / 0.1) * clamp(1 - 2.25 * (Hc - (Fc + Dold[c])), 0.5, 2));
                        fk = prev - 0.02 * a;
                    } else {
                        if (hd - lim < 0.1 && e > 0) e *= (hd - lim) / 0.1;
                        fk = prev + K * e;
                    }
                } else {
                    // The padding outside the map is an open column: floor 0, never wet.
                    if (Dn === 0 && Fn === Fc && (inside || !false)) e -= SPILL;
                    fk = prev + K * e;
                }
                f[b + k] = fk > 0 ? fk : 0;
            }
            const s = f[b] + f[b + 1] + f[b + 2] + f[b + 3];
            if (s * DT > Dc) {
                const r = Dc / (s * DT);
                f[b] *= r; f[b + 1] *= r; f[b + 2] *= r; f[b + 3] *= r;
            }
        }

        for (let a = 0; a < activeCount; a++) {
            const c = act[a], b = 4 * c;
            let net: f64 = 0;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k], inflow = n >= 0 ? f[4 * n + ((k + 2) & 3)] : 0, outflow = f[b + k];
                net += inflow - outflow;
                const m = outflow - inflow * BAL;
                out[b + k] = outflow > 0 && m > 0 ? m : 0;
            }
            const Dc = D[c];
            const rate = false && !(Dc > 0) ? 0 : (Dc < FAST_DEPTH ? FAST : NORMAL) * evap[c];
            Dold[c] = Dc;
            const d1 = Dc + (net - rate) * DT;
            D[c] = d1 > 0 ? d1 : 0;
        }
}
export function contamination(F: F64, D: F64, C: F64, out: F64, dam: F64 | null, nb: I32,
  act: I32, activeCount: i32, buf: F64, count: U8, flags: U8, supportMark: I32, support: i32): void {
        // SimulateContaminationTask: mix by the net stored flow from each neighbour, after the depth
        // update; mark neighbours that exchange slowly at nearly equal surfaces for diffusion.

        for (let a = 0; a < activeCount; a++) {
            const c = act[a];
            count[c] = 0; flags[c] = 0; buf[c] = 0;
            if (support && supportMark[c] != support) continue;
            const Dc = D[c];
            if (!(Dc > 0)) continue;
            let received: f64 = 0, change: f64 = 0;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k];
                const net = (n >= 0 ? out[4 * n + ((k + 2) & 3)] : 0) - out[4 * c + k];
                if (net === 0) continue;
                const amount = net * DT;
                if (amount > 0) { received += amount; change += amount * C[n]; }
                if (n < 0 || net >= DIFFUSION_FLOW || net <= -DIFFUSION_FLOW) continue;
                if (dam && ((Dc <= 1 && dam[c] >= 0) || (D[n] <= 1 && dam[n] >= 0))) continue;
                if (!(D[n] > 0)) continue;
                const hn = D[n] + F[n], hc = Dc + F[c];
                if ((hn > hc ? hn - hc : hc - hn) > DIFFUSION_HEIGHT) continue;
                flags[c] |= 1 << k;
                count[c]++;
            }
            if (received > 0) {
                const v = (C[c] * (Dc - received) + change) / Dc;
                buf[c] = v < 0 ? 0 : v > 1 ? 1 : v;
            } else buf[c] = C[c];
        }
        // UpdateContaminationTask.
        for (let a = 0; a < activeCount; a++) {
            const c = act[a], Dc = D[c];
            if (!(Dc > 0)) { C[c] = 0; continue; }
            if (support && supportMark[c] != support) continue;
            let v = buf[c];
            if (count[c]) {
                let sum: f64 = 0;
                const share: f64 = 1 / f64(count[c]);
                for (let k = 0; k < 4; k++) {
                    if (!(flags[c] & (1 << k))) continue;
                    const n = nb[4 * c + k], delta = buf[n] - buf[c];
                    const amount = delta > 0 ? Math.min(delta, buf[n] / count[n]) : Math.max(delta, -share * buf[c]);
                    sum += D[n] / (Dc + D[n]) * amount * DIFFUSION_RATE;
                }
                v += sum * DT;
            }
            C[c] = v > 1 ? 1 : v;
        }
}
