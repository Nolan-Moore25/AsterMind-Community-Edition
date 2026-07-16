# ADR-0007 — Active learning on Enter, training-speed optimization, and an audit of ADR-0004/ADR-0005

- **Status:** Proposed
- **Date:** 2026-07-07
- **Author:** Nolan Moore
- **Branch:** TBD — new branch off `main` (e.g. `feature/active-learning-and-speed`); no implementation has started yet. (The audit below did touch two files live during verification — see § Audit — those two small fixes are already on `Simple-Prediction`.)
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0004](./ADR-0004-context-based-next-word-predictor.md)/[IMPL-0004](../implementation-plans/IMPL-0004-context-based-next-word-predictor.md) (v1, audited below); [ADR-0005](./ADR-0005-active-typing-word-prediction.md)/[IMPL-0005](../implementation-plans/IMPL-0005-active-typing-word-prediction.md) (v2, audited below); [IMPL-0007](../implementation-plans/IMPL-0007-active-learning-and-training-speed.md) (this decision's execution plan).

---

## 1. Context

Three separate asks, ordered here by dependency rather than by how they were requested: an audit of whether ADR-0004/ADR-0005 were actually followed (§ Audit), a training-speed investigation (needed because active learning's UX depends on how expensive a retrain is), and an active-learning feature where pressing Enter on a typed sentence adds it to the training data with a boosted weight.

- **Background / current behavior:**
  - `examples/nolan-test/word-predictor/main.js` (`bootstrapUnsafe()`, line 398) trains a classic `AutoComplete` ELM once per cache-miss page load, then evaluates it with five to seven separate per-example loops (`AutoComplete.top1Accuracy()` at `src/tasks/AutoComplete.ts:293`, the demo's own `topKAccuracy()` at `main.js:179`, and `collectCalibrationRows()` at `main.js:205`, called on the train/val/test splits and again for calibration). Each of these calls `AutoComplete.predict(text, k)` → `ELM.predict(text, topK)` (`src/core/ELM.ts:492`) once **per pair**, and each call re-derives the hidden-layer projection from scratch.
  - `examples/nolan-test/ham-spam/main.js` already solved the identical problem for its own classifier — its code comment (`main.js:106-111`) documents that per-row prediction "re-transposes W and re-derives the activation function on every single row" and that batching the whole evaluation set into one matrix multiply measured "~9-11x faster" (`batchedPredict()`, `main.js:112-123`). The word-predictor demo never adopted this pattern.
  - `ELM.predictFromVector()` (`src/core/ELM.ts:509`, used internally by nothing in this demo but tempting to reach for) is explicitly commented `/** Vector batch prediction (kept for back-compat) */` — it accepts an array of vectors but loops the single-row path internally, so it does **not** vectorize despite the name. The method that actually does, `predictLogitsFromVectors`/`predictProbaFromVectors` (`ELM.ts:539`, `:557`), does one matrix multiply for the whole batch and is already public — just unused by this demo.
  - `AutoComplete.train(weights?: number[])` (`src/tasks/AutoComplete.ts:208`, added by ADR-0005) already accepts per-pair sample weights and forwards them to `ELM.trainFromData`'s weighted ridge solve. ADR-0005 used this for context-frequency down-weighting, which — per its Revisions section — measurably hurt accuracy and was **not** shipped. The mechanism itself is sound (proven by the dedup-equivalence test in § Training-speed investigation below); only that one specific weighting formula was falsified.
  - `AutoComplete.model` (`src/tasks/AutoComplete.ts:94`) and, for the `elm` engine, the underlying `ELM.encoder` (`ELM.ts:107`) and `ELM.categories` (`ELM.ts:98`) are all public — a batched evaluation helper can be built entirely from already-exposed API surface, no core-library change required.
- **Constraint(s):**
  - Whatever active learning does must not bypass the accuracy gate that IMPL-0004/ADR-0005 already established (`MIN_VAL_TOP1_ACCURACY`/`MIN_VAL_TOP3_ACCURACY`, `main.js:22-23`) — a single bad user-typed sentence must not be able to silently degrade the shipped model.
  - The static corpus's val/test splits must stay uncontaminated by user-submitted sentences, or every accuracy number this demo has reported since IMPL-0004 stops being an honest evaluation.
  - Any retrain triggered by typing must be fast enough not to visibly freeze the single-threaded UI for an unreasonable stretch — this is the direct motivation for measuring, not assuming, the speed-optimization numbers below before designing the feature around them.
- **Trigger for this decision:** three requests — (1) active learning: pressing Enter on a typed sentence adds it to training data with a slightly larger weight; (2) find ways to optimize training speed without losing much performance; (3) validate that ADR-0004/ADR-0005 and their IMPL plans were actually followed correctly.

## Audit of ADR-0004 / ADR-0005

Every "Done when" item across both IMPL plans was re-checked against the **current, live code** — not re-read and assumed correct. Two categories of finding:

**Process/hygiene drift (all fixed as part of this audit, on `Simple-Prediction`):**

| Finding | Fix |
|---|---|
| `examples/nolan-test/main.js` moved to `examples/nolan-test/ham-spam/main.js` in a commit made directly on the branch (`8502285`, outside any ADR), leaving ~15 stale citations across ADR-0004, ADR-0005, IMPL-0004, IMPL-0005, `word-predictor/main.js`, and `word-predictor/README.md` pointing at a path that no longer exists. | All citations repointed to `ham-spam/main.js` (line numbers unchanged — the file's content didn't change, only its location). |
| IMPL-0004's 16 "Done when" checkboxes and IMPL-0005's 8 (3 Open Questions + 5 Done-Checklist) were **never ticked** in the markdown, despite the underlying work being complete — a reader diffing the file against reality would see 24 unchecked boxes on "finished" work. | All 24 re-verified individually (see below) and checked off, several with an inline note on how/when they were verified. |
| ADR-0004's `Status` field still read `Proposed` and its sign-off checklist was 4/5 unchecked, months after IMPL-0004 shipped. | Updated to `Accepted`; sign-off checklist completed. |

**Real gaps found — items that were checked-off-by-inference rather than actually exercised, two of which surfaced genuine bugs:**

| IMPL-0004 item | What the audit found |
|---|---|
| "A passing run caches to IndexedDB; reloading the page skips training and loads instantly." | Never literally tested with a second page load. Built a two-window simulation sharing a fake persistent IndexedDB; confirmed the second load's metrics correctly read `"loaded from cache — no training this run"`. **No bug** — worked as designed. |
| "Deliberately breaking the gate... confirms the model is not cached and a warning is logged." | Never actually run for v1 or v2 — the original "done when" was satisfied by reading the `if (passed) {...} else {...}` code, not by executing it against a genuinely bad model. First attempt at adversarial test data crashed with an **unhandled promise rejection** (`ELM.trainFromData: X is empty`): a corpus where every candidate label appears only once produces an empty vocabulary after the `minLabelFreq: 2` filter, and `bootstrapUnsafe()` (`main.js:398`, then just `bootstrap()`) had **no error handling** around training. **Real bug, fixed:** wrapped the body in a new outer `bootstrap()` that catches and reports failures via status text instead of hanging with a permanently-disabled input (`main.js:515-522`). Second finding: my first attempt at "unlearnable" test data used a fixed shared prefix per group, which made 2/3 of each sentence's context windows trivially deterministic and let the model hit 76-100% "accuracy" on data that was only supposed to be ambiguous in its last word — a reminder that constructing genuinely-unlearnable synthetic data is easy to get subtly wrong. A fully-random (every token, seeded) corpus fixed the test; the gate then correctly rejected a model at ~9% val accuracy (chance level for a 12-word vocab) and logged the expected warning. |
| "Arrow keys / Enter / Escape behave identically to the `03` demo." | Never exercised with real `KeyboardEvent`s — the original verification clicked suggestion items directly. Dispatching actual `ArrowDown`/`ArrowUp`/`Enter`/`Escape` events surfaced one harmless issue: jsdom doesn't implement `Element.scrollIntoView` (all real browsers do), which threw inside `updateSelection()`. **Small fix:** `scrollIntoView?.(...)` — there was no reason for that call to be unguarded regardless. Core navigation logic (selection index tracking, Enter-selects, Escape-closes) was correct on first real test. |

Both code fixes are minimal, backward-compatible, and already verified by the same tests that found the gaps; see `main.js` for the current state. Everything else — the sentence/vocab pipeline, the hand-worked-example match, the train-only vocab fit, the debounced dropdown, the empty-context degradation, the recorded latency and accuracy numbers — held up exactly as documented.

## Training-speed investigation

Two independent, measured optimizations, both **mathematically exact** (verified to produce bit-identical accuracy to the current unoptimized path, not just "close"):

**1. Deduplicate training pairs, pass counts as `weights`.** 40.6% of the v2 corpus's 2367 training pairs are exact `(context, label)` duplicates (1407 unique). Weighted least squares with `weight = occurrence count` on the deduplicated set is the exact same normal-equations solve as unweighted OLS on the full duplicated set — `ELM.trainFromData`'s weighting (`ELM.ts:343-349`, scales each row by `sqrt(weight)` before the ridge solve) already implements this correctly. Measured: training time 1422ms (median of 5) → 875ms (**38.5% faster**), val accuracy unchanged at 36.71%/47.30% in both cases, exactly.

**2. Replace every per-example evaluation loop with a batched one.** `top1Accuracy()`, `topKAccuracy()`, and `collectCalibrationRows()` all call `predict()` once per pair, each call redoing the encode → matrix-transpose → forward-pass → softmax → sort sequence from scratch. Building a `batchedPredict()`-equivalent (same pattern as `ham-spam/main.js:112-123`) using the already-public `ELM.encoder` and `ELM.predictProbaFromVectors()` — encode the whole batch once, one matrix multiply, one softmax pass — measured **7.5x faster** on train-set top-1 accuracy (7093ms → 947ms) and **7.1x faster** on val-set top-3 accuracy (1280ms → 179ms), identical accuracy both ways to four decimal places.

**Combined estimated effect on real time-to-ready** (train + 4 accuracy calls + 2 calibration-row-collection calls; only train-top1 and val-top3 were directly measured above, the rest estimated from the consistent ~3ms/pair unbatched cost observed across both — flagged as estimated, not independently re-measured for every call):

| | Train | Eval (4 accuracy + 2 calibration calls) | Total |
|---|---|---|---|
| Current (unoptimized) | ~1.4s | ~14.7s (estimated) | **~16.1s** |
| Optimized (dedup + batched) | ~0.9s | ~2.0s (estimated) | **~2.9s** |

The eval cost — not training itself — is the dominant, previously-invisible expense; the UI's `training time: 1.4s` status line has never reflected the actual wall-clock cost of getting to "Ready." This reframes what "optimize training speed" should mean here, and is the direct enabler for active learning: a ~16s retrain is a non-starter for something triggered by pressing Enter; a ~3s one is plausible with a visible "learning..." state.

## 2. Decision

> We will (a) land the two measured, exact training-speed optimizations — pair deduplication with count-as-weight, and batched evaluation — as the prerequisite for a responsive retrain; and (b) implement active learning as a full retrain on Enter, merging the user's sentence into the training-only split with a fixed 3.0x weight (reusing ADR-0005's existing `WEIGHT_CEIL`), gated behind the same accuracy check that already protects the cached model, never contaminating the static val/test splits.

### Details

**(a) Speed: dedup + batched eval, landed together since both feed the same evaluation calls.**

```js
function dedupWithWeights(pairs) {
    const counts = new Map();
    const order = [];
    const keyOf = (p) => p.input + ' ' + p.label;
    for (const p of pairs) {
        const k = keyOf(p);
        if (!counts.has(k)) { counts.set(k, 0); order.push(p); }
        counts.set(k, counts.get(k) + 1);
    }
    return { pairs: order, weights: order.map((p) => counts.get(keyOf(p))) };
}

function batchedTopKAccuracy(model, pairs, k) {
    const elm = model.model;                 // public (AutoComplete.model)
    const enc = elm.encoder;                  // public on ELM
    const vectors = pairs.map((p) => enc.normalize(enc.encode(p.input)));
    const probs = elm.predictProbaFromVectors(vectors); // one matmul for the batch
    let correct = 0;
    for (let i = 0; i < pairs.length; i++) {
        const ranked = probs[i]
            .map((p, j) => ({ label: elm.categories[j], prob: p }))
            .sort((a, b) => b.prob - a.prob)
            .slice(0, k);
        if (ranked.some((r) => r.label === pairs[i].label)) correct++;
    }
    return correct / Math.max(1, pairs.length);
}
```

Both are additive, demo-level changes — no core-library edit, since `predictProbaFromVectors`, `encoder`, `categories`, and `model` are all already public. `batchedTopKAccuracy` replaces every call site that currently loops `predict()` per pair (`top1Accuracy`-equivalent calls, `topKAccuracy`, and `collectCalibrationRows`'s inner loop, which becomes: encode+batch-predict once, then slice each row's ranked list to `CALIBRATION_MAX_RANK`).

**(b) Active learning: full retrain on Enter, weighted, gated.**

Enter currently only does something when a suggestion is highlighted (`handleSuggestionNavigation`, `main.js:348-370`); it falls through to nothing otherwise. That's the extension point: **Enter with no suggestion selected submits the current input as a new training example** instead of being a no-op.

1. Require ≥ `K + 1` (4) tokens — anything shorter can't produce a single windowed pair. Below that, show a brief inline hint instead of silently doing nothing.
2. Generate pairs via the existing `buildContextPairs([sentence], K)` — no new pair-generation logic.
3. Persist the **raw sentence** (not the derived pairs) to a new IndexedDB store, capped at 200 entries with FIFO eviction, so it survives reloads and can be re-windowed fresh if `K` or the tokenizer ever changes.
4. Merge the derived pairs into `rawTrainPairs` **only** — never `valPairs`/`testPairs` — before vocab-building, so a genuinely new taught word can enter the vocab (subject to the existing `minLabelFreq` filter: taught once, it won't survive; taught twice, it will — no new mechanism, the existing one just now sees more data).
5. Weight: static-corpus pairs stay implicitly 1.0; user-taught pairs get 3.0 — reusing `WEIGHT_CEIL` from ADR-0005 (`main.js:30-31`, already justified there as "no context's influence... dominates by more than 3x a unit-weighted sample") rather than inventing a new number. After dedup (§ a), a pair's final weight is `1.0 × static_count + 3.0 × user_count` — the two mechanisms compose without any special-casing.
6. Retrain on the merged, weighted, deduplicated set using the now-optimized pipeline. Re-evaluate top-1/top-3 **only** against the untouched, static val/test splits — the same honest evaluation this demo has run since IMPL-0004. **Skip recalibration** on this incremental path (reuse the existing calibration coefficients) — one added sentence is very unlikely to shift the rank→confidence relationship enough to justify the extra cost every time; full recalibration still happens on a fresh page load.
7. Gate: if the retrained model clears `MIN_VAL_TOP1_ACCURACY`/`MIN_VAL_TOP3_ACCURACY` on the static splits, swap it in live and overwrite the `MODEL_KEY` cache entry (model + user-pairs metadata). If not, **keep serving the previous model**, still persist the sentence for a future attempt (maybe it helps once combined with more data later), and show a warning — the exact "validate before trusting a new artifact" shape the audit just confirmed the caching and calibration gates already use correctly.
8. UI feedback: success clears the input and shows `"✅ learned: '<sentence>' (N taught this session)"`; a gate-rejected retrain shows `"⚠️ that didn't help enough yet — kept for later, still using the previous model"` and does **not** clear the input's history/counter.

## 3. Options Considered

### Training-speed optimization

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Dedup + count-as-weight | Fewer rows through the ridge solve, same math | Provably exact, measured 38.5% faster, reuses ADR-0005's `weights` plumbing | Needs the dedup helper (small, new) | ✅ chosen |
| B. Batched evaluation via existing `predictProbaFromVectors` | One matmul per eval pass instead of one per pair | Provably exact, measured 7.1-7.5x faster, zero core-library change (already-public API) | None found | ✅ chosen |
| C. Reduce `hiddenUnits` (256 → smaller) | Cheaper ridge solve | Simple | Direct accuracy tradeoff already characterized by IMPL-0004's sweep (256 was the chosen point specifically because smaller configs lose real accuracy) — not a free win | rejected |
| D. Skip/defer accuracy evaluation on load | Removes the biggest measured cost entirely | Fastest possible | Blinds the caching gate — the exact mechanism the audit just spent an hour proving works correctly | rejected |
| E. Switch engine (`kernel`/`online`) for inherently cheaper training | Different architecture, possibly faster | — | The measured bottleneck is evaluation, not the ridge solve itself; this doesn't address the actual finding | rejected |

### Active learning mechanism

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Full retrain on merged, weighted pairs | Reuses `AutoComplete.train(weights)`, the accuracy gate, dedup, and batched eval — all already built and validated | Lowest new-risk path; every safety mechanism this demo has is a classic-ELM mechanism, all of which apply directly | Full retrain, not incremental — but now ~3s instead of ~16s per § Training-speed investigation | ✅ chosen |
| B. `OnlineELM` incremental RLS update | True incremental update, no full retrain | Most "real" personalization architecture | No accuracy gate equivalent exists for an RLS update in this demo today; forgetting-factor tuning is new complexity; ADR-0004 already parked this once as "the right eventual upgrade, not the right starting scope" — still true | rejected (parked, again) |
| C. Session-only (no persistence) | Simplest possible | Zero storage design needed | A page refresh erases everything taught — defeats the point of "active learning" as a feature | rejected |
| D. Ungated retrain (always swap in the new model) | No gate-check complexity | Simpler | Directly contradicts the "never ship an unvalidated artifact" invariant this codebase has enforced twice already (caching gate, calibration gate) — one bad sentence could visibly degrade the demo for the rest of the session | rejected |

## 4. Consequences

- **Positive:** time-to-ready drops from an estimated ~16s to ~3s with zero accuracy cost — a real, previously-invisible problem, fixed. Active learning gives the demo a genuinely new, demonstrable capability (teach it a phrase live, watch suggestions change) built entirely on already-validated infrastructure. The audit converts 24 "trust me" checkboxes into 24 actually-re-verified ones and fixes two real bugs (unhandled bootstrap exception, unguarded `scrollIntoView`) that had been shipping undetected since IMPL-0004.
- **Negative / cost:** the batched-eval helper duplicates a small amount of logic already present in `ham-spam/main.js` (acceptable — it's demo-level code reaching into the same already-public API surface, not a new abstraction); active learning adds a second IndexedDB store (user-submitted sentences) and a new failure mode (a retrain that doesn't clear the gate) that needs its own, distinct UI messaging.
- **Neutral / follow-on:** if the persisted-sentence cap (200) is reached in a real demo session, FIFO eviction is the simplest policy — revisit only if that actually happens. If retrain time ever grows past what feels responsive (e.g., after the corpus itself grows again), `OnlineELM` (Option B above) becomes the next real option to evaluate, not before.
- **Risks & mitigations:** a user could submit many similar sentences in a row, triggering back-to-back retrains — mitigated by disabling the input during an in-flight retrain (queue at most one pending resubmission) rather than overlapping training runs against shared model state.

## 5. Invariants / Guardrails

- Dedup + weighting must never change accuracy versus the unweighted, non-deduplicated baseline — this is provable (weighted least squares is exact) and must stay covered by a test asserting bit-close accuracy parity, not just "looks about right."
- `valPairs`/`testPairs` are never touched by active learning — only `rawTrainPairs` gets user-submitted pairs merged in, preserving the honesty of every accuracy number this demo reports.
- A retrain (from active learning) that fails the accuracy gate must never replace the live model or the cached one — same invariant IMPL-0004's caching gate and ADR-0005's calibration gate already established, now explicitly extended to a third artifact (the active-learning-updated model).
- User-submitted sentence weight is fixed at 3.0 (`WEIGHT_CEIL`), not user-configurable and not auto-tuned — keeps the mechanism simple and matches the already-justified ceiling from ADR-0005.
- `bootstrap()` (`main.js:515`) must always catch and visibly report failures — no code path should be able to leave the input permanently disabled with a silent unhandled rejection, per the bug this audit found and fixed.

## 6. Validation

- **Speed:** re-run the dedup and batched-eval measurements against the shipped code (not just the investigation's throwaway harness) and confirm the same order-of-magnitude improvement; report real numbers in `README.md`, not the estimates above.
- **Active-learning hand-derived check:** teach a genuinely novel lead-in phrase absent from the static corpus (e.g. `"my favorite hobby is ___"`) with three different endings via three separate Enter submissions; confirm the model's suggestions for that context subsequently surface the taught words, and confirm the vocab/model correctly reject a fourth, single-occurrence new word (per the `minLabelFreq` invariant) until it's taught at least twice.
- **Gate-rejection check for active learning:** submit a deliberately unhelpful sentence (e.g., unrelated random tokens) and confirm the retrain is evaluated, rejected, and the previous model stays live with a visible warning — the same "prove the gate blocks a bad artifact" bar the audit just held IMPL-0004's original gate to.
- **Regression check:** full `npm test` plus the existing word-predictor end-to-end verification must stay green throughout — this ADR must not be the thing that makes a future audit find a fifth unverified checkbox.

## 7. Sign-off Checklist

- [ ] ADR reviewed
- [x] IMPL plan written and linked
- [ ] Tests / guardrails in place
- [ ] Docs updated
- [ ] Branch correct for the work

---

## See also

- [ADR-0004](./ADR-0004-context-based-next-word-predictor.md) / [IMPL-0004](../implementation-plans/IMPL-0004-context-based-next-word-predictor.md) — audited above; both now `Accepted`/`Implemented` with every checklist item re-verified.
- [ADR-0005](./ADR-0005-active-typing-word-prediction.md) / [IMPL-0005](../implementation-plans/IMPL-0005-active-typing-word-prediction.md) — audited above; the `weights` mechanism this ADR reuses for active learning was built here.
- [IMPL-0007](../implementation-plans/IMPL-0007-active-learning-and-training-speed.md) — the execution plan for this decision.
- `examples/nolan-test/ham-spam/main.js` — source of the `batchedPredict()` pattern this ADR reuses for evaluation.
