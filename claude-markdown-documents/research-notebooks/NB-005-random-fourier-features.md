# NB-005 — Random Fourier Features, from scratch

**Date:** 2026-07-14
**Tags:** rff, kernels, bochner, KernelELM, nystrom, pro-math, capstone
**Outcome:** Derived Random Fourier Features from Bochner's theorem down to the exact lines of `src/pro/math/rff.ts`, and validated the derivation with a measured worked example on the two-spirals dataset using only real AsterMind code (`buildRFF`/`mapRFF`, `ridgeSolvePro`, `KernelELM`). Headline numbers: exact RBF `KernelELM` hits 100.0% on spirals but its fit cost grows $\sim82\times$ when $N$ grows $8\times$; RFF with 400 features hits 99.8% with fit cost growing only $\sim3.7\times$ over the same range, and flat prediction cost. Two honest wrinkles: exact kernel methods are *faster* below $N\approx1000$ (the approximation only pays past the crossover), and Nyström beat RFF at every matched feature budget on this dataset. Every number here is printed by the committed suite `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`.

> **Capstone context:** deliverable 3 of the [Nolan infrastructure lane](../../examples/capstones/nolan-infrastructure/STARTER.md), executed per [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md).

---

## 0. Who this is for, and how to re-run it

**Assumed background:** single-variable calculus (integrals, $e^x$, completing the square), basic linear algebra (dot products, matrices), and enough probability to read "expected value." **Not assumed:** any prior exposure to kernel methods, Fourier analysis, or measure theory. Where a real proof needs machinery beyond that, this notebook says so explicitly and states what is being taken on faith.

**Re-running the experiments:** every table below is printed by one command:

```bash
npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts
```

The suite is seeded end-to-end (dataset generation and the random feature draws), so the accuracy numbers and error tables reproduce exactly; wall-clock timings vary by machine and run. Measured environment for the numbers quoted here: **Node v22.20.0, Apple M1, darwin-arm64** (single-threaded vitest). Treat the timing *ratios* as the claim, not the milliseconds. The suite also runs as part of `npm test`, so these results are re-validated on every full test run (~5.7s of the suite's total).

**Notation used throughout:**

| Symbol | Meaning |
|---|---|
| $x, y \in \mathbb{R}^d$ | input points (here $d = 2$) |
| $\delta = x - y$ | the difference vector ("shift") |
| $k(x, y)$ | a kernel function; for us the RBF kernel $\exp(-\|\delta\|^2/(2\sigma^2))$ |
| $\sigma$ | RBF bandwidth (we use $\sigma = 0.25$ everywhere; `KernelELM` speaks $\gamma = 1/(2\sigma^2) = 8$) |
| $N$ | number of training points |
| $D$ | number of random frequencies; the feature vector has $2D$ entries |
| $w, b$ | a random frequency vector and a random phase |
| $z(x)$ | the random Fourier feature vector of $x$ |
| $\lambda$ | ridge regularization strength ($10^{-3}$ everywhere here) — see §1.3 |
| $\Phi, \Theta$ | the $N\times P$ matrix of feature vectors, and the $P\times K$ fitted weight matrix |

---

## 1. The problem: kernel methods are accurate and don't scale

### 1.1 What a kernel even is (from dot products up)

A linear classifier scores a point with a dot product: $\text{score}(x) = w^\top x + \text{bias}$. Geometrically that draws a straight line (hyperplane) through the input space. Some datasets are simply not separable by any line — the worked example in §4 uses one (two interleaved spirals), and the best any linear model manages on it is **66.2%**.

The classical fix is to *map the inputs somewhere else first*: pick a feature map $\varphi$, replace $x$ with $\varphi(x)$, and run the linear machinery there. A curve in the original space can be a straight line in feature space. The catch is that expressive $\varphi$'s are big — and the classical *trick* is that many algorithms only ever use feature vectors through dot products $\varphi(x)^\top\varphi(y)$. If you can compute that dot product directly with some function

$$
k(x, y) = \varphi(x)^\top \varphi(y)
$$

then you never need to materialize $\varphi(x)$ at all. Such a $k$ is a **kernel**, and swapping it in for dot products is the **kernel trick**.

The kernel this notebook cares about is the **RBF (Gaussian) kernel**:

$$
k(x, y) = \exp\!\left(-\frac{\|x - y\|^2}{2\sigma^2}\right)
$$

Read it as a *similarity dial*: it is 1 when $x = y$ and falls off smoothly with distance, with $\sigma$ setting how fast. With our $\sigma = 0.25$:

| distance $\|\delta\|$ | $k(x,y)$ |
|---|---|
| 0 | 1.000 |
| 0.25 ($=\sigma$) | 0.607 |
| 0.5 | 0.135 |
| 0.75 | 0.011 |
| 1.0 | 0.0003 |

The remarkable fact (not proved here) is that this $k$ corresponds to an *infinite-dimensional* $\varphi$ — an RBF model can carve decision boundaries of essentially arbitrary shape. The kernel trick gives you that power without ever writing $\varphi$ down.

### 1.2 What that costs, concretely, in this codebase

`KernelELM` in exact mode ([src/core/KernelELM.ts](../../src/core/KernelELM.ts), `fit()` at `KernelELM.ts:244`) does the textbook thing:

1. Build the **$N\times N$ kernel matrix** $K$, where $K_{ij} = k(x_i, x_j)$ — every training point against every other. That is $O(N^2 \cdot d)$ work and $O(N^2)$ memory.
2. Solve the ridge system $(K + \lambda I)\alpha = Y$ by Cholesky factorization — $O(N^3)$ arithmetic.
3. Keep **all $N$ training points** plus the $N\times K$ coefficient matrix $\alpha$ inside the model (`KernelELM.ts:271` logs `alpha(NxK)`), because predicting a new point $x$ requires computing $k(x, x_i)$ against *every stored training point* — $O(N\cdot d)$ per prediction, forever.

So training cost curves upward in $N$ twice (quadratic build, cubic solve), the model artifact grows linearly in $N$, and prediction slows linearly in $N$. Here is that story measured on this machine (spirals data, predict = 500 test points, details in §4):

```
[scaling vs N]  (predict = 500 test points; RFF D=200 → 400 features; σ=0.25, λ=0.001)
| N    | KELM-exact fit ms | KELM pred ms | KELM acc | RFF fit ms | RFF pred ms | RFF acc |
|------|-------------------|--------------|----------|------------|-------------|---------|
| 250  |              18.6 |          6.9 |   100.0% |       56.0 |        12.7 |   99.6% |
| 500  |              36.7 |          9.6 |   100.0% |       67.9 |        12.6 |   99.8% |
| 1000 |             219.7 |         18.9 |   100.0% |      133.4 |        11.9 |   99.8% |
| 2000 |            1521.8 |         33.0 |   100.0% |      206.5 |        12.0 |   99.8% |
```

Read the exact-KELM fit column down: $N$ doubles $250\to500\to1000\to2000$ and fit time multiplies by $\times2.0$, $\times6.0$, $\times6.9$. A pure $O(N^2)$ process would multiply by 4 per doubling and a pure $O(N^3)$ one by 8; the measured drift from $2\times$ toward $7\times$ is the $O(N^2)$ kernel-build being overtaken by the $O(N^3)$ Cholesky as $N$ grows. Over the whole range: $8\times$ the data → $\mathbf{82\times}$ the fit time. Prediction time grows right alongside (6.9 → 33.0 ms), because each prediction touches every stored training point.

Meanwhile the RFF column (the thing this notebook builds): fit grows 56 → 206.5 ms ($\times3.7$ over the same $8\times$ data range — roughly linear, as it should be for a fixed feature count), prediction is **flat ~12 ms** no matter how much training data there was, and accuracy gives up 0.2 points (99.8% vs 100.0%).

Two honest observations before moving on:

- **Below $N\approx1000$, exact wins.** At $N=250$ exact fit is 18.6 ms vs RFF's 56.0 ms — building 400 features per point costs more than just solving the tiny exact system. The approximation is an *asymptotic* win, not a universal one. If your dataset is small, use the exact kernel; that is what it's for.
- **The accuracy gap is real but tiny here** (0.2 points at $D=200$). §4 measures how it shrinks as $D$ grows.

The rest of this notebook is the question: **where do those 400 features come from, and why do their plain dot products imitate an RBF kernel?** The answer is a 1932 theorem from harmonic analysis plus a Monte-Carlo estimate, and it lands exactly on the 40 lines of [src/pro/math/rff.ts](../../src/pro/math/rff.ts).

### 1.3 The other half of every model here: ridge regression, briefly

Every model in this notebook — linear, RFF, and the kernel machine — ends in the same move: fit a linear map from features to targets by solving one equation. Since "ridge" appears in every table above, here is the whole idea, at the calculus level this notebook promised.

**Setup.** Stack the $N$ feature vectors as rows of a matrix $\Phi$ ($N\times P$ — for the linear model $P=3$, for RFF $P=2D$), and the $N$ training labels as rows of $Y$ ($N\times K$, one-hot: class 0 is the row $(1,0)$, class 1 is $(0,1)$). We want a weight matrix $\Theta$ ($P\times K$) making the predictions $\Phi\Theta$ close to $Y$ — specifically, minimizing the total squared error $\|\Phi\Theta - Y\|^2$.

**Solving it is single-variable calculus scaled up.** For one weight $\theta$ and one feature column $\varphi$, the error $\sum_i(\varphi_i\theta - y_i)^2$ is a parabola in $\theta$; set its derivative to zero and get $\left(\sum_i\varphi_i^2\right)\theta = \sum_i\varphi_i y_i$. The matrix version of that same derivative-equals-zero computation is the **normal equations**:

$$
\left(\Phi^\top \Phi\right) \Theta = \Phi^\top Y
$$

— a $P\times P$ linear system. No iteration, no learning rate, no epochs: one solve. **This is the entire reason everything in this repo trains in milliseconds** — the ELM family's core bet is "random features + closed-form linear solve" instead of gradient descent.

**The ridge part is the $+\lambda I$.** $\Phi^\top\Phi$ can be singular or nearly so (features that are duplicates or near-duplicates of each other make the parabola flat in some direction, so the minimizer isn't unique and the solve blows up numerically). The fix is to add a small penalty $\lambda\|\Theta\|^2$ to the objective, which after the same calculus turns the system into

$$
\left(\Phi^\top \Phi + \lambda I\right) \Theta = \Phi^\top Y
$$

Now the matrix is always invertible (positive definite), the solution is unique, weights are gently shrunk toward zero, and the solve is numerically stable. That modification is called **ridge regression**, $\lambda$ is the knob ($10^{-3}$ throughout this notebook), and choosing it too large blurs the fit while too small re-invites the instability.

**Where this lives in the library.** `ridgeSolvePro` ([src/pro/math/krr.ts:120](../../src/pro/math/krr.ts)) solves exactly this shape of system — Cholesky factorization first, adaptive jitter if the matrix is borderline, conjugate-gradient fallback if it stays stubborn. The linear and RFF models in §4 both call it on $(\Phi^\top\Phi + \lambda I)\Theta = \Phi^\top Y$. `KernelELM`'s exact mode solves the *kernel-space twin* $(K+\lambda I)\alpha = Y$ — same equation with the $N\times N$ kernel matrix where the $P\times P$ feature gram was, which is precisely how the $O(N^3)$ in §1.2 arises. And classification is just regression onto one-hot targets followed by an argmax over the $K$ predicted scores.

---

## 2. Bochner's theorem: kernels are disguised Fourier transforms

### 2.1 Shift-invariance

The RBF kernel only looks at the *difference* of its arguments: $k(x,y) = \kappa(x-y)$ with $\kappa(\delta) = \exp(-\|\delta\|^2/(2\sigma^2))$. Kernels with that property are called **shift-invariant** (or stationary): sliding both points by the same amount changes nothing. RBF and Laplacian kernels are shift-invariant; the polynomial kernel $(x\cdot y + c)^p$ is not (it cares about where the origin is). Everything in this notebook lives inside the shift-invariant world — that is scoping, and it comes back as a limitation in §6.

### 2.2 The theorem

> **Bochner's theorem (1932).** A continuous shift-invariant function $\kappa(\delta)$ on $\mathbb{R}^d$ is a valid kernel (positive definite) **if and only if** it is the Fourier transform of a finite non-negative measure. If additionally $\kappa(0) = 1$, that measure is a *probability distribution* $p(w)$:

$$
\kappa(\delta) = \int p(w)\, e^{i w^\top \delta}\, dw = \mathbb{E}_{w\sim p}\!\left[e^{i w^\top \delta}\right]
$$

The proof of the full theorem needs measure theory and is genuinely out of scope (see Rudin in §7 — this is the one thing this notebook takes on faith). But the *reading* of it is the whole game:

**every shift-invariant kernel is secretly an expected value over random frequencies.**

In probability language, $\kappa$ is the *characteristic function* of the distribution $p$. The kernel and the distribution are a Fourier-transform pair: pick the kernel, and a specific frequency distribution $p(w)$ is forced.

One cleanup step: our $\kappa$ is a real function, and $p$ turns out symmetric ($p(w) = p(-w)$) for real kernels. Split $e^{iw^\top\delta} = \cos(w^\top\delta) + i\sin(w^\top\delta)$; the sine is an odd function being averaged over a symmetric distribution, so its expectation is 0, and:

$$
\kappa(\delta) = \mathbb{E}_{w\sim p}\big[\cos(w^\top \delta)\big] \qquad (\star)
$$

No imaginary numbers survive. A kernel evaluation is *the average of a cosine at a random frequency*.

### 2.3 Deriving the Gaussian pair by hand

Bochner says a $p(w)$ exists for the RBF kernel. Which one? Claim:

$$
\kappa(\delta) = \exp\!\left(-\frac{\|\delta\|^2}{2\sigma^2}\right) \iff p(w) = \mathcal{N}\!\left(0,\ \sigma^{-2} I\right)
$$

— a Gaussian with standard deviation $1/\sigma$ per coordinate.

Note the reciprocal: a *wide* kernel (large $\sigma$, similarity decays slowly) uses *low* frequencies, and a *narrow* kernel needs *high* frequencies. That inverse relationship is the Fourier uncertainty principle wearing street clothes, and it is exactly what `rff.ts:13` implements (`const s = 1 / sigma`).

**The 1-D computation.** Let $p(w)$ be the density of $\mathcal{N}(0, 1/\sigma^2)$, i.e. $p(w) = \frac{\sigma}{\sqrt{2\pi}}\, e^{-\sigma^2 w^2/2}$. Compute the expectation in $(\star)$ with the complex exponential (easier algebra; we take the real part at the end):

$$
\mathbb{E}\!\left[e^{iw\delta}\right] = \int \frac{\sigma}{\sqrt{2\pi}}\, e^{-\sigma^2 w^2/2}\, e^{iw\delta}\, dw
$$

Work on the exponent. Complete the square in $w$:

$$
\begin{aligned}
-\frac{\sigma^2 w^2}{2} + iw\delta
&= -\frac{\sigma^2}{2}\left(w^2 - \frac{2i\delta w}{\sigma^2}\right) \\
&= -\frac{\sigma^2}{2}\left(w - \frac{i\delta}{\sigma^2}\right)^2 + \frac{\sigma^2}{2}\left(\frac{i\delta}{\sigma^2}\right)^2 \\
&= -\frac{\sigma^2}{2}\left(w - \frac{i\delta}{\sigma^2}\right)^2 - \frac{\delta^2}{2\sigma^2}
\end{aligned}
$$

The second term is constant in $w$ and factors out of the integral:

$$
\mathbb{E}\!\left[e^{iw\delta}\right] = e^{-\delta^2/(2\sigma^2)} \cdot \int \frac{\sigma}{\sqrt{2\pi}}\, e^{-(\sigma^2/2)\left(w - i\delta/\sigma^2\right)^2}\, dw
$$

The remaining integral is a Gaussian bump shifted by the imaginary constant $i\delta/\sigma^2$. For a calculus-level reading: shifting the variable of integration by a constant doesn't change the area under a Gaussian, so the integral is the same as $\int \frac{\sigma}{\sqrt{2\pi}}\, e^{-\sigma^2 u^2/2}\, du = 1$ (it's a normalized density). (That "shift by an *imaginary* constant changes nothing" step is the one place a real-analysis purist would demand contour-integration justification; it is legal, standard, and we won't belabor it.) So:

$$
\mathbb{E}\!\left[e^{iw\delta}\right] = e^{-\delta^2/(2\sigma^2)} \qquad \blacksquare
$$

**The $d$-D case is free.** Both sides factorize across coordinates: the multivariate Gaussian density is a product of 1-D densities, $e^{iw^\top\delta} = \prod_j e^{iw_j\delta_j}$, and the expectation of a product of independent things is the product of expectations:

$$
\mathbb{E}\!\left[e^{iw^\top\delta}\right] = \prod_j e^{-\delta_j^2/(2\sigma^2)} = e^{-\|\delta\|^2/(2\sigma^2)} \ \checkmark
$$

So for the RBF kernel, the recipe "draw $w$ from a Gaussian with std $1/\sigma$" makes $(\star)$ hold exactly. Different shift-invariant kernel, different $p$ — e.g. the Laplacian kernel $e^{-\|\delta\|/\sigma}$ pairs with the heavy-tailed Cauchy distribution — but the machinery is identical.

---

## 3. The RFF construction: Monte-Carlo the expectation, then factor it

### 3.1 From expectation to average

$(\star)$ is exact but still involves an integral. Rahimi & Recht's 2007 move is almost disrespectfully simple: **estimate the expectation by sampling.** Draw $D$ frequencies $w_1, \dots, w_D$ i.i.d. from $p$, and:

$$
\kappa(\delta) \approx \frac{1}{D}\sum_{k=1}^{D} \cos\!\left(w_k^\top \delta\right)
$$

That's a Monte-Carlo average of bounded terms (each cosine sits in $[-1,1]$), so the classical guarantees apply with no fine print:

- **Unbiased:** the expected value of the average is exactly $\kappa(\delta)$, for any $D$, even $D=1$.
- **$1/\sqrt{D}$ error:** the variance of one term is $\mathrm{Var}\!\left[\cos(w^\top\delta)\right] = \frac{1+\kappa(2\delta)}{2} - \kappa(\delta)^2 \le 1$, so the standard error of the average is at most $1/\sqrt{D}$. (That variance identity is the double-angle formula $\cos^2\theta = \frac{1+\cos2\theta}{2}$ plus $(\star)$ applied at $2\delta$ — a two-line exercise.)
- **Exponential tail:** Hoeffding's inequality gives $P(|\text{error}| > \varepsilon) \le 2e^{-D\varepsilon^2/2}$. Rahimi & Recht go further and prove the error is small *simultaneously for every pair of points* in a bounded region (their Claim 1), which is the guarantee a learning algorithm actually needs; the rate is still "error $\sim 1/\sqrt{D}$."

### 3.2 The factoring trick: from estimating $k$ to *being* a feature map

An estimate of $\kappa(\delta)$ isn't yet what §1 asked for — we need **features** $z(x)$, computed per-point with no knowledge of the other point, whose plain dot product is the estimate. The cosine-of-a-difference must factor into "something($x$) $\cdot$ something($y$)." The angle-difference identity does it:

$$
\cos(a - b) = \cos a \cos b + \sin a \sin b
$$

Set $a = w_k^\top x$ and $b = w_k^\top y$, and define per frequency the *pair* of features $(\cos w_k^\top x,\ \sin w_k^\top x)$. Stack all $D$ pairs and scale by $1/\sqrt{D}$:

$$
z(x) = \frac{1}{\sqrt{D}}\Big[\cos w_1^\top x,\ \dots,\ \cos w_D^\top x,\ \sin w_1^\top x,\ \dots,\ \sin w_D^\top x\Big] \in \mathbb{R}^{2D}
$$

Then, term by term:

$$
z(x)^\top z(y) = \frac{1}{D}\sum_{k=1}^{D}\Big[\cos w_k^\top x \cos w_k^\top y + \sin w_k^\top x \sin w_k^\top y\Big] = \frac{1}{D}\sum_{k=1}^{D}\cos\!\big(w_k^\top(x-y)\big)
$$

— exactly the Monte-Carlo estimator of §3.1, now factored as an honest dot product of $2D$-dimensional vectors. **This is the whole of RFF:** a linear model on $z$ is (approximately, unbiasedly, with $1/\sqrt{D}$ error) a kernel model with kernel $\kappa$. Kernel machine → linear machine, $N$-dependence gone.

(Many write-ups instead use a single cosine with a random *phase*, $z_k(x) = \sqrt{2/D}\,\cos(w_k^\top x + b_k)$ with $b_k \sim U[0, 2\pi]$ — averaging over the phase recovers the same expectation with a factor-2 bookkeeping change. The paired cos/sin variant used here has provably no-worse variance (Sutherland & Schneider 2015) and is what AsterMind implements.)

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

**(a) The L2-normalize is exactly the missing $1/\sqrt{D}$.** The code never multiplies by $1/\sqrt{D}$; instead it divides the raw vector by its own L2 norm, under a comment that reads like a numerical-conditioning heuristic. But the raw vector's norm isn't random at all: its squared norm is

$$
\|z_{\text{raw}}\|^2 = \sum_{k=1}^{D}\Big[\cos^2(w_k^\top x + b_k) + \sin^2(w_k^\top x + b_k)\Big] = \sum_{k=1}^{D} 1 = D, \quad \text{exactly, for every } x
$$

by the Pythagorean identity, applied once per (cos, sin) pair. Dividing by the norm *is* dividing by $\sqrt{D}$. The committed suite asserts this to machine precision — measured: `‖z_raw‖² − D = −1.14e-13` at $D=200$ (pure float round-off), and every coordinate of `mapRFF`'s output matches $z_{\text{raw}}/\sqrt{D}$ to $<10^{-12}$. A comment that says "keep ridge well-conditioned" is, mathematically, the exact textbook scaling. (It also future-proofs: if the feature definition ever changed to something without a deterministic norm, the normalize would still control scale — but as shipped, it is not an approximation of $1/\sqrt{D}$, it *equals* it.)

**(b) The phases `b` are provably inert here.** `buildRFF` samples a phase $b_k$ per frequency, and `mapRFF` adds it inside both the cos and the sin. Push it through the angle-difference identity: $\cos\big((a+\beta) - (b+\beta)\big) = \cos(a-b)$ — the phase *cancels identically* in every inner product. Phases are load-bearing in the single-cosine variant (§3.2's parenthetical), where averaging over them is what makes the estimator work; in the paired cos/sin construction they rotate each (cos, sin) pair in place and change nothing about any $z(x)^\top z(y)$. The suite verifies this indirectly by checking the inner product equals $\frac{1}{D}\sum_k\cos(w_k^\top\delta)$ — a formula with no $b$ in it — to $<10^{-12}$. Measured on the fixed pair $x=(0.3,-0.8)$, $y=(-0.5,0.2)$: `z(x)ᵀz(y) = −0.011301` and $\frac{1}{D}\sum\cos(w^\top\delta) = -0.011301$. Harmless, mildly wasteful, and a genuinely fun thing to discover by proof rather than by reading a paper.

**(c) That same measured pair shows what "unbiased but noisy" means.** The true kernel value for those two points is $k = \exp(-1.64/0.125) \approx 2\times10^{-6}$ — essentially "not similar at all" — while the $D=200$ estimate is $-0.011301$: wrong sign, absolute error $\approx 0.011$. That is not a bug; it is exactly the $\sim1/\sqrt{D}$ Monte-Carlo noise floor (compare the $D=200$ row below). Individual kernel estimates rattle around the truth; the *learning algorithm* on top averages over $N$ training points' worth of such estimates and doesn't care. If you need individual kernel values to be precise, RFF is the wrong tool; if you need a model, it's fine.

### 3.4 Measured convergence: the $1/\sqrt{D}$ law shows up on schedule

400 fixed random pairs in $[-1,1]^2$, $\sigma=0.25$, error $= |z(x)^\top z(y) - k(x,y)|$:

```
[approx error vs D]
| D    | mean abs err | max abs err | 1/√D    |
|------|--------------|-------------|---------|
| 10   | 0.16605      | 0.65417     | 0.3162  |
| 50   | 0.06613      | 0.26622     | 0.1414  |
| 200  | 0.03435      | 0.12778     | 0.0707  |
| 1000 | 0.01854      | 0.05719     | 0.0316  |
```

$D$ grows by a factor of 100 ($10\to1000$) and the mean error falls by a factor of $\approx9.0$ ($0.166\to0.0185$) — the square-root law almost exactly ($\sqrt{100}=10$). The mean error tracks roughly $\tfrac12\cdot1/\sqrt{D}$ down the whole table, and the max error (worst pair of 400) sits $\sim3$–$4\times$ the mean, consistent with the exponential tails from §3.1. Nothing here was fitted; the table is four seeds and a formula from 1932 agreeing with each other.

---

## 4. Worked example: two spirals, three models, real library code

### 4.1 The setup

The dataset is the classic torture test for linear models: two interleaved spiral arms (1.5 turns each, radius $0.1\to1.0$, arm-to-arm gap $\approx0.3$, Gaussian noise 0.03), $N=1500$ train / 600 test, seeded. $\sigma=0.25$ was chosen from the geometry — the kernel should regard "same arm, one step along" (distance $\approx0.1$–$0.2$) as similar and "other arm" (distance $\approx0.3+$) as dissimilar, and §1.1's similarity table shows $\sigma=0.25$ doing exactly that. The equivalent `KernelELM` bandwidth is $\gamma = 1/(2\sigma^2) = 8$ — getting that correspondence wrong makes every comparison below silently unfair, so the suite pins it in one constant.

The training data is two interleaved spiral arms with the geometry described above (1.5 turns, radius $0.1\to1.0$, noise 0.03) — class 0 and class 1 wind around each other with no straight-line separator anywhere in the plane, which is exactly the property the linear-vs-kernel comparison below depends on.

Three models, all built from public AsterMind API and one shared ridge fit:

| model | features | fit |
|---|---|---|
| (a) linear ridge | $[1, x_1, x_2]$ — 3 numbers | `ridgeSolvePro` on $(\Phi^\top\Phi+\lambda I)\Theta=\Phi^\top Y$ |
| (b) RFF + ridge | `mapRFF(buildRFF(2, 200, 0.25, rng), x)` — 400 numbers | same solver, same $\lambda$ |
| (c) exact kernel | `KernelELM` mode `'exact'`, RBF $\gamma=8$ | its own $(K+\lambda I)\alpha=Y$ |

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

The three models' behavior is visible in what they actually learn, not just their accuracy numbers. Linear ridge can only place a single straight boundary through a shape that has none — it's not a bad implementation, it's a good implementation of the wrong hypothesis class, which is exactly why it caps out at 66.2%. RFF + ridge learns a genuine spiral-shaped boundary: confident near the training data, and increasingly textured in the outer regions where no training data constrains the random features. Exact KernelELM's boundary is the cleanest of the three — it decays toward "no opinion" away from data rather than committing to texture, which is the reference answer the approximation is chasing.

The negative control (linear fails at 66.2%) matters as much as the positive ones: it proves the dataset genuinely requires the kernel, so the 99.8% isn't the dataset being secretly easy. All three bounds are asserted in CI (`accL < 0.7`, `accR > 0.9`, `accK > 0.9`, `|accK − accR| < 0.05`).

### 4.3 Accuracy as a function of $D$ — buying accuracy with features

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

- **The cheap seats are shockingly good.** Twenty random cosines already get 85%; fifty get 98%. The spiral needs far fewer features than the "kernel machines are infinite-dimensional" framing suggests — because the *useful* part of the RBF feature space for this dataset is low-dimensional, and random projections find it fast. (§3.4's error table said kernel estimates at $D=25$ are noisy to $\pm0.09$ — and the classifier doesn't care, per §3.3c.)
- **The last decimal points are expensive.** The step from 98.0% ($D=25$, 7.6 ms) to 100.0% ($D=400$, 635.0 ms) costs $\sim84\times$ the fit time. The fit cost curve is the $O(P^3)$ ridge solve on $P=2D$ features waking up (§6's third limitation): at $D=400$ the solve is on an $800\times800$ system and costs almost as much as the $N=1500$ exact kernel fit. RFF doesn't delete the cubic cost — it moves it from $N$ (which you don't control) to $D$ (which you do).

### 4.4 What this section proved

The three claims from §1 are now measured facts on this dataset: the kernel is necessary (linear fails), the RFF approximation of it is faithful (within 0.2 points of exact at $D=200$, equal at $D=400$), and its cost scales in $D$ instead of $N$ (flat prediction time in the §1.2 table; fit crossover near $N\approx1000$). All from `buildRFF`/`mapRFF`/`ridgeSolvePro`/`KernelELM` — no math was reimplemented outside the library except the test-oracle recomputation of raw features used to verify identities.

---

## 5. RFF vs Nyström: two ways to shrink the same kernel

`KernelELM` already ships the other famous kernel approximation, Nyström (`mode: 'nystrom'`, options at `KernelELM.ts:25-38`). Both methods build a finite feature map whose dot products approximate $k$, but they choose their basis oppositely:

| | **RFF** | **Nyström** |
|---|---|---|
| Basis comes from | the *kernel* — random frequencies from $p(w)$, drawn before ever seeing data | the *data* — $m$ landmark training points, features = (whitened) kernel evals against them |
| Data-dependent? | no | yes |
| Approximation error | $\sim1/\sqrt{D}$ uniformly, regardless of data | can be far better than $1/\sqrt{m}$ *if* the kernel matrix has fast-decaying spectrum (data on a simple manifold), worse if not |
| Needs at map time | $W$ ($D\times d$) and $b$ — never any training point | the $m$ landmark points ($m\times d$), plus whitening matrix |
| Kernel scope | shift-invariant only (Bochner) | **any** positive-definite kernel — poly included |
| Streaming/parallel | trivially — the map is data-independent | landmark selection wants a pass over data |

Measured head-to-head at matched feature budgets (Nyström with $m$ landmarks $\Rightarrow$ $m$ features, uniform sampling, seeded; RFF with $D=m/2 \Rightarrow$ $m$ features):

```
[RFF vs Nyström]  (feature budget = final feature count for both; σ=0.25, λ=0.001)
| features | RFF acc | RFF fit ms | Nyström acc | Nyström fit ms |
|----------|---------|------------|-------------|----------------|
| 50       |   98.0% |        7.1 |       99.7% |           12.5 |
| 100      |   99.3% |       17.4 |      100.0% |           36.1 |
| 200      |   99.5% |       47.0 |      100.0% |          104.5 |
```

**Nyström wins at every budget here, and that is the theoretically expected result, not an upset.** The spirals live on a 1-dimensional curve inside $\mathbb{R}^2$ — about as fast-decaying a kernel spectrum as data can have — and Yang et al. (2012) proved that is precisely the regime where Nyström's data-dependent basis beats RFF's data-oblivious one: 50 landmarks *on the spiral* describe the spiral better than 25 random frequencies that were drawn without ever seeing it. RFF's advantages are structural rather than accuracy-first: it never stores training data in the map (relevant if landmarks would leak something), the map exists before any data arrives (streaming, `OnlineRidge` on top of `mapRFF` is a natural pairing — see `src/pro/math/online-ridge.ts`), it parallelizes embarrassingly, and it extends to kernels where you'd rather sample a known $p(w)$ than manage landmark selection.

Rule of thumb this table supports: **at equal budget on manifold-like data, prefer Nyström; prefer RFF when the map must be data-independent, streaming, or private.** Both beat exact KernelELM's economics past $N\approx1000$ (§1.2).

---

## 6. Limitations, and what surprised us

### Limitations (of RFF, and of this notebook's experiments)

- **Shift-invariant kernels only.** Bochner's theorem is the load-bearing wall, and it only holds for $k(x,y) = \kappa(x-y)$. `KernelELM`'s `'rbf'`, `'laplacian'` (Cauchy-distributed frequencies) qualify; `'poly'` and `'linear'` do not. Random features for those exist (random Maclaurin, tensor sketch) but are different constructions — Nyström (§5) handles all PD kernels uniformly.
- **$\sigma$ is still a hyperparameter, and RFF inherits it fully.** The frequency distribution is *derived from* $\sigma$ (§2.3); a mis-set $\sigma$ isn't fixed by more features — $D$ controls how faithfully you approximate the kernel you asked for, including a wrong one. Here $\sigma=0.25$ came from eyeballing the arm gap; on real data expect to sweep it.
- **The cubic cost moves, it doesn't vanish.** The ridge solve is $O(P^3)$ in the feature count $P=2D$ (measured: $D=400$ fit $\approx634$ ms, §4.3). RFF trades $O(N^3)$ for $O(N\cdot P^2 + P^3)$ — a win when $N \gg P$, a loss otherwise, and the loss was measured, not hypothetical: exact KernelELM beat RFF below $N\approx1000$ (§1.2).
- **$1/\sqrt{D}$ is a slow rate.** Each extra digit of kernel precision costs $100\times$ the features (§3.4). RFF works because learning needs *fidelity in aggregate*, not per-pair precision (§3.3c) — applications that need accurate individual kernel values should not use it.
- **Small-scope experiment.** $d=2$, one dataset, one $\sigma$, $N\le2000$, single-machine timings. The *shapes* (scaling exponents, $1/\sqrt{D}$, Nyström-beats-RFF-on-manifolds) are theory-backed and should transfer; the specific milliseconds and the $N\approx1000$ crossover point will not.

### What surprised us

1. **The "conditioning hack" is exact textbook math.** `mapRFF`'s L2-normalize, commented as keeping ridge well-conditioned, is *identically* the $1/\sqrt{D}$ scaling, because $\|z_{\text{raw}}\|^2 = D$ for every input by $\cos^2+\sin^2=1$ — the feature vector's norm is deterministic even though every entry is random. Proving that (and then watching the suite confirm it to $10^{-13}$) was the single most satisfying moment of the derivation. The comment undersells the code.
2. **The phases `b` are decorative.** `buildRFF` dutifully samples $D$ random phases, and the angle-difference identity cancels them out of every inner product the model can ever compute. They're load-bearing in the single-cosine variant of RFF, and inert in the paired cos/sin variant the library ships. Nothing is broken — but a future edit could delete `b` from this code path with zero behavioral change (to inner products), which is not what you'd guess reading the struct.
3. **Exact kernel methods won the small-$N$ regime.** Going in, the story was "RFF fast, exact slow." The measured story is "exact is *faster* until $N\approx1000$ on this machine" — approximating has fixed costs, and 250 points just don't need approximating. The right mental model is a crossover, not a hierarchy.
4. **Nyström swept the accuracy comparison.** Expected from Yang et al. once the spiral's manifold structure is pointed out, but it reframes RFF's pitch: on this kind of data you choose RFF for its *data-independence* (streaming, privacy, parallelism), not raw accuracy-per-feature.
5. **A wrong-signed kernel estimate ($-0.011$ for a true $2\times10^{-6}$) coexisting with 99.8% accuracy** is the crispest demonstration of "unbiased noise averages out downstream" I've seen — §3.3c. Twenty random cosines getting 85% on the spiral (§4.3) is the same surprise from the other side.

### Open questions / future work

- **Streaming demo:** `OnlineRidge` (`src/pro/math/online-ridge.ts`) + `mapRFF` is a rank-1-update RFF learner, the natural "L04 online learning meets L06 kernels" bridge — a candidate lesson or Show & tell demo.
- **A browser visualizer** of the $D$ sweep (drag a slider, watch the spiral boundary sharpen) would make this notebook's §4.3 table visceral; parked per ADR-0006 §3 (deliverable-3 Option C).
- **Laplacian/Cauchy pair:** the suite only exercises the Gaussian pair; a five-line extension would validate the Laplacian kernel against Cauchy-sampled frequencies and make the "different kernel, different $p$" claim measured rather than stated.
- **Where exactly is the crossover on other machines/dims?** $N\approx1000$ at $d=2$ on an M1; the suite prints the table on any machine (`npx vitest run …`) — collecting a few environments would make a nice Discussions thread.

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

## Appendix A — where the worked-example code lives

The runnable suite is not reproduced here — it's committed at [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) and is the canonical source for every number and table in this notebook. Run it with:

```bash
npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts
```

## See also

- [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) — the committed, seeded suite that printed every number above.
- [`src/pro/math/rff.ts`](../../src/pro/math/rff.ts) — the 40 lines this notebook derives.
- [`src/pro/math/krr.ts`](../../src/pro/math/krr.ts) (`ridgeSolvePro`), [`src/core/KernelELM.ts`](../../src/core/KernelELM.ts) — the solver and baselines.
- [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — why the worked example is a permanent test suite.
- Lesson [L06 — kernels & Nyström](../../examples/lessons/L06-kernels-nystrom/) — the curriculum's kernel introduction this notebook extends.
- [NB-004](./NB-004-lesson-curriculum-design.md) — previous notebook; the curriculum context this capstone lives in.
