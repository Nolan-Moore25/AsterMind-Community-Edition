// rff-worked-example.test.ts — the runnable worked example behind NB-005.
//
// This suite IS capstone deliverable 3's experiment: every table and every
// number quoted in claude-markdown-documents/research-notebooks/
// NB-005-random-fourier-features.md is printed by this file under fixed seeds.
// Re-run it with:
//
//   npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts
//
// Models under test import ONLY public AsterMind API (ADR-0006 invariant):
//   buildRFF / mapRFF   — src/pro/math/rff.ts       (the thing NB-005 derives)
//   ridgeSolvePro       — src/pro/math/krr.ts       (linear + RFF ridge fits)
//   KernelELM           — src/core/KernelELM.ts     (exact + Nyström baselines)
//
// Assertions are qualitative bounds with wide margins (accuracy floors, error
// monotonicity, algebraic identities) — never wall-clock thresholds, so the
// suite can live inside `npm test` / prepublishOnly without timing flakes.
// Timings are printed for the notebook; the ratios are the claim.

import { describe, it, expect } from 'vitest';
import { buildRFF, mapRFF, ridgeSolvePro, KernelELM } from '../../../src/index';
import type { RFF } from '../../../src/index';

/* ================= seeded randomness (reproducibility) ================= */

function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        // LCG (Numerical Recipes constants) — deterministic across platforms
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function gaussOf(rng: () => number): number {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ======================= dataset: two spirals ========================== */

function twoSpirals(n: number, rng: () => number, noise = 0.03): { X: number[][]; y: number[] } {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
        const cls = i % 2;
        const t = rng();                                   // position along the arm, 0..1
        const r = 0.1 + 0.9 * t;                           // radius 0.1 → 1.0
        const th = 3 * Math.PI * t + (cls === 1 ? Math.PI : 0); // 1.5 turns; arms offset by π
        X.push([
            r * Math.cos(th) + noise * gaussOf(rng),
            r * Math.sin(th) + noise * gaussOf(rng),
        ]);
        y.push(cls);
    }
    return { X, y };
}

const oneHot2 = (y: number[]) => y.map(c => (c === 0 ? [1, 0] : [0, 1]));

/* ============ shared helpers: ridge-on-features, timing, ascii ========= */

const time = <T>(fn: () => T): { out: T; ms: number } => {
    const t0 = performance.now();
    const out = fn();
    return { out, ms: performance.now() - t0 };
};

/**
 * Ridge fit on an explicit feature matrix Φ (N×P):
 * solve (ΦᵀΦ + λI) Θ = ΦᵀY via the library's production solver.
 * Used for both the plain-linear baseline (Φ = [1, x₁, x₂]) and RFF features.
 */
function fitRidgeOnFeatures(Phi: number[][], Yhot: number[][], lambda: number): number[][] {
    const N = Phi.length, P = Phi[0].length, K = Yhot[0].length;
    const A: number[][] = Array.from({ length: P }, () => new Array(P).fill(0));
    const B: number[][] = Array.from({ length: P }, () => new Array(K).fill(0));
    for (let n = 0; n < N; n++) {
        const row = Phi[n], yn = Yhot[n];
        for (let i = 0; i < P; i++) {
            const ri = row[i];
            if (ri === 0) continue;
            const Ai = A[i];
            for (let j = i; j < P; j++) Ai[j] += ri * row[j]; // upper triangle
            const Bi = B[i];
            for (let c = 0; c < K; c++) Bi[c] += ri * yn[c];
        }
    }
    for (let i = 0; i < P; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i]; // mirror
    return ridgeSolvePro(A, B, { lambda }).Theta;
}

const predictFeatures = (Phi: number[][], Theta: number[][]): number[] =>
    Phi.map(row => {
        const K = Theta[0].length;
        let best = 0, bestV = -Infinity;
        for (let c = 0; c < K; c++) {
            let s = 0;
            for (let i = 0; i < row.length; i++) s += row[i] * Theta[i][c];
            if (s > bestV) { bestV = s; best = c; }
        }
        return best;
    });

const linFeatures = (X: number[][]): number[][] => X.map(([a, b]) => [1, a, b]);
const rffFeatures = (rff: RFF, X: number[][]): number[][] =>
    X.map(x => Array.from(mapRFF(rff, Float64Array.from(x))));

const accuracy = (pred: number[], y: number[]): number =>
    pred.filter((p, i) => p === y[i]).length / y.length;

const argmaxRow = (rows: number[][]): number[] =>
    rows.map(r => r.indexOf(Math.max(...r)));

/** ASCII decision-boundary render: '·' = class 0 region, '█' = class 1 region. */
function asciiBoundary(predict: (X: number[][]) => number[], w = 57, h = 23, lo = -1.25, hi = 1.25): string {
    const grid: number[][] = [];
    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            grid.push([lo + (c / (w - 1)) * (hi - lo), hi - (r / (h - 1)) * (hi - lo)]);
        }
    }
    const cls = predict(grid);
    let out = '';
    for (let r = 0; r < h; r++) {
        let line = '';
        for (let c = 0; c < w; c++) line += cls[r * w + c] === 0 ? '·' : '█';
        out += line + '\n';
    }
    return out;
}

/** ASCII scatter of the dataset itself: 'o' = class 0, 'x' = class 1. */
function asciiData(X: number[][], y: number[], w = 57, h = 23, lo = -1.25, hi = 1.25): string {
    const rows = Array.from({ length: h }, () => new Array(w).fill(' '));
    X.forEach(([a, b], i) => {
        const c = Math.round(((a - lo) / (hi - lo)) * (w - 1));
        const r = Math.round(((hi - b) / (hi - lo)) * (h - 1));
        if (r >= 0 && r < h && c >= 0 && c < w) rows[r][c] = y[i] === 0 ? 'o' : 'x';
    });
    return rows.map(r => r.join('')).join('\n') + '\n';
}

/* ===================== experiment configuration ======================== */
// One σ everywhere; every KernelELM RBF uses γ = 1/(2σ²) — the bandwidth
// correspondence invariant from ADR-0006 §5. buildRFF samples W ~ N(0, 1/σ²),
// which approximates k(x,y) = exp(−‖x−y‖² / (2σ²)).

const SIGMA = 0.25;
const GAMMA = 1 / (2 * SIGMA * SIGMA);   // = 8
const LAMBDA = 1e-3;
const N_TRAIN = 1500;
const N_TEST = 600;

const rbf = (x: number[], z: number[]) => {
    const dx = x[0] - z[0], dy = x[1] - z[1];
    return Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
};

const train = twoSpirals(N_TRAIN, makeRng(42));
const test = twoSpirals(N_TEST, makeRng(4242));
const Yhot = oneHot2(train.y);

const kelmOf = (mode: 'exact' | 'nystrom', m?: number) =>
    new KernelELM({
        outputDim: 2,
        kernel: { type: 'rbf', gamma: GAMMA },
        ridgeLambda: LAMBDA,
        task: 'classification',
        mode,
        ...(mode === 'nystrom' ? { nystrom: { m, strategy: 'uniform' as const, seed: 7 } } : {}),
        log: { modelName: `kelm-${mode}`, verbose: false },
    });

/* ============================== the suite ============================== */

describe('NB-005 worked example — Random Fourier Features on two spirals', () => {

    it('§3 identities: mapRFF is exactly the textbook √(1/D)·[cos|sin] embedding', () => {
        const D = 200;
        const rff = buildRFF(2, D, SIGMA, makeRng(7));
        const x = Float64Array.from([0.3, -0.8]);
        const yv = Float64Array.from([-0.5, 0.2]);

        // Oracle: recompute the *raw* (unnormalized) features from the public
        // rff.W / rff.b fields. ‖z_raw‖² = Σₖ (cos²+sin²) = D exactly.
        const raw = (v: Float64Array) => {
            const z = new Float64Array(2 * D);
            for (let k = 0; k < D; k++) {
                let dot = rff.b[k];
                for (let j = 0; j < 2; j++) dot += rff.W[k * 2 + j] * v[j];
                z[k] = Math.cos(dot);
                z[D + k] = Math.sin(dot);
            }
            return z;
        };
        const zRaw = raw(x);
        let norm2 = 0;
        for (let i = 0; i < zRaw.length; i++) norm2 += zRaw[i] * zRaw[i];
        expect(Math.abs(norm2 - D)).toBeLessThan(1e-9);            // ‖z_raw‖² = D exactly

        // Therefore the library's L2-normalize ≡ dividing by √D:
        const z = mapRFF(rff, x);
        for (let i = 0; i < z.length; i++) {
            expect(Math.abs(z[i] - zRaw[i] / Math.sqrt(D))).toBeLessThan(1e-12);
        }

        // Angle-difference identity: z(x)ᵀz(y) = (1/D) Σₖ cos(wₖᵀ(x−y))
        const zy = mapRFF(rff, yv);
        let inner = 0;
        for (let i = 0; i < z.length; i++) inner += z[i] * zy[i];
        let viaIdentity = 0;
        for (let k = 0; k < D; k++) {
            const wDelta = rff.W[k * 2] * (x[0] - yv[0]) + rff.W[k * 2 + 1] * (x[1] - yv[1]);
            viaIdentity += Math.cos(wDelta);
        }
        viaIdentity /= D;
        expect(Math.abs(inner - viaIdentity)).toBeLessThan(1e-12);

        console.log(`\n[identities] D=${D}: ‖z_raw‖²−D = ${(norm2 - D).toExponential(2)}; ` +
            `z(x)ᵀz(y) = ${inner.toFixed(6)} vs (1/D)Σcos(wᵀδ) = ${viaIdentity.toFixed(6)}; ` +
            `true k(x,y) = ${rbf([0.3, -0.8], [-0.5, 0.2]).toFixed(6)}`);
    });

    it('§3 Monte-Carlo convergence: |z(x)ᵀz(y) − k(x,y)| shrinks like ~1/√D', () => {
        const Ds = [10, 50, 200, 1000];
        const nPairs = 400;
        const pairRng = makeRng(1234);
        const pairs: Array<[number[], number[]]> = Array.from({ length: nPairs }, () => [
            [2 * pairRng() - 1, 2 * pairRng() - 1],
            [2 * pairRng() - 1, 2 * pairRng() - 1],
        ]);

        const rows: Array<{ D: number; mean: number; max: number }> = [];
        for (const D of Ds) {
            const rff = buildRFF(2, D, SIGMA, makeRng(1000 + D));
            let sum = 0, max = 0;
            for (const [a, b] of pairs) {
                const za = mapRFF(rff, Float64Array.from(a));
                const zb = mapRFF(rff, Float64Array.from(b));
                let inner = 0;
                for (let i = 0; i < za.length; i++) inner += za[i] * zb[i];
                const err = Math.abs(inner - rbf(a, b));
                sum += err;
                if (err > max) max = err;
            }
            rows.push({ D, mean: sum / nPairs, max });
        }

        console.log('\n[approx error vs D]  (400 fixed random pairs in [-1,1]², σ=0.25)');
        console.log('| D    | mean abs err | max abs err | 1/√D    |');
        console.log('|------|--------------|-------------|---------|');
        for (const r of rows) {
            console.log(`| ${String(r.D).padEnd(4)} | ${r.mean.toFixed(5).padEnd(12)} | ${r.max.toFixed(5).padEnd(11)} | ${(1 / Math.sqrt(r.D)).toFixed(4).padEnd(7)} |`);
        }

        // qualitative: two orders of magnitude more features → strictly better, by a lot
        expect(rows[3].mean).toBeLessThan(rows[0].mean / 3);
        expect(rows[1].mean).toBeLessThan(rows[0].mean);
    }, 60_000);

    it('§1 the scaling problem: exact KernelELM cost grows superlinearly in N; RFF stays flat-ish', () => {
        const Ns = [250, 500, 1000, 2000];
        const D = 200;
        const predX = test.X.slice(0, 500);
        const predY = test.y.slice(0, 500);

        console.log(`\n[scaling vs N]  (predict = 500 test points; RFF D=${D} → ${2 * D} features; σ=${SIGMA}, λ=${LAMBDA})`);
        console.log('| N    | KELM-exact fit ms | KELM pred ms | KELM acc | RFF fit ms | RFF pred ms | RFF acc |');
        console.log('|------|-------------------|--------------|----------|------------|-------------|---------|');

        let lastExactAcc = 0;
        for (const N of Ns) {
            const sub = twoSpirals(N, makeRng(42));
            const subHot = oneHot2(sub.y);

            const kelm = kelmOf('exact');
            const fitK = time(() => kelm.fit(sub.X, subHot));
            const predK = time(() => argmaxRow(kelm.predictProbaFromVectors(predX)));
            const accK = accuracy(predK.out, predY);

            const rff = buildRFF(2, D, SIGMA, makeRng(9));
            const fitR = time(() => fitRidgeOnFeatures(rffFeatures(rff, sub.X), subHot, LAMBDA));
            const predR = time(() => predictFeatures(rffFeatures(rff, predX), fitR.out));
            const accR = accuracy(predR.out, predY);

            console.log(`| ${String(N).padEnd(4)} | ${fitK.ms.toFixed(1).padStart(17)} | ${predK.ms.toFixed(1).padStart(12)} | ${(100 * accK).toFixed(1).padStart(7)}% | ${fitR.ms.toFixed(1).padStart(10)} | ${predR.ms.toFixed(1).padStart(11)} | ${(100 * accR).toFixed(1).padStart(6)}% |`);
            lastExactAcc = accK;
        }
        expect(lastExactAcc).toBeGreaterThan(0.9); // the expensive model does work well
    }, 300_000);

    it('§4 showdown: linear vs RFF+ridge vs exact RBF KernelELM (accuracy, time, boundaries)', () => {
        const D = 200;

        console.log(`\n[dataset] two spirals: ${N_TRAIN} train / ${N_TEST} test, noise=0.03, seed 42/4242`);
        console.log(asciiData(train.X.slice(0, 400), train.y.slice(0, 400)));

        // (a) plain linear ridge on [1, x, y]
        const fitL = time(() => fitRidgeOnFeatures(linFeatures(train.X), Yhot, LAMBDA));
        const predL = time(() => predictFeatures(linFeatures(test.X), fitL.out));
        const accL = accuracy(predL.out, test.y);

        // (b) RFF (D=200 → 400 features) + same ridge solver
        const rff = buildRFF(2, D, SIGMA, makeRng(9));
        const fitR = time(() => fitRidgeOnFeatures(rffFeatures(rff, train.X), Yhot, LAMBDA));
        const predR = time(() => predictFeatures(rffFeatures(rff, test.X), fitR.out));
        const accR = accuracy(predR.out, test.y);

        // (c) exact RBF KernelELM
        const kelm = kelmOf('exact');
        const fitK = time(() => kelm.fit(train.X, Yhot));
        const predK = time(() => argmaxRow(kelm.predictProbaFromVectors(test.X)));
        const accK = accuracy(predK.out, test.y);

        console.log(`[showdown]  N=${N_TRAIN}, σ=${SIGMA} (γ=${GAMMA}), λ=${LAMBDA}, RFF D=${D}`);
        console.log('| model                     | features    | test acc | fit ms | predict ms (600) |');
        console.log('|---------------------------|-------------|----------|--------|------------------|');
        console.log(`| linear ridge              | 3           | ${(100 * accL).toFixed(1).padStart(7)}% | ${fitL.ms.toFixed(1).padStart(6)} | ${predL.ms.toFixed(1).padStart(16)} |`);
        console.log(`| RFF + ridge               | ${String(2 * D).padEnd(11)} | ${(100 * accR).toFixed(1).padStart(7)}% | ${fitR.ms.toFixed(1).padStart(6)} | ${predR.ms.toFixed(1).padStart(16)} |`);
        console.log(`| KernelELM exact (RBF)     | N=${String(N_TRAIN).padEnd(9)} | ${(100 * accK).toFixed(1).padStart(7)}% | ${fitK.ms.toFixed(1).padStart(6)} | ${predK.ms.toFixed(1).padStart(16)} |`);

        console.log('\n[boundary: linear ridge]');
        console.log(asciiBoundary(X => predictFeatures(linFeatures(X), fitL.out)));
        console.log('[boundary: RFF + ridge, D=200]');
        console.log(asciiBoundary(X => predictFeatures(rffFeatures(rff, X), fitR.out)));
        console.log('[boundary: KernelELM exact RBF]');
        console.log(asciiBoundary(X => argmaxRow(kelm.predictProbaFromVectors(X))));

        // negative control: spirals are genuinely non-linear
        expect(accL).toBeLessThan(0.7);
        // positive controls
        expect(accR).toBeGreaterThan(0.9);
        expect(accK).toBeGreaterThan(0.9);
        // the approximation should land near the exact model (within 5 points)
        expect(Math.abs(accK - accR)).toBeLessThan(0.05);
    }, 300_000);

    it('§4 accuracy vs D: more random features → closer to the exact kernel model', () => {
        const Ds = [10, 25, 50, 100, 200, 400];
        console.log(`\n[accuracy vs D]  (same train/test as showdown; σ=${SIGMA}, λ=${LAMBDA})`);
        console.log('| D    | features | test acc | fit ms |');
        console.log('|------|----------|----------|--------|');
        const accs: number[] = [];
        for (const D of Ds) {
            const rff = buildRFF(2, D, SIGMA, makeRng(9));
            const fit = time(() => fitRidgeOnFeatures(rffFeatures(rff, train.X), Yhot, LAMBDA));
            const acc = accuracy(predictFeatures(rffFeatures(rff, test.X), fit.out), test.y);
            accs.push(acc);
            console.log(`| ${String(D).padEnd(4)} | ${String(2 * D).padEnd(8)} | ${(100 * acc).toFixed(1).padStart(7)}% | ${fit.ms.toFixed(1).padStart(6)} |`);
        }
        expect(Math.max(...accs.slice(-2))).toBeGreaterThan(0.93); // plenty of features → strong
        expect(accs[accs.length - 1]).toBeGreaterThan(accs[0]);    // more features beats few
    }, 300_000);

    it('§5 RFF vs Nyström at a matched feature budget', () => {
        const budgets = [50, 100, 200]; // Nyström landmarks m; RFF gets D=m/2 → m features
        console.log(`\n[RFF vs Nyström]  (feature budget = final feature count for both; σ=${SIGMA}, λ=${LAMBDA})`);
        console.log('| features | RFF acc | RFF fit ms | Nyström acc | Nyström fit ms |');
        console.log('|----------|---------|------------|-------------|----------------|');
        let bestNys = 0;
        for (const m of budgets) {
            const rff = buildRFF(2, m / 2, SIGMA, makeRng(9));
            const fitR = time(() => fitRidgeOnFeatures(rffFeatures(rff, train.X), Yhot, LAMBDA));
            const accR = accuracy(predictFeatures(rffFeatures(rff, test.X), fitR.out), test.y);

            const nys = kelmOf('nystrom', m);
            const fitN = time(() => nys.fit(train.X, Yhot));
            const accN = accuracy(argmaxRow(nys.predictProbaFromVectors(test.X)), test.y);
            bestNys = Math.max(bestNys, accN);

            console.log(`| ${String(m).padEnd(8)} | ${(100 * accR).toFixed(1).padStart(6)}% | ${fitR.ms.toFixed(1).padStart(10)} | ${(100 * accN).toFixed(1).padStart(10)}% | ${fitN.ms.toFixed(1).padStart(14)} |`);
        }
        expect(bestNys).toBeGreaterThan(0.9); // the library's Nyström path also solves spirals
    }, 300_000);

    it('prints the environment stamp for NB-005', async () => {
        const os = await import('os');
        console.log(`\n[env] node ${process.version}, ${os.cpus()[0]?.model ?? 'unknown CPU'}, ` +
            `${os.platform()}-${os.arch()}, vitest single-thread wall-clock`);
        expect(true).toBe(true);
    });
});
