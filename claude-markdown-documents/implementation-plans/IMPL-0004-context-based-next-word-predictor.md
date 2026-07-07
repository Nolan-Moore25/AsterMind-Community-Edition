# IMPL-0004 — Context-based next-word predictor

- **Linked ADR:** [ADR-0004](../ADRs/ADR-0004-context-based-next-word-predictor.md)
- **Status:** Proposed
- **Owner:** Nolan Moore
- **Estimated effort:** ~1–2 focused days (corpus curation is the part most likely to stretch this)

## Goals

1. Build a sliding-window training-pair generator: `(last-K-words context) → (next word)`, per [ADR-0004 §2](../ADRs/ADR-0004-context-based-next-word-predictor.md#2-decision).
2. Build a capped next-word vocabulary, fit on the training split only, mirroring `buildVocab()` in `examples/nolan-test/main.js:83-95`.
3. Train `AutoComplete` (classic `elm` engine) on those pairs, gated behind a validation-accuracy threshold before caching to IndexedDB — same shape as `nolan-test`'s `passed` gate (`main.js:313-321`).
4. Port the debounced suggestion-dropdown UI from `examples/practical-examples/03-smart-form-autocomplete/main.js:416-463`, adapted to append a word instead of replacing a field.
5. Ship the whole thing at `examples/nolan-test/word-predictor/` (new subfolder, sibling to the existing spam-classifier files).

## Non-goals

- `OnlineELM` personalization / per-user adaptation — parked as a documented follow-on ([ADR-0004 Option D](../ADRs/ADR-0004-context-based-next-word-predictor.md#3-options-considered)).
- An `<unk>` fallback bucket for out-of-vocabulary next words — dropped training pairs, not remapped, per the ADR's invariant.
- Multi-language support (corpus is English-only for v1).
- Promoting this into the curated `examples/practical-examples/` series — it stays in Nolan's `examples/nolan-test/` sandbox for now.

## Phases

Each phase leaves the demo in a working (if incomplete) state — no phase depends on unfinished work from a later phase.

---

### Phase 0 — Corpus curation (2–3 hours)

**Why first:** the training-pair and vocabulary code from Phase 1 is only as good as the corpus. A corpus without repeated context → multiple-plausible-next-word structure makes top-k accuracy trivially meaningless, so this has to be right before any pipeline code is worth trusting.

**Steps:**
1. Write `examples/nolan-test/word-predictor/context-corpus.js` exporting an array of ~200–400 everyday sentences, written so common contexts (`"i want to go to the"`, `"can you please"`, `"thank you for"`, `"see you"`) each recur with **several different, plausible next words** — not just one, or the model trivially memorizes a single completion per context.
2. Lowercase all text; tokenize on whitespace; strip punctuation except word-internal apostrophes (`"don't"` stays one token).
3. Split at the **sentence** level (not the token/window level) into train/val, roughly 80/20 — analogous to `splitDataset()` in `nolan-test` (`main.js:129-145`), but without class stratification (there's one text pool, not ham/spam). Splitting by sentence, not by window, is what keeps validation honest: two overlapping windows from the same sentence must never land on opposite sides of the split.

**Done when:**
- [ ] `context-corpus.js` exists with ≥200 sentences.
- [ ] Manual scan confirms ≥20 distinct contexts have ≥3 distinct next words somewhere in the corpus.
- [ ] Train/val split function exists and is verified by hand: split sizes sum to the total, and no single sentence's tokens appear in both splits.

---

### Phase 1 — Training-pair + vocabulary pipeline (3–4 hours)

**Why second:** this is the core new logic ADR-0004 calls out. Get it right and hand-verified before wiring any model training on top of it.

**Steps:**
1. Add `tokenize(text)` to `examples/nolan-test/word-predictor/main.js` (same regex-tokenizer shape as `nolan-test/main.js:77-79`, extended to allow apostrophes: `/[a-z0-9']+/g`).
2. Implement `buildContextPairs(sentences, K = 3)` — the sliding-window generator from [ADR-0004 §2](../ADRs/ADR-0004-context-based-next-word-predictor.md#2-decision): for each sentence, for each position, emit `{ input: last-K-tokens-joined, label: next-token }`, keeping shorter-than-K contexts at the start of a sentence as-is.
3. Implement `buildNextWordVocab(trainPairs, { minLabelFreq, maxVocab = 750 })` — counts `label` frequency across **training pairs only**, filters by `minLabelFreq`, sorts descending, slices to `maxVocab`. Same shape as `buildVocab()` in `nolan-test` (`main.js:83-95`), but counting label frequency rather than per-document feature presence.
4. Filter both train and val pairs to only those whose `label` is inside the capped vocabulary; **drop** (don't remap) the rest, per the ADR's no-`<unk>` invariant.
5. Hand-verify: run the pipeline on the exact example sentence from ADR-0004 §2 (`"i want to go to the store"`) and assert the emitted pairs match the ADR's worked example exactly.

**Done when:**
- [ ] `buildContextPairs` output matches the ADR-0004 §2 hand-worked example for the sample sentence.
- [ ] `buildNextWordVocab` is fit on the training split only — verified by confirming a word that only appears in validation sentences is absent from the vocabulary.
- [ ] Dropped-pair count (pairs whose label fell outside the capped vocab) is logged; if it's a large fraction of the total, that's a signal to revisit `maxVocab` or the corpus (loop back to Phase 0), not to silently proceed.

---

### Phase 2 — Model training + caching gate (3–4 hours)

**Why third:** with pairs and vocabulary in hand, wire the actual training, reusing `nolan-test`'s IndexedDB caching and accuracy-gate pattern verbatim where possible.

**Steps:**
1. Instantiate the model per [ADR-0004 §2](../ADRs/ADR-0004-context-based-next-word-predictor.md#2-decision):
   ```js
   new AutoComplete(trainPairs, {
     inputElement, outputElement,
     hiddenUnits: 128,
     activation: 'relu',
     metrics: { accuracy: 0.5 },
   });
   ```
2. Evaluate on `valPairs`: reuse `AutoComplete.top1Accuracy()` (`src/tasks/AutoComplete.ts:285-292`) as-is for top-1; add a small `topKAccuracy(pairs, k)` helper in `main.js` (the class doesn't ship a top-k variant) for the top-3 metric from ADR-0004 §6.
3. Port `idbOpen`/`idbGet`/`idbSet` from `nolan-test/main.js:50-75` unchanged, with `MODEL_KEY = 'word_predictor_v1'`.
4. Gate caching behind the validation threshold from ADR-0004 §6 — only call `idbSet(...)` if top-1/top-3 clears the bar; otherwise `console.warn` and leave the model uncached, same shape as `nolan-test/main.js:313-321`.
5. On page load, prefer a cached model (`loadModelFromJSON`) and skip training entirely if present — same `if (cached) {...} else {...}` branch nolan-test uses (`main.js:297-304`).

**Done when:**
- [ ] A fresh load (no cache) trains, evaluates, and reports train/val top-1 + top-3 accuracy to the console and a `#status` element.
- [ ] A passing run caches to IndexedDB; reloading the page skips training and loads instantly.
- [ ] Deliberately breaking the gate (e.g. shrinking the corpus or `maxVocab` until accuracy tanks) confirms the model is **not** cached and a warning is logged — proves the gate actually blocks a bad model, not just that it exists in code.

---

### Phase 3 — Suggestion UI (2–3 hours)

**Why fourth:** copy-adjacent from `03-smart-form-autocomplete`; do this last since it depends on a working, evaluated model.

**Steps:**
1. Build `examples/nolan-test/word-predictor/index.html` — single text input, suggestion-dropdown container, and a metrics/status readout — styled consistent with the existing `examples/nolan-test/index.html` (Arial, `#f3f3f3` background, monospace metrics block; `index.html:1-89`), so the new page reads as part of the same sandbox rather than importing 03's separate styling.
2. Port the debounced input handler (100ms) → `getSuggestions(input, topK)` → `renderSuggestions()` flow from `03/main.js:416-463`, pointing `getSuggestions` at the single shared word-predictor model instead of per-field models.
3. Change `selectSuggestion()` to append `" " + completion` to the current input value and keep focus, instead of replacing the whole field (03's behavior at `main.js:344-359`) — a running sentence isn't a single bounded field value.
4. Port keyboard navigation (arrow up/down, Enter, Escape) unchanged from `03/main.js:366-407` — behavior is identical, it's just operating over word suggestions instead of field completions.

**Done when:**
- [ ] Typing a known context (e.g. `"i want to go to the "`) shows a suggestion dropdown within one debounce cycle.
- [ ] Arrow keys / Enter / Escape behave identically to the `03` demo.
- [ ] Selecting a suggestion appends the word with a leading space and keeps the input focused for continued typing.
- [ ] An empty or unknown context shows an empty dropdown, not a thrown error (manual check: type gibberish, confirm no console errors).

---

### Phase 4 — Polish + validation pass (1–2 hours)

**Why last:** close the loop on every item in ADR-0004 §6 before calling this done.

**Steps:**
1. Run the hand-derived check from [ADR-0004 §6](../ADRs/ADR-0004-context-based-next-word-predictor.md#6-validation): pick a recurring context with ≥3 plausible next words, confirm the top-3 predictions surface them.
2. Record training time and per-keystroke suggestion latency (`performance.now()`, same instrumentation already used in `nolan-test` and `03`); confirm suggestion generation stays under the <5ms bar `03` documents (`main.js:84`).
3. Add a short `README.md` in `examples/nolan-test/word-predictor/` explaining the demo, the corpus, and — explicitly — how this differs from `03-smart-form-autocomplete` (context → next word, vs. prefix → remaining characters of the same field), so a reader doesn't conflate the two.

**Done when:**
- [ ] Hand-derived check passes and is recorded (context → expected top-3 → actual top-3).
- [ ] Latency and training-time numbers are recorded in `README.md`.
- [ ] `README.md` states the ADR-0004 distinction from `03` in its own words.

---

## Risks and how we mitigate them

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hand-written corpus doesn't have enough repeated-context/multiple-next-word structure | Med | High | Phase 0's "done when" explicitly checks for ≥20 such contexts before Phase 1 starts; if it fails, expand the corpus before writing any pipeline code |
| Capped vocabulary drops too many training pairs (rare next-words are common in casual English) | Med | Med | Phase 1 logs the dropped-pair count; if it's large, tune `maxVocab`/`minLabelFreq` or grow the corpus — same diagnostic loop as `nolan-test`'s neuron sweep |
| 750-category output layer is slower to train than expected for an in-browser demo | Low | Med | Phase 2's timing is recorded; if too slow, drop `hiddenUnits` or `maxVocab` — both are documented, isolated knobs, not structural changes |
| Model looks fine on validation accuracy but produces obviously bad suggestions in manual use | Low | Med | Phase 4's hand-derived check is a real qualitative gate, not just a number, before calling this done |

## Validation / how we'll know it worked

- Top-1 and top-3 next-word accuracy on the held-out validation split clears the threshold from ADR-0004 §6 before the model is ever cached.
- The hand-derived context check (a recurring phrase with several plausible completions) produces sensible top-3 suggestions.
- Suggestion generation stays under 5ms per keystroke; training time is recorded and reasonable for a one-time in-browser cost.
- A person unfamiliar with the demo can read `examples/nolan-test/word-predictor/README.md` and understand, without opening `main.js`, how this differs from the `03` field-autocomplete demo.

## See also

- [ADR-0004](../ADRs/ADR-0004-context-based-next-word-predictor.md) — the decision this plan executes.
- `examples/nolan-test/main.js` — vocabulary-capping, IndexedDB caching, and accuracy-gating patterns reused here.
- `examples/practical-examples/03-smart-form-autocomplete/main.js` — debounced suggestion-dropdown UI reused here.
- `src/tasks/AutoComplete.ts` — the underlying task class; no changes anticipated.
