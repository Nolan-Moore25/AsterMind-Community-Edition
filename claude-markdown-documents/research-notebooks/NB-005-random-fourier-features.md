# NB-005 — Random Fourier Features, from scratch

**Date:** 2026-07-14
**Tags:** rff, kernels, bochner, KernelELM, nystrom, pro-math, capstone
**Outcome:** Derived Random Fourier Features from Bochner's theorem down to the exact lines of `src/pro/math/rff.ts`, and validated the derivation with a measured worked example on the two-spirals dataset using only real AsterMind code (`buildRFF`/`mapRFF`, `ridgeSolvePro`, `KernelELM`). Headline numbers: exact RBF `KernelELM` hits 100.0% on spirals but its fit cost grows ~82× when N grows 8×; RFF with 400 features hits 99.8% with fit cost growing only ~3.7× over the same range, and flat prediction cost. Two honest wrinkles: exact kernel methods are *faster* below N≈1000 (the approximation only pays past the crossover), and Nyström beat RFF at every matched feature budget on this dataset. Every number here is printed by the committed suite `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`.

> **Capstone context:** deliverable 3 of the [Nolan infrastructure lane](../../examples/capstones/nolan-infrastructure/STARTER.md), executed per [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md).

---

## 0. Who this is for, and how to re-run it

**Assumed background:** single-variable calculus (integrals, `e^x`, completing the square), basic linear algebra (dot products, matrices), and enough probability to read "expected value." **Not assumed:** any prior exposure to kernel methods, Fourier analysis, or measure theory. Where a real proof needs machinery beyond that, this notebook says so explicitly and states what is being taken on faith.

**Re-running the experiments:** every table below is printed by one command:

```bash
npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts
```

The suite is seeded end-to-end (dataset generation and the random feature draws), so the accuracy numbers and error tables reproduce exactly; wall-clock timings vary by machine and run. Measured environment for the numbers quoted here: **Node v22.20.0, Apple M1, darwin-arm64** (single-threaded vitest). Treat the timing *ratios* as the claim, not the milliseconds. The suite also runs as part of `npm test`, so these results are re-validated on every full test run (~5.7s of the suite's total).

**Notation used throughout:**

| Symbol | Meaning |
|---|---|
| x, y ∈ ℝᵈ | input points (here d = 2) |
| δ = x − y | the difference vector ("shift") |
| k(x, y) | a kernel function; for us the RBF kernel exp(−‖δ‖²/(2σ²)) |
| σ | RBF bandwidth (we use σ = 0.25 everywhere; `KernelELM` speaks γ = 1/(2σ²) = 8) |
| N | number of training points |
| D | number of random frequencies; the feature vector has 2D entries |
| w, b | a random frequency vector and a random phase |
| z(x) | the random Fourier feature vector of x |
| λ | ridge regularization strength (10⁻³ everywhere here) — see §1.3 |
| Φ, Θ | the N×P matrix of feature vectors, and the P×K fitted weight matrix |

---

## 1. The problem: kernel methods are accurate and don't scale

### 1.1 What a kernel even is (from dot products up)

A linear classifier scores a point with a dot product: `score(x) = wᵀx + bias`. Geometrically that draws a straight line (hyperplane) through the input space. Some datasets are simply not separable by any line — the worked example in §4 uses one (two interleaved spirals), and the best any linear model manages on it is **66.2%**.

The classical fix is to *map the inputs somewhere else first*: pick a feature map φ, replace x with φ(x), and run the linear machinery there. A curve in the original space can be a straight line in feature space. The catch is that expressive φ's are big — and the classical *trick* is that many algorithms only ever use feature vectors through dot products φ(x)ᵀφ(y). If you can compute that dot product directly with some function

> k(x, y) = φ(x)ᵀφ(y)

then you never need to materialize φ(x) at all. Such a k is a **kernel**, and swapping it in for dot products is the **kernel trick**.

The kernel this notebook cares about is the **RBF (Gaussian) kernel**:

> k(x, y) = exp( −‖x − y‖² / (2σ²) )

Read it as a *similarity dial*: it is 1 when x = y and falls off smoothly with distance, with σ setting how fast. With our σ = 0.25:

| distance ‖δ‖ | k(x,y) |
|---|---|
| 0 | 1.000 |
| 0.25 (= σ) | 0.607 |
| 0.5 | 0.135 |
| 0.75 | 0.011 |
| 1.0 | 0.0003 |

The remarkable fact (not proved here) is that this k corresponds to an *infinite-dimensional* φ — an RBF model can carve decision boundaries of essentially arbitrary shape. The kernel trick gives you that power without ever writing φ down.

### 1.2 What that costs, concretely, in this codebase

`KernelELM` in exact mode ([src/core/KernelELM.ts](../../src/core/KernelELM.ts), `fit()` at `KernelELM.ts:244`) does the textbook thing:

1. Build the **N×N kernel matrix** K, where K[i][j] = k(xᵢ, xⱼ) — every training point against every other. That is O(N²·d) work and O(N²) memory.
2. Solve the ridge system (K + λI)·α = Y by Cholesky factorization — O(N³) arithmetic.
3. Keep **all N training points** plus the N×K coefficient matrix α inside the model (`KernelELM.ts:271` logs `alpha(NxK)`), because predicting a new point x requires computing k(x, xᵢ) against *every stored training point* — O(N·d) per prediction, forever.

So training cost curves upward in N twice (quadratic build, cubic solve), the model artifact grows linearly in N, and prediction slows linearly in N. Here is that story measured on this machine (spirals data, predict = 500 test points, details in §4):

```
[scaling vs N]  (predict = 500 test points; RFF D=200 → 400 features; σ=0.25, λ=0.001)
| N    | KELM-exact fit ms | KELM pred ms | KELM acc | RFF fit ms | RFF pred ms | RFF acc |
|------|-------------------|--------------|----------|------------|-------------|---------|
| 250  |              18.6 |          6.9 |   100.0% |       56.0 |        12.7 |   99.6% |
| 500  |              36.7 |          9.6 |   100.0% |       67.9 |        12.6 |   99.8% |
| 1000 |             219.7 |         18.9 |   100.0% |      133.4 |        11.9 |   99.8% |
| 2000 |            1521.8 |         33.0 |   100.0% |      206.5 |        12.0 |   99.8% |
```

Read the exact-KELM fit column down: N doubles 250→500→1000→2000 and fit time multiplies by **×2.0, ×6.0, ×6.9**. A pure O(N²) process would multiply by 4 per doubling and a pure O(N³) one by 8; the measured drift from 2× toward 7× is the O(N²) kernel-build being overtaken by the O(N³) Cholesky as N grows. Over the whole range: 8× the data → **82× the fit time**. Prediction time grows right alongside (6.9 → 33.0 ms), because each prediction touches every stored training point.

Meanwhile the RFF column (the thing this notebook builds): fit grows 56 → 206.5 ms (**×3.7** over the same 8× data range — roughly linear, as it should be for a fixed feature count), prediction is **flat ~12 ms** no matter how much training data there was, and accuracy gives up 0.2 points (99.8% vs 100.0%).

Two honest observations before moving on:

- **Below N≈1000, exact wins.** At N=250 exact fit is 18.6 ms vs RFF's 56.0 ms — building 400 features per point costs more than just solving the tiny exact system. The approximation is an *asymptotic* win, not a universal one. If your dataset is small, use the exact kernel; that is what it's for.
- **The accuracy gap is real but tiny here** (0.2 points at D=200). §4 measures how it shrinks as D grows.

The rest of this notebook is the question: **where do those 400 features come from, and why do their plain dot products imitate an RBF kernel?** The answer is a 1932 theorem from harmonic analysis plus a Monte-Carlo estimate, and it lands exactly on the 40 lines of [src/pro/math/rff.ts](../../src/pro/math/rff.ts).

### 1.3 The other half of every model here: ridge regression, briefly

Every model in this notebook — linear, RFF, and the kernel machine — ends in the same move: fit a linear map from features to targets by solving one equation. Since "ridge" appears in every table above, here is the whole idea, at the calculus level this notebook promised.

**Setup.** Stack the N feature vectors as rows of a matrix Φ (N×P — for the linear model P = 3, for RFF P = 2D), and the N training labels as rows of Y (N×K, one-hot: class 0 is the row [1, 0], class 1 is [0, 1]). We want a weight matrix Θ (P×K) making the predictions ΦΘ close to Y — specifically, minimizing the total squared error ‖ΦΘ − Y‖².

**Solving it is single-variable calculus scaled up.** For one weight θ and one feature column φ, the error Σᵢ(φᵢθ − yᵢ)² is a parabola in θ; set its derivative to zero and get (Σφᵢ²)·θ = Σφᵢyᵢ. The matrix version of that same derivative-equals-zero computation is the **normal equations**:

> (ΦᵀΦ) Θ = ΦᵀY

— a P×P linear system. No iteration, no learning rate, no epochs: one solve. **This is the entire reason everything in this repo trains in milliseconds** — the ELM family's core bet is "random features + closed-form linear solve" instead of gradient descent.

**The ridge part is the +λI.** ΦᵀΦ can be singular or nearly so (features that are duplicates or near-duplicates of each other make the parabola flat in some direction, so the minimizer isn't unique and the solve blows up numerically). The fix is to add a small penalty λ·‖Θ‖² to the objective, which after the same calculus turns the system into

> (ΦᵀΦ + λI) Θ = ΦᵀY

Now the matrix is always invertible (positive definite), the solution is unique, weights are gently shrunk toward zero, and the solve is numerically stable. That modification is called **ridge regression**, λ is the knob (10⁻³ throughout this notebook), and choosing it too large blurs the fit while too small re-invites the instability.

**Where this lives in the library.** `ridgeSolvePro` ([src/pro/math/krr.ts:120](../../src/pro/math/krr.ts)) solves exactly this shape of system — Cholesky factorization first, adaptive jitter if the matrix is borderline, conjugate-gradient fallback if it stays stubborn. The linear and RFF models in §4 both call it on (ΦᵀΦ + λI)Θ = ΦᵀY. `KernelELM`'s exact mode solves the *kernel-space twin* (K + λI)α = Y — same equation with the N×N kernel matrix where the P×P feature gram was, which is precisely how the O(N³) in §1.2 arises. And classification is just regression onto one-hot targets followed by an argmax over the K predicted scores.

---

## 2. Bochner's theorem: kernels are disguised Fourier transforms

### 2.1 Shift-invariance

The RBF kernel only looks at the *difference* of its arguments: k(x, y) = κ(x − y) with κ(δ) = exp(−‖δ‖²/(2σ²)). Kernels with that property are called **shift-invariant** (or stationary): sliding both points by the same amount changes nothing. RBF and Laplacian kernels are shift-invariant; the polynomial kernel (x·y + c)ᵖ is not (it cares about where the origin is). Everything in this notebook lives inside the shift-invariant world — that is scoping, and it comes back as a limitation in §6.

### 2.2 The theorem

> **Bochner's theorem (1932).** A continuous shift-invariant function κ(δ) on ℝᵈ is a valid kernel (positive definite) **if and only if** it is the Fourier transform of a finite non-negative measure. If additionally κ(0) = 1, that measure is a *probability distribution* p(w):
>
> κ(δ) = ∫ p(w) · e^{i wᵀδ} dw = **E**₍w∼p₎ [ e^{i wᵀδ} ]

The proof of the full theorem needs measure theory and is genuinely out of scope (see Rudin in §7 — this is the one thing this notebook takes on faith). But the *reading* of it is the whole game:

**every shift-invariant kernel is secretly an expected value over random frequencies.**

In probability language, κ is the *characteristic function* of the distribution p. The kernel and the distribution are a Fourier-transform pair: pick the kernel, and a specific frequency distribution p(w) is forced.

One cleanup step: our κ is a real function, and p turns out symmetric (p(w) = p(−w)) for real kernels. Split e^{iwᵀδ} = cos(wᵀδ) + i·sin(wᵀδ); the sine is an odd function being averaged over a symmetric distribution, so its expectation is 0, and:

> κ(δ) = **E**₍w∼p₎ [ cos(wᵀδ) ]     (★)

No imaginary numbers survive. A kernel evaluation is *the average of a cosine at a random frequency*.

### 2.3 Deriving the Gaussian pair by hand

Bochner says a p(w) exists for the RBF kernel. Which one? Claim:

> κ(δ) = exp(−‖δ‖²/(2σ²))  ⟺  p(w) = N(0, σ⁻²·I) — a Gaussian with standard deviation **1/σ** per coordinate.

Note the reciprocal: a *wide* kernel (large σ, similarity decays slowly) uses *low* frequencies, and a *narrow* kernel needs *high* frequencies. That inverse relationship is the Fourier uncertainty principle wearing street clothes, and it is exactly what `rff.ts:13` implements (`const s = 1 / sigma`).

**The 1-D computation.** Let p(w) be the density of N(0, 1/σ²), i.e. p(w) = (σ/√(2π)) · e^{−σ²w²/2}. Compute the expectation in (★) with the complex exponential (easier algebra; we take the real part at the end):

E[e^{iwδ}] = ∫ (σ/√(2π)) · e^{−σ²w²/2} · e^{iwδ} dw

Work on the exponent. Complete the square in w:

−σ²w²/2 + iwδ
  = −(σ²/2) · (w² − 2iδw/σ²)
  = −(σ²/2) · (w − iδ/σ²)² + (σ²/2)·(iδ/σ²)²
  = −(σ²/2) · (w − iδ/σ²)² − δ²/(2σ²)

The second term is constant in w and factors out of the integral:

E[e^{iwδ}] = e^{−δ²/(2σ²)} · ∫ (σ/√(2π)) · e^{−(σ²/2)(w − iδ/σ²)²} dw

The remaining integral is a Gaussian bump shifted by the imaginary constant iδ/σ². For a calculus-level reading: shifting the variable of integration by a constant doesn't change the area under a Gaussian, so the integral is the same as ∫(σ/√(2π))·e^{−σ²u²/2} du = 1 (it's a normalized density). (That "shift by an *imaginary* constant changes nothing" step is the one place a real-analysis purist would demand contour-integration justification; it is legal, standard, and we won't belabor it.) So:

> E[e^{iwδ}] = e^{−δ²/(2σ²)}   ∎

**The d-D case is free.** Both sides factorize across coordinates: the multivariate Gaussian density is a product of 1-D densities, e^{iwᵀδ} = Πⱼ e^{i wⱼ δⱼ}, and the expectation of a product of independent things is the product of expectations:

E[e^{iwᵀδ}] = Πⱼ e^{−δⱼ²/(2σ²)} = e^{−‖δ‖²/(2σ²)} ✓

So for the RBF kernel, the recipe "draw w from a Gaussian with std 1/σ" makes (★) hold exactly. Different shift-invariant kernel, different p — e.g. the Laplacian kernel e^{−‖δ‖/σ} pairs with the heavy-tailed Cauchy distribution — but the machinery is identical.

---

## 3. The RFF construction: Monte-Carlo the expectation, then factor it

### 3.1 From expectation to average

(★) is exact but still involves an integral. Rahimi & Recht's 2007 move is almost disrespectfully simple: **estimate the expectation by sampling.** Draw D frequencies w₁ … w_D i.i.d. from p, and:

> κ(δ) ≈ (1/D) · Σₖ cos(wₖᵀδ)

That's a Monte-Carlo average of bounded terms (each cosine sits in [−1, 1]), so the classical guarantees apply with no fine print:

- **Unbiased:** the expected value of the average is exactly κ(δ), for any D, even D = 1.
- **1/√D error:** the variance of one term is Var[cos(wᵀδ)] = (1 + κ(2δ))/2 − κ(δ)² ≤ 1, so the standard error of the average is at most 1/√D. (That variance identity is the double-angle formula cos²θ = (1+cos 2θ)/2 plus (★) applied at 2δ — a two-line exercise.)
- **Exponential tail:** Hoeffding's inequality gives P(|error| > ε) ≤ 2·e^{−Dε²/2}. Rahimi & Recht go further and prove the error is small *simultaneously for every pair of points* in a bounded region (their Claim 1), which is the guarantee a learning algorithm actually needs; the rate is still "error ~ 1/√D."

### 3.2 The factoring trick: from estimating k to *being* a feature map

An estimate of κ(δ) isn't yet what §1 asked for — we need **features** z(x), computed per-point with no knowledge of the other point, whose plain dot product is the estimate. The cosine-of-a-difference must factor into "something(x) · something(y)." The angle-difference identity does it:

> cos(a − b) = cos a · cos b + sin a · sin b

Set a = wₖᵀx and b = wₖᵀy, and define per frequency the *pair* of features (cos wₖᵀx, sin wₖᵀx). Stack all D pairs and scale by 1/√D:

> z(x) = (1/√D) · [ cos w₁ᵀx, …, cos w_Dᵀx, sin w₁ᵀx, …, sin w_Dᵀx ] ∈ ℝ^{2D}

Then, term by term:

> z(x)ᵀz(y) = (1/D) Σₖ [cos wₖᵀx · cos wₖᵀy + sin wₖᵀx · sin wₖᵀy] = (1/D) Σₖ cos(wₖᵀ(x − y))

— exactly the Monte-Carlo estimator of §3.1, now factored as an honest dot product of 2D-dimensional vectors. **This is the whole of RFF:** a linear model on z is (approximately, unbiasedly, with 1/√D error) a kernel model with kernel κ. Kernel machine → linear machine, N-dependence gone.

(Many write-ups instead use a single cosine with a random *phase*, zₖ(x) = √(2/D)·cos(wₖᵀx + bₖ) with bₖ ~ U[0, 2π] — averaging over the phase recovers the same expectation with a factor-2 bookkeeping change. The paired cos/sin variant used here has provably no-worse variance (Sutherland & Schneider 2015) and is what AsterMind implements.)

### 3.3 The same math, as shipped in `src/pro/math/rff.ts`

The entire library implementation is ~30 effective lines. Mapping them to the derivation:

```ts
// rff.ts:10-17 — sampling the frequencies (§2.3) and phases
export function buildRFF(d: number, D: number, sigma = 1.0, rng = Math.random): RFF {
    const W = new Float64Array(D * d);
    const b = new Float64Array(D);
    const s = 1 / Math.max(1e-12, sigma); // N(0, 1/sigma^2)   ← the reciprocal from §2.3
    for (let i = 0; i < D * d; i++) W[i] = gauss(rng) * s;     // wₖ ~ N(0, σ⁻²I), Box-Muller
    for (let i = 0; i < D; i++) b[i] = rng() * 2 * Math.PI;    // phases (see surprise #2, §6)
    return { W, b, D, d, sigma };
}

// rff.ts:19-34 — the feature map z(x) (§3.2)
export function mapRFF(rff: RFF, x: Float64Array): Float64Array {
    const { W, b, D, d } = rff;
    const z = new Float64Array(2 * D);
    for (let k = 0; k < D; k++) {
        let dot = b[k];
        const off = k * d;
        for (let j = 0; j < d; j++) dot += W[off + j] * (x[j] || 0);
        z[k] = Math.cos(dot);          // paired cos/sin — the identity from §3.2
        z[D + k] = Math.sin(dot);
    }
    // L2 normalize block to keep ridge well-conditioned     ← see below: this IS 1/√D
    let s = 0; for (let i = 0; i < z.length; i++) s += z[i] * z[i];
    const inv = 1 / Math.sqrt(Math.max(s, 1e-12));
    for (let i = 0; i < z.length; i++) z[i] *= inv;
    return z;
}
```

Three things deserve a hard look, because none of them is *labeled* as the textbook construction — they just are it:

**(a) The L2-normalize is exactly the missing 1/√D.** The code never multiplies by 1/√D; instead it divides the raw vector by its own L2 norm, under a comment that reads like a numerical-conditioning heuristic. But the raw vector's norm isn't random at all: its squared norm is

> ‖z_raw‖² = Σₖ [cos²(wₖᵀx + bₖ) + sin²(wₖᵀx + bₖ)] = Σₖ 1 = **D, exactly, for every x**

by the Pythagorean identity, applied once per (cos, sin) pair. Dividing by the norm *is* dividing by √D. The committed suite asserts this to machine precision — measured: `‖z_raw‖² − D = −1.14e-13` at D = 200 (pure float round-off), and every coordinate of `mapRFF`'s output matches `z_raw/√D` to < 1e-12. A comment that says "keep ridge well-conditioned" is, mathematically, the exact textbook scaling. (It also future-proofs: if the feature definition ever changed to something without a deterministic norm, the normalize would still control scale — but as shipped, it is not an approximation of 1/√D, it *equals* it.)

**(b) The phases `b` are provably inert here.** `buildRFF` samples a phase bₖ per frequency, and `mapRFF` adds it inside both the cos and the sin. Push it through the angle-difference identity: cos((a+β) − (b+β)) = cos(a − b) — the phase *cancels identically* in every inner product. Phases are load-bearing in the single-cosine variant (§3.2's parenthetical), where averaging over them is what makes the estimator work; in the paired cos/sin construction they rotate each (cos, sin) pair in place and change nothing about any z(x)ᵀz(y). The suite verifies this indirectly by checking the inner product equals (1/D)Σcos(wₖᵀδ) — a formula with no b in it — to < 1e-12. Measured on the fixed pair x = (0.3, −0.8), y = (−0.5, 0.2): `z(x)ᵀz(y) = −0.011301` and `(1/D)Σcos(wᵀδ) = −0.011301`. Harmless, mildly wasteful, and a genuinely fun thing to discover by proof rather than by reading a paper.

**(c) That same measured pair shows what "unbiased but noisy" means.** The true kernel value for those two points is k = exp(−1.64/0.125) ≈ **0.000002** — essentially "not similar at all" — while the D=200 estimate is **−0.011301**: wrong sign, absolute error ≈ 0.011. That is not a bug; it is exactly the ~1/√D Monte-Carlo noise floor (compare the D=200 row below). Individual kernel estimates rattle around the truth; the *learning algorithm* on top averages over N training points' worth of such estimates and doesn't care. If you need individual kernel values to be precise, RFF is the wrong tool; if you need a model, it's fine.

### 3.4 Measured convergence: the 1/√D law shows up on schedule

400 fixed random pairs in [−1,1]², σ = 0.25, error = |z(x)ᵀz(y) − k(x,y)|:

```
[approx error vs D]
| D    | mean abs err | max abs err | 1/√D    |
|------|--------------|-------------|---------|
| 10   | 0.16605      | 0.65417     | 0.3162  |
| 50   | 0.06613      | 0.26622     | 0.1414  |
| 200  | 0.03435      | 0.12778     | 0.0707  |
| 1000 | 0.01854      | 0.05719     | 0.0316  |
```

D grows by a factor of 100 (10 → 1000) and the mean error falls by a factor of ≈ 9.0 (0.166 → 0.0185) — the square-root law almost exactly (√100 = 10). The mean error tracks roughly ½·(1/√D) down the whole table, and the max error (worst pair of 400) sits ~3–4× the mean, consistent with the exponential tails from §3.1. Nothing here was fitted; the table is four seeds and a formula from 1932 agreeing with each other.

---

## 4. Worked example: two spirals, three models, real library code

### 4.1 The setup

The dataset is the classic torture test for linear models: two interleaved spiral arms (1.5 turns each, radius 0.1 → 1.0, arm-to-arm gap ≈ 0.3, Gaussian noise 0.03), N = 1500 train / 600 test, seeded. σ = 0.25 was chosen from the geometry — the kernel should regard "same arm, one step along" (distance ≈ 0.1–0.2) as similar and "other arm" (distance ≈ 0.3+) as dissimilar, and §1.1's similarity table shows σ = 0.25 doing exactly that. The equivalent `KernelELM` bandwidth is γ = 1/(2σ²) = 8 — getting that correspondence wrong makes every comparison below silently unfair, so the suite pins it in one constant.

The training data, as the suite prints it (400 of the 1500 points; `o` = class 0, `x` = class 1):

```
                      oo oo
               o oooo  oo o  o   o ooo
           o  o            x       o  o
            o        xxxx xxx x        ooo
        o       xxx xx         x xx
       ooo     x x      oo   o   x xxx    oo
     oooo    xx      oo ooooooooo    x    ooo
     oo      x     oooo       oo     x       o
       o     x    ooo    xx   oo    xx     oo      x
           x x    ooo   xxxx      xxxxx  ooo      x
           xxxx    ooo   xxxxxxxxxxx     ooo     x
             xx     oo      xxxx        oooo    xx
             xxxx     ooo oo  o  o  ooo       xx
              x x x     o ooo oo ooo        x  x
                 xxx                    x xx
                     xxxx  x       xxxx
                           x xxxx x
```

Three models, all built from public AsterMind API and one shared ridge fit:

| model | features | fit |
|---|---|---|
| (a) linear ridge | [1, x₁, x₂] — 3 numbers | `ridgeSolvePro` on (ΦᵀΦ + λI)Θ = ΦᵀY |
| (b) RFF + ridge | `mapRFF(buildRFF(2, 200, 0.25, rng), x)` — 400 numbers | same solver, same λ |
| (c) exact kernel | `KernelELM` mode `'exact'`, RBF γ=8 | its own (K + λI)α = Y |

The shared fit is worth showing because it's the "kernel machine → linear machine" punchline made concrete — models (a) and (b) are *the same code path*, differing only in what featurizer ran first:

```ts
// the whole RFF classifier, using only library calls (full file: tests/capstones/nolan-infrastructure/rff-worked-example.test.ts)
const rff = buildRFF(2, 200, 0.25, seededRng);                    // sample frequencies once
const feats = (X: number[][]) => X.map(x => Array.from(mapRFF(rff, Float64Array.from(x))));

const Theta = fitRidgeOnFeatures(feats(trainX), oneHotY, 1e-3);   // (ΦᵀΦ+λI)Θ=ΦᵀY via ridgeSolvePro
const preds = predictFeatures(feats(testX), Theta);               // argmax of φ(x)ᵀΘ
```

```ts
// the exact-kernel baseline — also pure library
const kelm = new KernelELM({
    outputDim: 2,
    kernel: { type: 'rbf', gamma: 8 },        // γ = 1/(2σ²), σ = 0.25
    ridgeLambda: 1e-3,
    task: 'classification',
    mode: 'exact',
});
kelm.fit(trainX, oneHotY);
const preds = argmaxRows(kelm.predictProbaFromVectors(testX));
```

### 4.2 The showdown

```
[showdown]  N=1500, σ=0.25 (γ=8), λ=0.001, RFF D=200
| model                     | features    | test acc | fit ms | predict ms (600) |
|---------------------------|-------------|----------|--------|------------------|
| linear ridge              | 3           |    66.2% |    1.0 |              0.1 |
| RFF + ridge               | 400         |    99.8% |  171.1 |             14.2 |
| KernelELM exact (RBF)     | N=1500      |   100.0% |  666.6 |             28.2 |
```

And the decision boundaries those three models actually learned (`·` = predicted class 0, `█` = class 1), straight from the suite's output:

**Linear ridge — a straight line through a spiral (66.2%).** It finds the best line that exists; the best line is just not much:

```
·························································
·························································
·························································
·························································
·························································
·························································
·························································
·························································
·························································
·························································
·························································
████████████████████████████████·························
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
█████████████████████████████████████████████████████████
```

**RFF + ridge, D=200 (99.8%).** Four hundred cosines later, the same linear solver draws a spiral. Note the confident swirl in the middle where the data is, and the noisier patchwork in the outer corners — there is no training data out there, and the random features extrapolate with random texture:

```
····████████████████████████████████████·············████
····████████████████████████████████████·············████
···██████████████████████·····██████████·············████
·███████████████████··············██████············█████
·████████████····································████████
··█████████········███████████···············████████████
···██████······█████████████████████·········████████████
·····█········█████████████████████████······████████████
············████████··········██████████······███████████
··········████████················███████······██████████
███·······███████··················██████·······███████··
███······███████·······██████·····███████·······██████···
██·······███████······██████████████████········██████···
··········██████·······████████████████········████████··
···········██████··········██████████········████████████
············██████·························███████·····██
·············████████·····················██████········█
············███████████████···········████████···········
·········██████████████████████████████████··············
·····████████████·····████████████████···················
····█████████████········████████························
····█████████████·········█████·······················███
····██████████████·······██████······················████
```

**KernelELM exact RBF (100.0%).** The reference answer — cleaner spiral, calmer extrapolation (an exact RBF model's prediction decays toward "no opinion" away from data, rather than committing to random texture):

```
·······█████████████···········█████·····················
·······███████████████····███████████····················
·······█████████████··········███████····················
········████████·········································
·························································
······················█████████··························
·················███████████████████·····················
··············████████████████████████···················
············█████████···········███████··················
█··········████████···············██████········██████···
██········███████·······████······███████·······███████··
██·······███████·······██████·····███████·······███████··
██·······███████·······███████··████████·······███████···
██·······███████·······███████████████········███████····
███······████████········███████████·········██████······
██████···██████████························███████·······
██████████████████████··················█████████········
███████████████████████████········█████████████·········
████████████████████████████████████████████·············
███████████████████████████████████████··················
███████████████████████████████████······················
██████████████████████████·······························
██████████████████████████·······························
```

The negative control (linear fails at 66.2%) matters as much as the positive ones: it proves the dataset genuinely requires the kernel, so the 99.8% isn't the dataset being secretly easy. All three bounds are asserted in CI (`accL < 0.7`, `accR > 0.9`, `accK > 0.9`, `|accK − accR| < 0.05`).

### 4.3 Accuracy as a function of D — buying accuracy with features

Same train/test split, sweeping the number of random frequencies:

```
[accuracy vs D]  (σ=0.25, λ=0.001)
| D    | features | test acc | fit ms |
|------|----------|----------|--------|
| 10   | 20       |    85.0% |    3.3 |
| 25   | 50       |    98.0% |    7.6 |
| 50   | 100      |    99.3% |   17.3 |
| 100  | 200      |    99.5% |   46.9 |
| 200  | 400      |    99.8% |  156.9 |
| 400  | 800      |   100.0% |  635.0 |
```

Two readings of this table:

- **The cheap seats are shockingly good.** Twenty random cosines already get 85%; fifty get 98%. The spiral needs far fewer features than the "kernel machines are infinite-dimensional" framing suggests — because the *useful* part of the RBF feature space for this dataset is low-dimensional, and random projections find it fast. (§3.4's error table said kernel estimates at D=25 are noisy to ±0.09 — and the classifier doesn't care, per §3.3c.)
- **The last decimal points are expensive.** The step from 98.0% (D=25, 7.6 ms) to 100.0% (D=400, 635.0 ms) costs ~84× the fit time. The fit cost curve is the O(P³) ridge solve on P = 2D features waking up (§6's third limitation): at D=400 the solve is on an 800×800 system and costs almost as much as the N=1500 exact kernel fit. RFF doesn't delete the cubic cost — it moves it from N (which you don't control) to D (which you do).

### 4.4 What this section proved

The three claims from §1 are now measured facts on this dataset: the kernel is necessary (linear fails), the RFF approximation of it is faithful (within 0.2 points of exact at D=200, equal at D=400), and its cost scales in D instead of N (flat prediction time in the §1.2 table; fit crossover near N≈1000). All from `buildRFF`/`mapRFF`/`ridgeSolvePro`/`KernelELM` — no math was reimplemented outside the library except the test-oracle recomputation of raw features used to verify identities.

---

## 5. RFF vs Nyström: two ways to shrink the same kernel

`KernelELM` already ships the other famous kernel approximation, Nyström (`mode: 'nystrom'`, options at `KernelELM.ts:25-38`). Both methods build a finite feature map whose dot products approximate k, but they choose their basis oppositely:

| | **RFF** | **Nyström** |
|---|---|---|
| Basis comes from | the *kernel* — random frequencies from p(w), drawn before ever seeing data | the *data* — m landmark training points, features = (whitened) kernel evals against them |
| Data-dependent? | no | yes |
| Approximation error | ~1/√D uniformly, regardless of data | can be far better than 1/√m *if* the kernel matrix has fast-decaying spectrum (data on a simple manifold), worse if not |
| Needs at map time | W (D×d) and b — never any training point | the m landmark points (m×d), plus whitening matrix |
| Kernel scope | shift-invariant only (Bochner) | **any** positive-definite kernel — poly included |
| Streaming/parallel | trivially — the map is data-independent | landmark selection wants a pass over data |

Measured head-to-head at matched feature budgets (Nyström with m landmarks ⇒ m features, uniform sampling, seeded; RFF with D = m/2 ⇒ m features):

```
[RFF vs Nyström]  (feature budget = final feature count for both; σ=0.25, λ=0.001)
| features | RFF acc | RFF fit ms | Nyström acc | Nyström fit ms |
|----------|---------|------------|-------------|----------------|
| 50       |   98.0% |        7.1 |       99.7% |           12.5 |
| 100      |   99.3% |       17.4 |      100.0% |           36.1 |
| 200      |   99.5% |       47.0 |      100.0% |          104.5 |
```

**Nyström wins at every budget here, and that is the theoretically expected result, not an upset.** The spirals live on a 1-dimensional curve inside ℝ² — about as fast-decaying a kernel spectrum as data can have — and Yang et al. (2012) proved that is precisely the regime where Nyström's data-dependent basis beats RFF's data-oblivious one: 50 landmarks *on the spiral* describe the spiral better than 25 random frequencies that were drawn without ever seeing it. RFF's advantages are structural rather than accuracy-first: it never stores training data in the map (relevant if landmarks would leak something), the map exists before any data arrives (streaming, `OnlineRidge` on top of `mapRFF` is a natural pairing — see `src/pro/math/online-ridge.ts`), it parallelizes embarrassingly, and it extends to kernels where you'd rather sample a known p(w) than manage landmark selection.

Rule of thumb this table supports: **at equal budget on manifold-like data, prefer Nyström; prefer RFF when the map must be data-independent, streaming, or private.** Both beat exact KernelELM's economics past N≈1000 (§1.2).

---

## 6. Limitations, and what surprised us

### Limitations (of RFF, and of this notebook's experiments)

- **Shift-invariant kernels only.** Bochner's theorem is the load-bearing wall, and it only holds for k(x,y) = κ(x−y). `KernelELM`'s `'rbf'`, `'laplacian'` (Cauchy-distributed frequencies) qualify; `'poly'` and `'linear'` do not. Random features for those exist (random Maclaurin, tensor sketch) but are different constructions — Nyström (§5) handles all PD kernels uniformly.
- **σ is still a hyperparameter, and RFF inherits it fully.** The frequency distribution is *derived from* σ (§2.3); a mis-set σ isn't fixed by more features — D controls how faithfully you approximate the kernel you asked for, including a wrong one. Here σ = 0.25 came from eyeballing the arm gap; on real data expect to sweep it.
- **The cubic cost moves, it doesn't vanish.** The ridge solve is O(P³) in the feature count P = 2D (measured: D=400 fit ≈ 634 ms, §4.3). RFF trades O(N³) for O(N·P² + P³) — a win when N ≫ P, a loss otherwise, and the loss was measured, not hypothetical: exact KernelELM beat RFF below N≈1000 (§1.2).
- **1/√D is a slow rate.** Each extra digit of kernel precision costs 100× the features (§3.4). RFF works because learning needs *fidelity in aggregate*, not per-pair precision (§3.3c) — applications that need accurate individual kernel values should not use it.
- **Small-scope experiment.** d = 2, one dataset, one σ, N ≤ 2000, single-machine timings. The *shapes* (scaling exponents, 1/√D, Nyström-beats-RFF-on-manifolds) are theory-backed and should transfer; the specific milliseconds and the N≈1000 crossover point will not.

### What surprised us

1. **The "conditioning hack" is exact textbook math.** `mapRFF`'s L2-normalize, commented as keeping ridge well-conditioned, is *identically* the 1/√D scaling, because ‖z_raw‖² = D for every input by cos² + sin² = 1 — the feature vector's norm is deterministic even though every entry is random. Proving that (and then watching the suite confirm it to 1e-13) was the single most satisfying moment of the derivation. The comment undersells the code.
2. **The phases `b` are decorative.** `buildRFF` dutifully samples D random phases, and the angle-difference identity cancels them out of every inner product the model can ever compute. They're load-bearing in the single-cosine variant of RFF, and inert in the paired cos/sin variant the library ships. Nothing is broken — but a future edit could delete `b` from this code path with zero behavioral change (to inner products), which is not what you'd guess reading the struct.
3. **Exact kernel methods won the small-N regime.** Going in, the story was "RFF fast, exact slow." The measured story is "exact is *faster* until N≈1000 on this machine" — approximating has fixed costs, and 250 points just don't need approximating. The right mental model is a crossover, not a hierarchy.
4. **Nyström swept the accuracy comparison.** Expected from Yang et al. once the spiral's manifold structure is pointed out, but it reframes RFF's pitch: on this kind of data you choose RFF for its *data-independence* (streaming, privacy, parallelism), not raw accuracy-per-feature.
5. **A wrong-signed kernel estimate (−0.011 for a true 0.000002) coexisting with 99.8% accuracy** is the crispest demonstration of "unbiased noise averages out downstream" I've seen — §3.3c. Twenty random cosines getting 85% on the spiral (§4.3) is the same surprise from the other side.

### Open questions / future work

- **Streaming demo:** `OnlineRidge` (`src/pro/math/online-ridge.ts`) + `mapRFF` is a rank-1-update RFF learner, the natural "L04 online learning meets L06 kernels" bridge — a candidate lesson or Show & tell demo.
- **A browser visualizer** of the D sweep (drag a slider, watch the spiral boundary sharpen) would make this notebook's §4.3 table visceral; parked per ADR-0006 §3 (deliverable-3 Option C).
- **Laplacian/Cauchy pair:** the suite only exercises the Gaussian pair; a five-line extension would validate the Laplacian kernel against Cauchy-sampled frequencies and make the "different kernel, different p" claim measured rather than stated.
- **Where exactly is the crossover on other machines/dims?** N≈1000 at d=2 on an M1; the suite prints the table on any machine (`npx vitest run …`) — collecting a few environments would make a nice Discussions thread.

---

## 7. References

1. **A. Rahimi & B. Recht, "Random Features for Large-Scale Kernel Machines," NeurIPS 2007.** The RFF paper — construction, uniform convergence (Claim 1), experiments. The primary source for §3.
2. A. Rahimi & B. Recht, "Weighted Sums of Random Kitchen Sinks: Replacing minimization with randomization in learning," NeurIPS 2008. The follow-up: even the feature *weights* can be random.
3. S. Bochner's theorem: W. Rudin, *Fourier Analysis on Groups*, Interscience 1962, §1.4.3. The measure-theoretic statement §2.2 takes on faith.
4. C. Williams & M. Seeger, "Using the Nyström Method to Speed Up Kernel Machines," NeurIPS 2000. The other approximation, as shipped in `KernelELM` mode `'nystrom'`.
5. T. Yang, Y.-F. Li, M. Mahdavi, R. Jin, Z.-H. Zhou, "Nyström Method vs Random Fourier Features: A Theoretical and Empirical Comparison," NeurIPS 2012. Why §5's result is the expected one.
6. D. Sutherland & J. Schneider, "On the Error of Random Fourier Features," UAI 2015. Variance analysis of the paired cos/sin vs random-phase variants (§3.2, §3.3b).
7. F. Liu, X. Huang, Y. Chen, J. Suykens, "Random Features for Kernel Approximation: A Survey on Algorithms, Theory, and Beyond," IEEE TPAMI 2021. The map of everything past this notebook.

---

## Appendix A — the complete worked-example suite

Reproduced verbatim so the notebook is self-contained offline. **The canonical, executable source is the committed file** [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) — if this snapshot (taken 2026-07-14) and that file ever disagree, the file wins and this appendix needs updating.

```ts
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
```

## See also

- [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) — the committed, seeded suite that printed every number above.
- [`src/pro/math/rff.ts`](../../src/pro/math/rff.ts) — the 40 lines this notebook derives.
- [`src/pro/math/krr.ts`](../../src/pro/math/krr.ts) (`ridgeSolvePro`), [`src/core/KernelELM.ts`](../../src/core/KernelELM.ts) — the solver and baselines.
- [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — why the worked example is a permanent test suite.
- Lesson [L06 — kernels & Nyström](../../examples/lessons/L06-kernels-nystrom/) — the curriculum's kernel introduction this notebook extends.
- [NB-004](./NB-004-lesson-curriculum-design.md) — previous notebook; the curriculum context this capstone lives in.
