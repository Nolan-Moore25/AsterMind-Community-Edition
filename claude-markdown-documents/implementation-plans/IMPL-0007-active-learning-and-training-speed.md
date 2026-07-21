# Implementation Plan — Active learning on Enter, training-speed optimization, and an ADR-0004/0005 audit

- **Date:** 2026-07-07
- **Author:** Nolan Moore
- **Branch:** TBD — new branch off `main` (e.g. `feature/active-learning-and-speed`)
- **Related ADR:** [ADR-0007](../ADRs/ADR-0007-active-learning-and-training-speed.md)
- **Related docs / bugs:** [ADR-0004](../ADRs/ADR-0004-context-based-next-word-predictor.md)/[IMPL-0004](./IMPL-0004-context-based-next-word-predictor.md), [ADR-0005](../ADRs/ADR-0005-active-typing-word-prediction.md)/[IMPL-0005](./IMPL-0005-active-typing-word-prediction.md) (both audited by this plan's § Audit)

---

## 1. Goal

Three things, landed in dependency order: (1) an audit confirming ADR-0004/ADR-0005 were actually followed — done, findings and fixes recorded below, not a future step; (2) two measured, exact training-speed optimizations (pair deduplication, batched evaluation) that cut estimated time-to-ready from ~16s to ~3s; (3) active learning — pressing Enter on a typed sentence (when no suggestion is highlighted) adds it to the training data at 3x weight and triggers a gated retrain. Done means: speed numbers are re-measured against the shipped code and recorded in `README.md`, and active learning has a recorded hand-derived proof that teaching a novel phrase changes the model's suggestions.

## 2. Scope

- **In scope:**
  - § Audit (already executed as part of this plan's authoring — see below).
  - `dedupWithWeights()` — collapse exact-duplicate `(context, label)` pairs, pass counts as `weights` to `AutoComplete.train()`.
  - `batchedTopKAccuracy()` (or equivalent) — replace every per-example evaluation loop (`top1Accuracy`-equivalent calls, `topKAccuracy`, `collectCalibrationRows`) with one batched pass using `ELM.encoder` + `ELM.predictProbaFromVectors()`.
  - Enter-to-teach: input validation, pair generation, IndexedDB persistence of raw sentences (capped, FIFO), merge into `rawTrainPairs` only, 3.0x weighting, gated retrain, UI feedback.
- **Out of scope (explicitly):**
  - `OnlineELM` incremental updates — parked again per ADR-0007 §3 (Active learning mechanism, Option B).
  - Recalibration on every active-learning retrain — reuses existing calibration coefficients; full recalibration only on a fresh page load.
  - User-configurable teaching weight — fixed at 3.0 (`WEIGHT_CEIL`), not exposed as a UI control.
  - Any core-library (`src/`) change beyond what's already landed — `AutoComplete.train(weights?)`, `ELM.predictProbaFromVectors()`, `ELM.encoder`, `ELM.categories` are all already public; this plan only adds demo-level (`main.js`) code.
- **Assumptions / preconditions:**
  - ADR-0005's `weights` mechanism and accuracy gate are correct and load-bearing (re-confirmed by this plan's audit, not just assumed).
  - The estimated ~16s → ~3s speed figure in ADR-0007 is directional; this plan's step 1 re-measures against the actual shipped code before anything else is built on top of it.

## 3. Audit (executed; findings below, not a future step)

Every "Done when" checkbox in IMPL-0004 (16 items) and IMPL-0005 (8 items) was individually re-verified against the live demo — not re-read and assumed correct. Full detail and the reasoning behind each is in [ADR-0007 § Audit](../ADRs/ADR-0007-active-learning-and-training-speed.md#audit-of-adr-0004--adr-0005). Summary:

| # | Finding | Outcome |
|---|---|---|
| 1 | ~15 stale `examples/nolan-test/main.js` citations across 6 files, after an untracked-by-any-ADR commit moved the file to `examples/nolan-test/ham-spam/main.js`. | Fixed — all citations repointed, line numbers unchanged (content didn't move, only location). |
| 2 | 24 "Done when" checkboxes across both IMPL plans were never ticked despite the work being complete. | All 24 individually re-verified and checked off; IMPL-0004/IMPL-0005 `Status` fields and ADR-0004's sign-off checklist updated to match reality. |
| 3 | "Reload skips training" was never tested with an actual second page load. | Verified via a two-window simulation sharing a persistent fake IndexedDB. Worked correctly — no bug. |
| 4 | "Gate rejects a bad model" was never tested with real adversarial data. | **Real bug found:** an empty-vocabulary edge case (every candidate label appears once, filtered out by `minLabelFreq: 2`) threw an unhandled exception in `bootstrap()`, which had no error handling. **Fixed:** `bootstrap()` now wraps training in try/catch and reports failure via status text (`main.js:515-522`). Gate itself, once properly tested with genuinely-random (not accidentally-structured) adversarial data, correctly rejects a ~9%-accuracy model and logs the expected warning. |
| 5 | "Arrow/Enter/Escape work identically to `03`" was verified by code similarity, never by dispatching real `KeyboardEvent`s. | Dispatching real events surfaced one harmless jsdom-only gap (`scrollIntoView` unimplemented in jsdom, present in all real browsers) that exposed an unguarded call. **Fixed:** `scrollIntoView?.(...)`. Core navigation logic was correct on first real test. |

Both fixes are already committed on `Simple-Prediction` (found and fixed live during this audit, not deferred to a later step, since they were small, safe, and directly relevant to the try/catch discipline active learning's retrain path also needs).

## 4. Affected Areas

| Area | File(s) | Change |
|---|---|---|
| Speed | `examples/nolan-test/word-predictor/main.js` | Add `dedupWithWeights()`, `batchedTopKAccuracy()`; replace all per-example eval call sites; train on deduplicated+weighted pairs |
| Active learning | `examples/nolan-test/word-predictor/main.js` | Enter-to-teach handler, IndexedDB store for user sentences, merge-into-train-only logic, 3.0x weighting, gated retrain, UI feedback |
| Active learning | `examples/nolan-test/word-predictor/index.html` | Small addition: a "taught this session" counter / feedback line near `#status` |
| Docs | `examples/nolan-test/word-predictor/README.md` | New sections: re-measured speed numbers, active-learning methodology + hand-derived proof |
| Docs (audit) | `IMPL-0004`, `IMPL-0005`, `ADR-0004` | Already updated (checklists, status fields, stale paths) as part of this plan's authoring |

## 5. Approach

Land speed optimization **first and in isolation** — it's provably exact (verified via accuracy-parity assertions), has no UX-visible behavior change, and is the direct prerequisite for active learning feeling responsive rather than janky. Only after it's landed and re-measured does active learning get built on top of it, so the feature's design (full retrain on Enter) is validated against real numbers, not the ADR's estimates.

Within active learning, land the data/weighting/gating logic before the UI polish — the gate is the safety-critical part (per the audit's own finding that untested gates are exactly where real bugs hide), so it gets its own explicit negative-control test before anything user-facing depends on it.

## 6. Step-by-Step Plan

1. **`dedupWithWeights(pairs)`** — collapse exact `(input, label)` duplicates, return `{ pairs, weights }`. Verification: unit test with hand-constructed duplicate data asserting known counts; integration test training the same corpus with and without dedup and asserting val/test accuracy matches to within float tolerance (mirrors the parity check already done in ADR-0007's investigation, now as a permanent test rather than a throwaway one).
2. **`batchedTopKAccuracy(model, pairs, k)`** — encode the batch once via `model.model.encoder`, one call to `model.model.predictProbaFromVectors()`, rank per row. Replace every current per-example call site (`trainTop1`, `valTop1`, `valTop3`, `testTop1`, `testTop3`, and `collectCalibrationRows`'s inner loop). Verification: same accuracy-parity check as step 1, applied to accuracy numbers instead of training; timing logged and compared against the pre-change baseline.
3. **Re-measure and record** — run the optimized pipeline, record real train/eval timing and confirm accuracy is unchanged from the last-shipped numbers in `README.md`. This is the point where ADR-0007's ~16s→~3s estimate gets replaced with a real, shipped-code measurement.
4. **User-sentence IndexedDB store** — new store (or new key within the existing `astermind_models` DB) holding an array of `{ sentence, timestamp }`, capped at 200 with FIFO eviction. Verification: submit >200 sentences in a test, confirm the oldest are evicted and the count never exceeds the cap.
5. **Enter-to-teach handler** — extend `handleSuggestionNavigation` (or add a sibling handler) so `Enter` with no suggestion `selected` treats `input.value` as a candidate teaching sentence: validate ≥4 tokens, else show an inline hint and no-op. Verification: Enter with a highlighted suggestion still selects it (no regression to existing behavior); Enter with nothing highlighted and a valid sentence triggers the flow below; Enter with a too-short sentence shows the hint and does not train.
6. **Merge + weight + retrain** — generate pairs from the new sentence, merge into `rawTrainPairs` (never `valPairs`/`testPairs`), assign weight 3.0 to user-sourced pairs vs. 1.0 for static-corpus pairs (composing with step 1's dedup: final weight = `1.0 × static_count + 3.0 × user_count` per unique pair), retrain via the now-optimized path. Verification: a hand-constructed case where a user-taught pair's weight is verified to actually shift the trained model's prediction (same style as the `AutoComplete.test.ts` weighted-fit test from IMPL-0005 step 1).
7. **Gate + swap-or-keep** — evaluate the retrained model against the **untouched** static val/test splits; if it clears `MIN_VAL_TOP1_ACCURACY`/`MIN_VAL_TOP3_ACCURACY`, swap it in and overwrite the `MODEL_KEY` cache entry (model + updated user-pairs metadata); if not, keep the previous model live, still persist the sentence, warn. Verification: a deliberately-unhelpful submission (mirrors the audit's gate-break negative control, same "genuinely random, not accidentally structured" lesson learned there) confirmed to be rejected without disturbing the live model.
8. **UI feedback** — success message with session-taught counter; rejection message distinct from success; input clears only on success. Verification: manual pass in the live demo, plus an automated check that the counter increments correctly across multiple submissions.
9. **Hand-derived validation** — teach `"my favorite hobby is ___"` three times with three different endings (never in the static corpus); confirm the model's suggestions for that context afterward surface the taught words; confirm a fourth, once-taught new word does *not* yet appear (per `minLabelFreq`), and does appear once taught a second time.

## 7. Data / Migration

New IndexedDB store for user-submitted sentences (step 4) — additive, no migration of existing `word_predictor_v2` cache entries needed; the model cache and the sentence-history store are independent and can be cleared/rebuilt independently. Rollback: reverting `main.js` leaves any already-written sentence-history store inert and unread, same "old data just goes unused" pattern IMPL-0005 established for its own `MODEL_KEY` version bump.

## 8. Testing & Verification

- **Unit / spec:** `dedupWithWeights()` correctness on hand-constructed duplicate data; `batchedTopKAccuracy()` accuracy-parity against the per-example path; weighted-fit test proving a user-taught pair's 3.0x weight measurably shifts a small hand-constructed model's prediction.
- **Integration / E2E:** full pipeline re-measurement (step 3) against the actual shipped `main.js`, not a throwaway harness recreation — the audit's lesson (checked-off-by-inference items hide real bugs) applies here too.
- **Manual / demo:** `npm run dev:word-predictor`; teach several sentences live, confirm the counter and suggestions update, confirm a page reload preserves taught sentences and retrains/loads correctly.
- **Acceptance criteria:**
  - Speed: real measured numbers (not estimates) recorded in `README.md`, with the accuracy-parity proof alongside them so "faster" is never presented without "and still correct."
  - Active learning: the hobby-phrase hand-derived check (step 9) passes and is recorded the same way every prior hand-derived check in this demo has been.
  - Gate: the negative-control submission test (step 7) passes — a bad teaching example cannot degrade the live model.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| Real speed numbers land short of the ~5x estimate once measured against shipped code, not the investigation harness | Low | Low | Step 3 explicitly re-measures before anything else depends on the number; even a smaller-than-estimated win still helps active learning's responsiveness |
| Back-to-back Enter submissions trigger overlapping retrains against shared model state | Med | Med | Disable input during an in-flight retrain; queue at most one pending resubmission (ADR-0007 § Consequences) |
| A user teaches enough contradictory sentences that val/test accuracy oscillates near the gate threshold, causing visible flapping (sometimes cached, sometimes not) | Low | Low | Gate behavior is already deterministic given the same inputs; document as expected behavior, not a bug, if observed |
| Batched evaluation helper duplicates logic already in `ham-spam/main.js` instead of being shared | Certain (accepted) | Low | Explicitly accepted in ADR-0007 — demo-level code reaching into already-public API, not a new abstraction; revisit only if a third demo needs the same helper |

## 10. Open Questions

- [ ] Does the real, shipped-code speed measurement (step 3) land close to the ADR-0007 estimate (~16s → ~3s), or does actual overhead (DOM updates, status-text writes) change the picture meaningfully?
- [ ] Is a 200-sentence FIFO cap on user-submitted history the right number for a realistic demo session, or does it need tuning once someone actually uses the feature for a while?
- [ ] Does skipping recalibration on incremental active-learning retrains (ADR-0007 §2b) ever visibly degrade confidence-display quality after many submissions, or does the original calibration hold up fine? Worth a spot-check after a long teaching session, not just after one submission.

## 11. Done Checklist

- [ ] All steps complete and verified
- [ ] Tests green (`npm test`, including new dedup/batched-eval/active-learning coverage)
- [ ] Docs / ADR updated (`README.md` with real speed + active-learning numbers; ADR-0007 sign-off checklist updated)
- [ ] Deployed / merged to correct branch
- [ ] Sign-off

---

## See also

- [ADR-0007](../ADRs/ADR-0007-active-learning-and-training-speed.md) — the decision this plan executes, including the full audit detail.
- [IMPL-0004](./IMPL-0004-context-based-next-word-predictor.md) / [IMPL-0005](./IMPL-0005-active-typing-word-prediction.md) — both updated by this plan's audit; now accurately reflect verified-complete status.
- `examples/nolan-test/ham-spam/main.js` — source of the `batchedPredict()` pattern reused for `batchedTopKAccuracy()`.
