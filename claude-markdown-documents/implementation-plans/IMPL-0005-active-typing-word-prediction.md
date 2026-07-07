# Implementation Plan — Active-typing word prediction, weighted larger corpus, and calibrated confidence

- **Date:** 2026-07-07
- **Author:** Nolan Moore
- **Branch:** TBD — new branch off `main` (e.g. `feature/active-typing-word-prediction`)
- **Related ADR:** [ADR-0005](../ADRs/ADR-0005-active-typing-word-prediction.md)
- **Related docs / bugs:** [ADR-0004](../ADRs/ADR-0004-context-based-next-word-predictor.md) / [IMPL-0004](./IMPL-0004-context-based-next-word-predictor.md) (the v1 predictor this extends); `examples/nolan-test/word-predictor/README.md` (v1 measured baseline)

---

## 1. Goal

Extend the shipped `examples/nolan-test/word-predictor/` demo so that (a) it predicts the word the user is *currently typing*, narrowing suggestions to the capped vocabulary filtered by the in-progress prefix (`"i want to go to the p"` → `park`, `playground`, `party`); (b) it trains on a ~3x larger corpus with training pairs weighted by an inverse-log²-context-frequency factor, so a handful of very common short contexts stop capping accuracy the way IMPL-0004 measured and documented; and (c) it shows a calibrated confidence next to each suggestion instead of the near-uniform ~1% raw scores IMPL-0004 flagged as poorly calibrated. Done means: all three land behind measured validation (accuracy, calibration error) recorded in `README.md`, not asserted.

## 2. Scope

- **In scope:**
  - Prefix-filtering active-typing prediction (inference/UI layer only — no new model).
  - Corpus growth to ≥650 sentences with deliberate prefix-sharing structure.
  - `AutoComplete.train(weights?)` — a small, backward-compatible addition to `src/tasks/AutoComplete.ts`.
  - Log²-frequency sample weighting computed in `main.js`, passed through the above.
  - Three-way (train/val/test) corpus split, replacing IMPL-0004's two-way split.
  - A secondary closed-form linear regression for confidence calibration, gated on an ECE improvement check.
  - `MODEL_KEY` version bump (`word_predictor_v1` → `word_predictor_v2`).
- **Out of scope (explicitly):**
  - `OnlineELM` personalization — still parked per ADR-0004 Option D.
  - Fuzzy/typo-tolerant prefix matching (ADR-0005 §3, Option C, active-typing table) — documented follow-on only.
  - Platt scaling or isotonic calibration (ADR-0005 §3, Options B/C, calibration table) — only pursued if the linear-regression calibration's reliability check fails.
  - Any change to `src/core/ELM.ts` — `trainFromData`'s `weights` option already exists and needs no change (`ELM.ts:311-350`).
  - Promotion out of `examples/nolan-test/` into `examples/practical-examples/` — still Nolan's sandbox.
- **Assumptions / preconditions:**
  - IMPL-0004 is shipped and its numbers (227 sentences, 156-word vocab, val top-1 39.6%/top-3 57.1%, ~1% raw calibration) are the baseline this plan measures against.
  - `window.astermind` already exposes `Matrix` (used by `examples/nolan-test/main.js:11`) for the calibration regression's closed-form solve — confirmed, no new export needed.

## 3. Affected Areas

| Area | File(s) | Change |
|---|---|---|
| Task class | `src/tasks/AutoComplete.ts:202-226` | Add optional `weights?: number[]` param to `train()`, forwarded to `trainFromData(X, Y, { weights })` |
| Task class tests | `tests/*.test.ts` (new or extended, e.g. `tests/AutoComplete.test.ts`) | Cover `train()` with and without weights — backward-compat + weighted-fit correctness |
| Corpus | `examples/nolan-test/word-predictor/context-corpus.js` | Grow 227 → ≥650 sentences; add prefix-sharing structure |
| Pipeline | `examples/nolan-test/word-predictor/main.js` | Three-way split, context-frequency weighting, prefix-aware `getSuggestions`/`selectSuggestion`, calibration fit + gate, `MODEL_KEY` bump |
| UI | `examples/nolan-test/word-predictor/index.html` | No structural change expected; confirm confidence display still reads sensibly with calibrated values |
| Docs | `examples/nolan-test/word-predictor/README.md` | New sections: active-typing behavior, corpus v2 stats, weighting rationale + numbers, calibration methodology + ECE result |

## 4. Approach

Land in the same dependency order ADR-0005's three sub-decisions naturally imply: **weighting infrastructure and corpus first** (everything else measures against it), **active-typing second** (a pure inference-layer change, independently verifiable once the classifier exists), **calibration last** (needs a trained classifier and a held-out test split to fit and validate against). Each phase leaves the demo in a working, measured state — matching IMPL-0004's "no phase depends on unfinished work from a later phase" discipline.

The riskiest single step is the `AutoComplete.ts` edit — it's the only change to library code in this plan, everything else is example-level. It lands first, in isolation, with its own test, before any demo code depends on it.

## 5. Step-by-Step Plan

1. **`AutoComplete.train(weights?)`** — edit `src/tasks/AutoComplete.ts:202-226` to accept an optional `weights: number[]` and forward it to `trainFromData`. Verification: existing call sites (IMPL-0004's `model.train()`, `tests/practical-examples.test.ts` `03-smart-form-autocomplete` case, `tests/BindUI.test.ts` if applicable) still pass unmodified — confirms backward compatibility. Add a new test that trains the same pairs with and without a skewed weight vector and asserts the fitted `beta` differs (confirms weights actually reach the ridge solve, not just accepted and dropped).
2. **Grow the corpus** — extend `context-corpus.js` from 227 to ≥650 sentences. Reuse and extend the ~35 existing lead-in-phrase groups from IMPL-0004 Phase 0, and add new groups chosen so that **≥15 contexts have ≥3 plausible next words sharing a first letter** (e.g. extend the `"go to the ___"` group with `park, playground, plaza, pool, mall, market, museum, ...` so a `"p"`-prefix filter has real width to demonstrate). Verification: a short Node script (thrown away after use, same pattern as IMPL-0004's verification harness) counts sentences and checks the prefix-sharing requirement before any pipeline code changes.
3. **Three-way split** — change `splitCorpus()` to return `trainSentences`/`valSentences`/`testSentences` at a 70/15/15 ratio, sentence-level, same seeded-shuffle mechanism as v1. Verification: split sizes sum to the total; no sentence's tokens appear in more than one split (same hand-check style as IMPL-0004 Phase 0).
4. **Raise `maxVocab`** to `1500` (from `750`) to match the larger corpus, following `nolan-test/main.js:16`'s established value. Verification: log dropped-pair count and percentage on the new corpus; if it's a much larger fraction than IMPL-0004's 11.9%, that's a signal to revisit `maxVocab`/`minLabelFreq` before proceeding, per the existing IMPL-0004 diagnostic loop.
5. **Context-frequency weighting** — implement `contextWeights(trainPairs)` per ADR-0005 §2(b), clamped to `[0.05, 3.0]`. Train with `model.train(contextWeights(trainPairs))`. Verification: log the weight distribution (min/max/median); confirm the most-repeated context (expected: `"i"` or similar, per IMPL-0004's finding) lands near the floor and a rare context lands near 1.0.
6. **Re-measure classifier accuracy** — train top-1, val top-1/top-3, test top-1/top-3, reported the same way `README.md` "Results" reports v1's numbers. Compare directly against the 39.6%/57.1% baseline — record the actual delta, don't assume improvement.
7. **Active-typing prediction** — implement `splitInput()`, update `getSuggestions()` to request the full ranked distribution (`model.predict(context, vocab.length)`) and filter by prefix, update `selectSuggestion()` to replace-vs-append based on `prefix`. Verification: hand-derived check from ADR-0005 §6 (`"go to the p"` → corpus-plausible `p`-words only); confirm `prefix === ''` (trailing-space input) reproduces v1's exact append behavior byte-for-byte on a known example.
8. **Calibration regression** — on the val split, collect `(rank, rawScore, isCorrect)` for ranks 1–10 per pair; fit `calibratedProb = a·rank + b·rawScore + c` via closed-form least squares using `Matrix`. Clamp to `[0, 1]`. Verification: print the fitted coefficients and a reliability table (predicted-confidence decile → empirical hit rate) for manual sanity-check.
9. **Calibration gate** — compute ECE on the **test** split for both raw and calibrated scores; apply calibration only if it wins. Verification: deliberately corrupt the fit (e.g. force `a = b = 0, c = 0.5`) and confirm the gate correctly rejects it and falls back to raw scores with a warning — same "prove the gate blocks a bad artifact" check IMPL-0004 Phase 2 used for the caching gate.
10. **Cache versioning** — bump `MODEL_KEY` to `word_predictor_v2`; extend the cached payload with weighting metadata and calibration coefficients. Verification: seed IndexedDB with a `word_predictor_v1` entry (simulating an un-upgraded browser) and confirm the page retrains under v2 rather than attempting to load the old payload.
11. **README.md rewrite** — add sections for active-typing behavior (with the worked `"the p"` example and its actual observed output), corpus v2 stats, the weighting numbers (weight-distribution summary, before/after accuracy), and the calibration methodology + measured ECE, following the same "record what was actually measured" discipline as IMPL-0004's README.

## 6. Data / Migration

No database/schema migration — this is client-side IndexedDB cache state only. Migration path: bumping `MODEL_KEY` to `word_predictor_v2` (step 10) is the entire migration; the old `word_predictor_v1` entry is simply never read again and can be left as inert, unused space in the browser's IndexedDB (same pattern `nolan-test/main.js` already uses across its own `_v5` version history — no explicit cleanup of prior versions is this repo's established practice). Rollback: revert to the prior `main.js`/`context-corpus.js`/`AutoComplete.ts`; a `word_predictor_v2` entry left in a browser's IndexedDB is simply ignored by the reverted code, same as the forward migration.

## 7. Testing & Verification

- **Unit / spec:** new `AutoComplete.ts` test (step 1) — backward-compat (no-weights path unchanged) + weighted-fit correctness (weights measurably change `beta`). Hand-derived expected values: a 2-class, 4-sample toy dataset where one heavily-upweighted sample's label should dominate the fit — assert the trained model's prediction on that sample's input matches its label with high confidence, unweighted does not.
- **Integration / E2E:** the full pipeline verification harness pattern from IMPL-0004 (a throwaway vitest script driving the actual corpus + `main.js` pipeline functions, deleted after recording real numbers into `README.md`) — extended to cover the three-way split, weighting, active-typing filtering, and calibration fit/gate.
- **Manual / demo:** `npm run dev:word-predictor` (existing script, root unchanged); type a known context followed by a partial word (e.g. `"i want to go to the p"`) and confirm the dropdown narrows correctly at each keystroke; select a mid-word suggestion and confirm it replaces only the in-progress prefix.
- **Acceptance criteria:**
  - Positive control: `"go to the p"` surfaces only corpus-plausible `p`-words, correctly ranked.
  - Negative control: a prefix with zero vocabulary matches (e.g. `"go to the qq"`) shows an empty dropdown, not an error.
  - Classifier accuracy (val/test top-1, top-3) is measured and reported against the 39.6%/57.1% baseline — regression is acceptable only if explained (e.g. a harder, larger vocab) and documented, not silently accepted.
  - Calibration ships only if it beats raw-score ECE on the test split; if it doesn't, the demo ships with raw scores and the README documents why, rather than shipping an unvalidated calibration layer.

## 8. Rollout / Deploy

No server/deploy surface — this is a static-HTML browser demo served via `npm run dev:word-predictor` (Vite dev server) or built as part of the repo's example set. No feature flags needed: the `MODEL_KEY` version bump (step 10) is itself the rollout mechanism — every browser transparently retrains once under the new key, no coordination required. No blue/green or staged rollout applicable at this scope.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| 3x larger corpus at the same `maxVocab` drops a much larger fraction of pairs than v1's 11.9% | Med | Med | `maxVocab` raised to 1500 alongside corpus growth (step 4); dropped-pair percentage logged and treated as a signal to revisit, not proceed past silently |
| Log²-weighting floor/ceiling (0.05/3.0) needs tuning to actually move accuracy | Med | Med | Treat as a sweep (same diagnostic shape as IMPL-0004's hidden-units sweep), not a redesign; weights are an isolated, documented knob |
| Calibration regression doesn't pass its own ECE gate | Med | Low | Explicitly planned for — gate falls back to raw scores + warning (step 9); Option C (isotonic/bucketed, ADR-0005 §3) is the documented next step, not a blocker |
| `AutoComplete.ts` edit breaks an existing caller | Low | High | Edit is purely additive (optional param, `undefined` default preserves old behavior exactly); full existing test suite (`npm test`, 112 tests as of IMPL-0004) must stay green before this plan's own new tests are added |
| Corpus authoring at 3x scale takes materially longer than estimated | Med | Med | Same risk IMPL-0004 Phase 0 named for its smaller corpus; mitigation is the same — this is the step most likely to stretch the timeline, budget accordingly rather than compress later phases to compensate |

## 10. Open Questions

- [ ] Does the reliability check in step 8/9 show a linear `(rank, rawScore) → isCorrect` relationship, or does the data look non-monotonic enough to require the isotonic/bucketed fallback (ADR-0005 §3, calibration Option C) instead?
- [ ] Does raising `maxVocab` to 1500 on a ~650-sentence corpus land the dropped-pair percentage near IMPL-0004's 11.9%, or does the corpus need to grow further / `minLabelFreq` need adjusting to hit a comparable rate?
- [ ] Does the log²-weighting measurably move val/test accuracy versus an unweighted run on the *same* v2 corpus (isolating the weighting's effect from the corpus-size effect), or is corpus growth alone doing most of the work? Worth an ablation run before finalizing the numbers in `README.md`.

## 11. Done Checklist

- [ ] All steps complete and verified
- [ ] Tests green (`npm test`, including new `AutoComplete.ts` coverage)
- [ ] Docs / ADR updated (`README.md` rewritten with v2 measured numbers; ADR-0005 sign-off checklist updated)
- [ ] Deployed / merged to correct branch
- [ ] Sign-off

---

## See also

- [ADR-0005](../ADRs/ADR-0005-active-typing-word-prediction.md) — the decision this plan executes.
- [ADR-0004](../ADRs/ADR-0004-context-based-next-word-predictor.md) / [IMPL-0004](./IMPL-0004-context-based-next-word-predictor.md) — the v1 predictor and baseline this plan extends and measures against.
- `examples/nolan-test/word-predictor/README.md` — v1's measured results; will be rewritten in step 11 with v2 numbers.
- `examples/nolan-test/main.js` — source of the weighting and three-way-split precedents reused here.
