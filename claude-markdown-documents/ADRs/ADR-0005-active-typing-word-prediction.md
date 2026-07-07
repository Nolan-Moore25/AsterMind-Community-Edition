# ADR-0005 — Active-typing word prediction, weighted larger corpus, and calibrated confidence

- **Status:** Accepted (with one sub-decision reversed post-implementation — see Revisions)
- **Date:** 2026-07-07
- **Author:** Nolan Moore
- **Branch:** `Simple-Prediction` (off `main`, on the author's fork)
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0004](./ADR-0004-context-based-next-word-predictor.md) (the whole-next-word predictor this extends); [IMPL-0004](../implementation-plans/IMPL-0004-context-based-next-word-predictor.md) (its execution); [IMPL-0005](../implementation-plans/IMPL-0005-active-typing-word-prediction.md) (this decision's execution plan); `examples/nolan-test/word-predictor/README.md` (the measured results this ADR responds to and that ground the Revisions section below).

---

## 1. Context

IMPL-0004 shipped `examples/nolan-test/word-predictor/` — a classifier that predicts the next **whole word** after a completed context (`"go to the "` → `store`/`park`/`movies`). It only fires once the user finishes a word and types a space; it has nothing to say about the word the user is *currently* typing. It also shipped with two measured, documented weaknesses rather than fixes:

- Background / current behavior:
  - `getSuggestions()` (`examples/nolan-test/word-predictor/main.js:153-160`) always joins the last `K` **completed** tokens into a context string and calls `model.predict(context, topK)`. There is no code path that treats a partially-typed trailing token as a prefix to filter against — mid-word, the input box shows no suggestions at all until the next space.
  - `selectSuggestion()` (`examples/nolan-test/word-predictor/main.js:185-191`) always **appends** a full new word. There is no "replace the word I'm still typing" path.
  - `ELM.predict(text, topK)` (`src/core/ELM.ts:492-506`) already computes a softmax over the **full** category list before sorting and slicing to `topK` — the full ranked distribution exists internally on every call, it's just discarded by the slice. Getting the full list back out only requires calling with `topK = vocab.length`; no model or core-library change is needed for that part.
  - `AutoComplete.train()` (`src/tasks/AutoComplete.ts:202-226`) builds `X`/`Y` from `this.trainPairs` and calls `(this.model as ELM).trainFromData(X, Y)` at line 225 with **no third argument**. `ELM.trainFromData` (`src/core/ELM.ts:311-350`) already accepts an optional `{ weights?: number[] }` that scales each sample's hidden-layer row and target row by `sqrt(weight)` before the ridge solve (`ELM.ts:343-349`) — the capability exists one level down and simply isn't wired through the task class. The comment already sitting at `AutoComplete.ts:224` (`// options: { reuseWeights?, weights? }; do NOT pass "task"`) shows this gap was already on someone's radar.
  - `examples/nolan-test/main.js:277-283` already establishes the per-sample-weight pattern this ADR reuses (`weights = trainRows.map(...)`, passed to `trainFromData(X, Y, { weights })`), and `examples/nolan-test/main.js:16` (`VOCAB_OPTS = { minDocFreq: 3, maxVocab: 1500 }`) establishes this repo's precedent for a "larger, stricter-filtered vocab" configuration.
  - `examples/nolan-test/word-predictor/README.md` ("Results" / "One honest caveat") documents, with real measured numbers: 227-sentence corpus, 156-word capped vocab, val top-1 **39.6%**, val top-3 **57.1%**, and — the caveat that matters here — displayed confidence percentages sit **near a uniform ~1%** even on correctly-ranked top picks, because `AutoComplete`'s `elm` engine fits a closed-form ridge regression against one-hot targets (mean-squared-error) rather than directly optimizing cross-entropy, so the post-hoc softmax is not a calibrated probability.
- **Constraint(s):**
  - Whatever mechanism predicts the in-progress word must not require retraining the classifier from scratch for every keystroke — training already costs ~555ms one-time (`README.md` "Results"); redoing that per character is a non-starter.
  - Any new per-sample weighting must go through `ELM.trainFromData`'s existing `weights` contract (`ELM.ts:314-317`) rather than inventing a parallel weighting mechanism, so it stays consistent with `examples/nolan-test/main.js`'s established pattern.
  - The 156-word v1 vocab and its cached model (`MODEL_KEY = 'word_predictor_v1'`, `examples/nolan-test/word-predictor/main.js:24`) must not be silently reused once the corpus, weighting, or output shape changes underneath it — a stale cache hit would serve a model trained under different assumptions than the code now expects.
- **Trigger for this decision:** three follow-on asks against the shipped v1 demo — (1) predict the word being typed *right now*, not just the next whole word; (2) grow the corpus and normalize training-pair influence so a handful of very common short contexts (e.g. the bare context `"i"`, which IMPL-0004 flagged as inherently ambiguous — see `README.md` "Why val top-1 plateaus...") don't dominate the fit the way raw frequency currently lets them; (3) fix the confidence-calibration caveat IMPL-0004 documented but didn't address, with a secondary regression on top of the primary ELM ridge-regression prediction.

## 2. Decision

> We will (a) add active-typing (partial-word) prediction by filtering the existing classifier's full ranked next-word distribution against the in-progress prefix at inference time, (b) grow the corpus roughly 3x and weight training pairs by an inverse-log²-of-context-frequency factor passed through a newly-threaded `weights` option on `AutoComplete`, and (c) fit a small secondary linear regression on validation-split `(rank, rawScore) → isCorrect` data to convert raw, poorly-calibrated ELM scores into a validated, reliability-checked confidence shown in the UI.

### Details

**(a) Active-typing prediction — inference-layer change only, no new model.**

Split the raw input text into a *completed-word context* and an *in-progress prefix* based purely on whether the text ends in whitespace:

```js
function splitInput(rawText, k = K) {
    const endsWithSpace = /\s$/.test(rawText);
    const tokens = tokenize(rawText);
    if (endsWithSpace || tokens.length === 0) {
        return { context: tokens.slice(-k), prefix: '' };
    }
    return { context: tokens.slice(0, -1).slice(-k), prefix: tokens[tokens.length - 1] };
}
```

`getSuggestions()` then requests the **full** ranked distribution — `model.predict(context.join(' '), vocab.length)`, not `topK` — filters to `label.startsWith(prefix)` when `prefix` is non-empty, and takes the top `SUGGESTION_TOPK` of what survives:

```js
function getSuggestions(rawText, topK = SUGGESTION_TOPK) {
    const { context, prefix } = splitInput(rawText);
    if (!context.some(t => knownContextTokens.has(t))) return [];
    const ranked = model.predict(context.join(' '), vocab.length); // full distribution
    const filtered = prefix ? ranked.filter(p => p.completion.startsWith(prefix)) : ranked;
    return filtered.slice(0, topK).map(p => ({ word: p.completion, prob: calibrate(p) }));
}
```

Worked example: input `"i want to go to the p"` → `context = ["go", "to", "the"]`, `prefix = "p"`. If the classifier's ranked distribution for `"go to the"` is (illustrative) `park, movies, gym, playground, mall, party, ...`, filtering to `startsWith("p")` yields `park, playground, party` in that order — exactly the ask in the request driving this ADR.

`selectSuggestion()` changes from always-append to **replace-the-prefix-if-mid-word**:

```js
function selectSuggestion(word) {
    const { prefix } = splitInput(input.value);
    input.value = prefix
        ? input.value.slice(0, -prefix.length) + word + ' '
        : input.value + word + ' ';
    ...
}
```

When `prefix === ''` this is identical to v1's append-only behavior, so the existing whole-next-word flow (type a space, get a suggestion) is preserved unchanged — this is additive, not a replacement of IMPL-0004's behavior.

**(b) Larger corpus + log²-frequency-weighted training.**

Grow `context-corpus.js` from 227 to **≥650 sentences** (~3x), with an explicit new corpus-authoring requirement beyond IMPL-0004 Phase 0's "≥20 contexts with ≥3 distinct next words": **at least 15 of those contexts must have ≥3 plausible next words that share a common first letter**, or the active-typing feature above has nothing interesting to filter down to in a live demo.

Add `AutoComplete.train(weights?: number[])` (optional, defaults to `undefined` — fully backward compatible with IMPL-0004's call site and every other existing caller) that forwards to `trainFromData(X, Y, { weights })` when provided:

```ts
// src/tasks/AutoComplete.ts
public train(weights?: number[]): void {
    ...
    (this.model as ELM).trainFromData(X, Y, weights ? { weights } : undefined);
}
```

In `main.js`, compute per-pair weights from **context frequency** (how often that exact `input` string recurs across training pairs — the thing IMPL-0004 found was capping accuracy):

```js
function contextWeights(trainPairs) {
    const freq = new Map();
    for (const { input } of trainPairs) freq.set(input, (freq.get(input) || 0) + 1);
    return trainPairs.map(({ input }) => {
        const w = 1 / Math.pow(Math.log2(freq.get(input) + 2), 2);
        return Math.min(3.0, Math.max(0.05, w)); // floor/ceiling — see Invariants
    });
}
```

A context like `"i"` (dozens of occurrences) gets pulled toward the floor; a context that appears only 2-3 times keeps close to full weight. This directly targets the accuracy ceiling IMPL-0004 documented rather than just re-describing it.

**(c) Calibrated confidence — a secondary regression on top of the primary prediction.**

`AutoComplete`'s `elm` engine prediction *is* a linear-regression-derived score (ridge-regression `beta` → logits → softmax). Rather than replacing that engine, fit a small **secondary linear regression** on the validation split that maps each candidate's `(rank, rawScore)` to a calibrated probability:

1. For every validation pair, call `model.predict(input, vocab.length)` (the same full-distribution call from (a)) and record `(rank, rawScore, isCorrect)` for ranks 1–10, where `isCorrect = 1` iff that rank's word equals the true label.
2. Fit `calibratedProb = a·rank + b·rawScore + c` by closed-form least squares (normal equations via the already-exposed `Matrix` helpers — `examples/nolan-test/main.js:11` already destructures `Matrix` off `window.astermind`; no new dependency).
3. Clamp output to `[0, 1]`.
4. Validate with a reliability check on the **held-out test split** (new — see below): bucket predictions by calibrated confidence into deciles, compare each bucket's mean predicted confidence against its empirical hit rate, and compute Expected Calibration Error (ECE). Only apply the calibration layer if its ECE beats raw-score ECE on that same test split; otherwise fall back to raw scores and log a warning — the same "validate, then gate" shape as IMPL-0004's caching gate, applied to a new artifact instead of the whole model.

Because IMPL-0004 already found raw scores are nearly flat (~1% regardless of rank), `rank` is expected to carry most of the signal and `rawScore` little — the fit will show this empirically rather than assuming it.

**Split changes from two-way to three-way.** Fitting the calibration regression on the same validation split used to gate the classifier's own cache, then also validating calibration quality on that split, double-dips the same 217 pairs. `splitCorpus()` becomes a 70/15/15 **train/val/test** split by sentence (same "never split a sentence's windows across sides" invariant as IMPL-0004), mirroring the three-way split `examples/nolan-test/main.js`'s `splitDataset()` already establishes as this repo's pattern for exactly this problem.

**Cache versioning.** The cached payload shape changes (weights metadata, calibration coefficients). Bump `MODEL_KEY` from `'word_predictor_v1'` to `'word_predictor_v2'` — same versioning-on-shape-change precedent as `examples/nolan-test/main.js:15`'s `'spam_ham_classifier_v5'`, rather than trying to make the old cache entry forward-compatible.

## 3. Options Considered

### Active-typing mechanism

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Filter existing classifier's full ranked output by prefix | No new model; pure inference/UI change | Zero training-cost impact; reuses everything IMPL-0004 already validated; simple to reason about | Can only surface words that exist verbatim in the capped vocab with that exact prefix — no fuzzy/typo tolerance | ✅ chosen |
| B. New context+prefix → completion-suffix model (03-style, context-aware) | Learns prefix completion directly, could in principle generalize past exact vocab words | New training-pair shape, new model, doubles training cost, redundant with a classifier that already ranks whole words | rejected |
| C. Two-stage: classifier ranks, then a fuzzy/edit-distance re-ranker blends in prefix similarity | Could tolerate typos, near-miss prefixes | Real complexity increase for a capability nothing in the request asked for | rejected (parked as a documented follow-on) |

### Corpus weighting

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Inverse-log²-context-frequency sample weights via `trainFromData`'s existing `weights` option | Reuses a mechanism the core library already has (`ELM.ts:314-317`); directly targets IMPL-0004's documented "short context dominance" finding | Requires threading `weights` through `AutoComplete.train()` (small, additive, backward-compatible library change) | ✅ chosen |
| B. Drop/subsample over-frequent short contexts instead of weighting them | Simpler to implement (just filter) | Throws away real training signal instead of down-weighting it; contradicts ADR-0004's "keep shorter contexts as-is" invariant | rejected |
| C. Bypass `AutoComplete` entirely, build/train the `ELM` directly in `main.js` (like `nolan-test/main.js` does) | Avoids touching library code at all | Loses `AutoComplete`'s prediction/serialization convenience for no real benefit; duplicates logic `AutoComplete` already owns | rejected |

### Confidence calibration

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Closed-form linear regression on `(rank, rawScore) → isCorrect`, gated by ECE improvement | Cheap (normal equations, no new math infra), directly testable via reliability diagram, fits this repo's existing "closed-form regression" idiom | A single linear fit may not capture a non-monotonic relationship if one exists | ✅ chosen |
| B. Platt scaling (logistic regression) | Standard, well-understood calibration technique | Needs an iterative solver the library doesn't have; adds real math infra for a demo | rejected |
| C. Isotonic / bucketed empirical calibration | Non-parametric, robust to non-linearity, arguably the most "correct" choice | More implementation surface (pool-adjacent-violators or manual bucket-and-lookup) than a demo needs *if* the linear fit's reliability diagram looks reasonable | rejected (documented fallback if Option A's reliability check fails) |
| D. Ship raw scores, keep documenting the caveat | Zero new work | Doesn't answer the actual ask — the caveat was already documented in IMPL-0004's README | rejected |

## 4. Consequences

- **Positive:** the demo now demonstrates a materially different, harder capability (context-aware mid-word completion) instead of a second variation on whole-word prediction; the weighting change directly targets a real, previously-just-documented accuracy ceiling instead of leaving it as a known limitation; displayed confidence numbers become something a user could actually trust as a ranking signal instead of a near-constant 1%.
- **Negative / cost:** corpus authoring at ~3x the size is real content work (IMPL-0004's 227-sentence corpus was itself the single largest time cost in that plan); `AutoComplete.ts` gets its first behavior change since ADR-0004 explicitly said none was anticipated — small and backward-compatible, but it's a public-task-class edit that needs its own test coverage; the calibration regression adds a second artifact (coefficients) that must be cached, versioned, and can itself fail its own quality gate, which is a new failure mode to reason about.
- **Neutral / follow-on:** if the log²-weighting floor/ceiling (0.05 / 3.0) needs tuning, that's a sweep in the same style as IMPL-0004's hidden-units sweep — a diagnostic, not a new mechanism. If Option A's calibration reliability check fails, Option C (isotonic/bucketed) is the documented next step, not a redesign.
- **Risks & mitigations:** a 3x larger corpus with the same `maxVocab: 750` cap could drop a much larger fraction of pairs than IMPL-0004's 11.9% — mitigated by raising `maxVocab` to `1500` (matching `nolan-test`'s established value) alongside the corpus growth, and by keeping the "log dropped-pair count, treat a large fraction as a signal to revisit" discipline from IMPL-0004 Phase 1. The three-way split shrinks the classifier's own val set relative to IMPL-0004's two-way split — mitigated by the corpus growing 3x in the same change, so the val split's absolute size should still grow, not shrink, versus v1's 217 pairs.

## 5. Invariants / Guardrails

- Prefix filtering is case-insensitive and operates only on the already-trained model's output — it must never trigger a retrain on keystroke.
- `AutoComplete.train(weights?)` must remain backward compatible: calling it with no argument (every existing call site, including IMPL-0004's) must behave identically to today.
- Sample weights are clamped to `[0.05, 3.0]` — no context's influence goes to (near) zero or dominates by more than 3x a unit-weighted sample, so weighting damps skew without silently deleting a context's signal entirely.
- The train/val/test split stays sentence-level (never token/window-level) — the same honesty invariant ADR-0004/IMPL-0004 established, now applied across three splits instead of two.
- The calibration regression is applied **only if** it beats raw-score ECE on the held-out test split; otherwise the UI shows raw scores and a console warning, mirroring IMPL-0004's "don't silently trust an unvalidated artifact" caching-gate pattern.
- `MODEL_KEY` is version-bumped (`word_predictor_v2`) — a v1 cache entry must never be loaded against v2 code.

## 6. Validation

- **Hand-derived check:** for the corpus context `"go to the"` with prefix `"p"`, confirm the top-3 filtered suggestions are corpus-plausible p-words (e.g. `park`, `playground`, `party`) — not a syntactically-valid-but-absent word, and not a word that doesn't start with `p`.
- **Automated metric:** val/test top-1 and top-3 accuracy after weighting, compared against IMPL-0004's baseline (39.6% / 57.1%) — the weighting change should move these, and the direction/magnitude gets reported, not assumed.
- **Calibration metric:** Expected Calibration Error (ECE) on the test split, calibrated vs. raw — the calibration layer only ships if it wins this comparison.
- **Manual UX pass:** typing progressively longer prefixes after a known context (e.g. `"the "` → `"the p"` → `"the pa"`) should visibly narrow the dropdown at each keystroke; an unmatched prefix (no vocab word starts with it) degrades to an empty dropdown, not an error — same bar IMPL-0004 set for unknown contexts.
- **Cache-versioning check:** loading the page with a `word_predictor_v1` entry already in IndexedDB (simulating an upgrade from IMPL-0004) must retrain under `word_predictor_v2` rather than attempting to load the incompatible v1 payload.

## 7. Sign-off Checklist

- [x] ADR reviewed
- [x] IMPL plan written and linked
- [x] Tests / guardrails in place
- [x] Docs updated
- [x] Branch correct for the work

---

## Revisions

- **2026-07-07 — Weighting (§2b) measured, and reversed.** Implementation
  found that log²-context-frequency sample weighting, as specified above —
  even after fixing a normalization bug that made an early version silently
  over-regularize the entire fit — **decreases** val/test accuracy on the v2
  corpus, and does so monotonically as the weighting gets more aggressive. A
  five-way sweep (unweighted vs. four weighting-strength variants) put
  unweighted training strictly ahead of every weighted configuration tested:
  unweighted reached 36.7% val top-1 / 47.3% val top-3; the best weighted
  variant reached 36.3% / 47.1%; the ADR's original proposed formula reached
  only 33.6% / 42.3%. **Decision reversed:** `bootstrap()` trains unweighted.
  `contextWeights()` and the `AutoComplete.train(weights?)` capability it
  depends on are still implemented and tested — this is a validated negative
  result about *this corpus*, not evidence the mechanism itself is broken —
  but the weighting is not applied in the shipped demo. Full ablation table
  and the reasoning for why down-weighting doesn't help matched-distribution
  accuracy: `examples/nolan-test/word-predictor/README.md` § "Weighting: a
  negative result". §2b, §3 (Corpus weighting), and §4 above are left
  as-written to preserve the original reasoning and the (falsified)
  hypothesis behind it — this section is the record of what actually
  happened.
- **2026-07-07 — Active-typing (§2a) and calibration (§2c) confirmed as
  proposed.** Both shipped essentially as designed. Active-typing's
  hand-derived check (`"go to the p"` → `park, playground, party, pool,
  please`) matches the ADR's worked example. Calibration's ECE gate passed
  on the held-out test split (raw ECE 0.0581 → calibrated 0.0289) and is
  applied. See `README.md` for full numbers.

---

## See also

- [ADR-0004](./ADR-0004-context-based-next-word-predictor.md) — the whole-next-word predictor this extends.
- [IMPL-0004](../implementation-plans/IMPL-0004-context-based-next-word-predictor.md) — its execution plan and the measured baseline this ADR responds to.
- [IMPL-0005](../implementation-plans/IMPL-0005-active-typing-word-prediction.md) — the execution plan for this decision.
- `examples/nolan-test/word-predictor/README.md` — source of every measured number cited above.
- `examples/nolan-test/main.js` — source of the weighting and three-way-split precedents reused here.
