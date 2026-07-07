# ADR-0004 — Context-based next-word predictor (mobile-keyboard-style autocomplete)

- **Status:** Proposed
- **Date:** 2026-07-06
- **Author:** Nolan Moore 
- **Branch:** TBD — new branch off `main` (e.g. `feature/word-predictor-demo`); no work has started yet.
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0003](./ADR-0003-summer-2026-curriculum-structure.md) (curriculum context — this demo is example/portfolio work, not a required capstone); [IMPL-0004](../implementation-plans/IMPL-0004-context-based-next-word-predictor.md) (execution plan).

---

## 1. Context

AsterMind's `AutoComplete` task class (`src/tasks/AutoComplete.ts`) currently has two example usages in the repo, and both do **character-level completion of a single field value**, not next-word prediction from context:

- `examples/practical-examples/03-smart-form-autocomplete/main.js:187-236` builds training pairs by slicing each example string (a name, an email, a job title) into `(prefix, remaining-characters)` pairs — e.g. `"Sarah Wil" → "liams"`. The model predicts *the rest of the current field value*, not the next word.
- `examples/nolan-test/main.js` is a bag-of-words ELM **classifier** (spam vs. ham) — categorical prediction over a fixed 2-class label set, built from `buildVocab()`/`vectorize()` helpers that turn text into a fixed-size 0/1 feature vector.

Neither example does what a phone keyboard does: given a **partial sentence** (`"i want to go to the "`), predict the most likely **next whole word** (`"store"`, `"gym"`, `"movies"`). That is a distinct task shape — the model needs to consume a variable-length *context* of previously-typed words and classify over a **vocabulary of candidate next words**, not over remaining characters of the word currently being typed.

- Background / current behavior: `AutoComplete` already supports arbitrary `{ input, label }` string pairs and internally tokenizes `input` on whitespace (`UniversalEncoder` in `'token'` mode, `src/tasks/AutoComplete.ts:114-120`), so it is already capable of consuming a multi-word context string — no library change is required, only a different training-pair construction.
- Constraint(s): the ELM output layer size scales with the number of distinct `label` values (`this.categories`, `src/tasks/AutoComplete.ts:111`). A next-word predictor's label set is a vocabulary, which is naturally much larger than 03's per-field label sets (03's largest is ~12 job titles) or nolan-test's 2 classes — this must be bounded deliberately or training/inference cost balloons.
- Trigger for this decision: intern portfolio/demo work (see [ADR-0003](./ADR-0003-summer-2026-curriculum-structure.md)) — a "simple prediction model" example that reads clearly as *next-word* autocomplete, built by combining the vocabulary-capping discipline from the spam classifier with the debounced suggestion UI from the smart-form-autocomplete demo.

## 2. Decision

> We will build a next-word predictor by training `AutoComplete` on `(last-K-words context) → (next word)` pairs drawn from a small bundled sentence corpus, capping the next-word vocabulary the same way `nolan-test` caps its bag-of-words vocabulary, and reusing the debounced suggestion-dropdown UI from `03-smart-form-autocomplete` so the demo reads like phone-keyboard autocomplete.

### Details

**Training-pair construction.** For each sentence in the corpus, lowercase and tokenize on whitespace, then slide a window of size `K` (default `K = 3`) across it:

```
tokens = ["i", "want", "to", "go", "to", "the", "store"]
pairs  = [
  { input: "i",                label: "want" },
  { input: "i want",           label: "to"   },
  { input: "i want to",        label: "go"   },
  { input: "want to go",       label: "to"   },
  { input: "to go to",         label: "the"  },
  { input: "go to the",        label: "store"},
]
```

`input` is capped to the last `K` tokens (shorter contexts at the start of a sentence are kept as-is, mirroring how `03`'s prefix loop starts at `i = 1`). This is the same "explode one example into many training pairs" move `03` uses (`main.js:194-206`), just windowed by *words* instead of sliced by *characters*.

**Vocabulary capping (borrowed from `nolan-test`).** The candidate label set is not "every distinct next-word in the corpus" — it is built the same way `buildVocab()` builds spam-classifier features (`examples/nolan-test/main.js:83-95`): document-frequency-filtered and capped to a `maxVocab` size (proposed default: 750), computed **only from the training split** to avoid leaking validation words into the label set. Training pairs whose `label` falls outside the capped vocabulary are dropped (not remapped to an `<unk>` bucket — an untrained "unknown word" prediction is worse than no suggestion, which the UI already handles as an empty dropdown).

**Model.** Classic `AutoComplete` with the default `'elm'` engine (no need for `KernelELM`/`OnlineELM` — see Options, row D). Proposed hyperparameters, following `03`'s "smaller model for faster inference" reasoning (`main.js:222`) but scaled up for the larger label set:

```js
new AutoComplete(trainingPairs, {
  inputElement, outputElement,
  hiddenUnits: 128,      // vs. 03's 64 — larger vocab needs more capacity
  activation: 'relu',
  metrics: { accuracy: 0.5 }, // top-1 accuracy over ~750 classes; see §6
});
```

**Corpus.** A small bundled JS/JSON file of everyday sentences (same shape as `examples/nolan-test/email-augment-data.js`) — common phrases and their natural continuations, curated by hand or lightly sourced, split train/val the same stratified way `splitDataset()` does (`examples/nolan-test/main.js:129-145`), just without the ham/spam stratification (there's one "class" of text here, not two).

**Caching.** Reuse the IndexedDB pattern from `nolan-test` (`idbOpen`/`idbGet`/`idbSet`, `main.js:50-75`) rather than `localStorage`, since a 750-class output layer's `beta` matrix is likely to exceed `localStorage`'s ~5–10MB quota the same way the spam classifier's did.

**UI.** Reuse `03`'s debounced-input → ranked-suggestion-dropdown → arrow-key-navigation → click-or-Enter-to-select flow (`main.js:416-463`) essentially as-is. The only behavioral change: a selected suggestion is appended to the input with a leading space (`input.value + " " + completion`) instead of replacing the whole field, since this is a running sentence, not a single bounded field value.

**Proposed location.** `examples/nolan-test/word-predictor/` (new subfolder, sibling to the existing spam-classifier files) — keeps this in Nolan's example sandbox rather than the curated `examples/practical-examples/` series (which is already numbered 01–05 and reads as vetted reference material, not portfolio work).

## 3. Options Considered

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. ELM classification over `(last-K-words) → (next word)`, capped vocab | Word-level n-gram context window, vocab capped like `nolan-test`'s bag-of-words features | Matches the "type a string, predict the next word" ask directly; reuses proven vocab-capping and UI code from both base examples; bounded, predictable training cost | Can never suggest a word outside the capped vocabulary; fixed `K` ignores longer-range context | ✅ chosen |
| B. Extend `03`'s char-completion pattern to whole-sentence labels | Keep `(partial, full-remaining-text)` pairs, just widen scope from field values to sentences | Zero new training-pair logic | Only ever reproduces memorized full continuations verbatim — can't compose a next word for a context it hasn't seen exactly before; doesn't generalize the way real autocomplete needs to | rejected |
| C. Plain frequency-table n-gram model (count-based, no ELM) | Classic Markov-chain next-word table | Simple, fast, no training step | Doesn't exercise AsterMind's ELM engine at all (defeats the point of an AsterMind demo); no notion of encoded similarity between near-identical contexts | rejected |
| D. `OnlineELM`, updating per keystroke for a personalized model | Adapts to the individual user's phrasing over time, like real phone keyboards do | Most realistic long-term behavior | Adds forgetting-factor tuning and persistence-of-partial-state complexity not needed for a "simple" first version; better as a documented follow-on once (A) is validated | rejected (parked as follow-on) |

Option A is the only one that actually satisfies "predict the next word from typed context" — B answers a different question (finish this specific value), C skips the library entirely, and D is the right eventual upgrade but not the right starting scope.

## 4. Consequences

- **Positive:** demonstrates a genuinely new `AutoComplete` usage pattern (word-context classification) instead of a third variation on character completion; both halves of the implementation (vocab capping, suggestion UI) are copy-adjacent from code already reviewed and working in this repo, so implementation risk is low.
- **Negative / cost:** the capped vocabulary means the model will never suggest proper nouns or rare words — it will visibly plateau on the "long tail" the same way the spam classifier's `maxVocab: 1500` does for rare tokens. A fixed `K`-word window also can't distinguish contexts that differ further back than `K` words (e.g. `"the bank of the river"` vs. `"the bank account"` beyond a 3-word window). Curating a corpus with enough repeated context → next-word structure to train on is real content work, not a code-only task.
- **Neutral / follow-on:** if `K` or `maxVocab` need tuning, a neuron/vocab sweep in the same style as `nolan-test`'s `NEURON_SWEEP` (`main.js:43, 199-249`) is the natural next diagnostic, not a new mechanism.
- **Risks & mitigations:** an output layer sized to `maxVocab` categories could make training slow if the corpus grows carelessly — mitigated by keeping `maxVocab` an explicit, documented knob (same guardrail nolan-test already established) and by validating training time in §6 before raising it.

## 5. Invariants / Guardrails

- The candidate vocabulary (label set) is built **only from the training split** — never from validation/test sentences — mirroring `buildVocab()`'s train-only fit in `nolan-test` (`main.js:81-82`). This is what makes held-out accuracy an honest signal.
- `maxVocab` stays an explicit, bounded constant (proposed 750) — no "just use every word seen" fallback, since that removes the guardrail that keeps training tractable in-browser.
- A trained model is only cached to IndexedDB if it clears a minimum validation accuracy gate (mirroring the `passed` check in `nolan-test`, `main.js:315-321`) — an untrained-quality model must not silently persist and mask a real regression on reload.

## 6. Validation

- **Hand-derived check:** for a corpus containing many instances of `"i want to go to the ___"` completed by `{store, park, movies, gym, ...}`, confirm the top-3 predictions for that exact context surface those words (not a syntactically-plausible but corpus-absent word).
- **Automated metric:** top-1 and top-3 next-word accuracy on a held-out validation split, computed the same way `nolan-test` computes precision/recall/F1 (`evaluate()`, `main.js:161-175`) — adapted to top-`k` label match instead of binary confusion counts.
- **Performance bar:** suggestion generation should stay under the <5ms-per-keystroke figure `03` documents (`main.js:84`); training time should be reported and reasonable for an in-browser one-time cost, following the same `performance.now()` instrumentation both base examples already use.
- **Manual UX pass:** type several common phrases into the live demo and confirm suggestions are sensible, keyboard navigation (arrow keys, Enter, Escape) works, and an empty/unknown context degrades to an empty dropdown rather than an error.

## 7. Sign-off Checklist

- [ ] ADR reviewed
- [x] IMPL plan written and linked
- [ ] Tests / guardrails in place
- [ ] Docs updated
- [ ] Branch correct for the work

---

## See also

- [ADR-0003](./ADR-0003-summer-2026-curriculum-structure.md) — curriculum/portfolio context this demo sits alongside.
- `examples/nolan-test/main.js` — vocabulary-capping, IndexedDB caching, and metrics-gating patterns reused here.
- `examples/practical-examples/03-smart-form-autocomplete/main.js` — debounced suggestion-dropdown UI reused here.
- `src/tasks/AutoComplete.ts` — the underlying task class; no changes to this file are anticipated.
