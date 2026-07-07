# Context-based next-word predictor

A phone-keyboard-style demo: type a partial sentence and get a ranked
dropdown of likely next words — including while you're still typing the
current word. Built per [ADR-0004](../../../claude-markdown-documents/ADRs/ADR-0004-context-based-next-word-predictor.md)/[IMPL-0004](../../../claude-markdown-documents/implementation-plans/IMPL-0004-context-based-next-word-predictor.md)
(v1: whole-next-word prediction) and [ADR-0005](../../../claude-markdown-documents/ADRs/ADR-0005-active-typing-word-prediction.md)/[IMPL-0005](../../../claude-markdown-documents/implementation-plans/IMPL-0005-active-typing-word-prediction.md)
(v2: active-typing prediction, a larger corpus, and calibrated confidence).

## How this differs from `03-smart-form-autocomplete`

`03` trains on `(prefix, remaining-characters-of-the-same-field)` pairs — e.g.
`"Sarah Wil" → "liams"`. It predicts the rest of the value currently being
typed, and a selected suggestion **replaces the whole field**.

This demo trains on `(last-3-words-of-context, next-whole-word)` pairs — e.g.
`"go to the" → "park"`. It predicts the next word in a running sentence.
Since v2, it does this in two modes depending on where the cursor is:

- **Trailing space** (`"go to the "`) — predicts the next *whole* word, same
  as v1. Selecting a suggestion **appends** it.
- **Mid-word** (`"go to the p"`) — predicts the next word *and* filters to
  completions starting with the in-progress prefix (`park`, `playground`,
  `party`, ...). Selecting a suggestion **replaces the prefix**, not the
  whole field.

Same `AutoComplete` task class, same debounced-dropdown UI pattern,
genuinely different training-pair shape and interaction model than `03`.

## Run it

```bash
npm run dev:word-predictor
```

## The corpus

`context-corpus.js` — **688 hand-written everyday sentences** (grown from
v1's 227 for IMPL-0005), grouped around ~60 recurring lead-in phrases
(`"go to the ___"`, `"can you please ___"`, `"i need a ___"`, `"let's meet at
the ___"`, ...), each completed several different, plausible ways. That
repetition is what makes top-k accuracy meaningful — a corpus where every
context has exactly one observed continuation would let the model trivially
memorize instead of actually ranking plausible alternatives.

**New in v2:** roughly 25 of those lead-in phrases were deliberately
extended so their completions cluster around shared first letters — e.g.
`"go to the ___"` now includes `park, playground, plaza, party, pool` (a
5-word `p`-cluster) and `movies, mall, mountains, market, museum` (a 5-word
`m`-cluster) — so the active-typing prefix filter has real width to narrow
in the live demo, not just a single plausible completion per prefix. 24
contexts in the corpus have ≥3 next-words sharing a first letter (ADR-0005
required ≥15).

Split **70/15/15 train/val/test** by **sentence** (482/103/103, seeded
shuffle) before any windowing happens, so two overlapping windows from the
same sentence never land on opposite sides of a split. v1 used a two-way
80/20 split; v2 adds a held-out test split specifically so the confidence
calibration regression (below) can be validated on data it was never fit on
— fitting and validating calibration on the same split would double-dip.

## Pipeline

- `tokenize()` — lowercase, `/[a-z0-9']+/g` (keeps `"don't"` as one token).
- `buildContextPairs(sentences, K=3)` — slides a window across each
  sentence's tokens, emitting `{ input: last-≤3-tokens, label: next-token }`.
  Verified against the ADR-0004 §2 worked example.
- `buildNextWordVocab(trainPairs, { minLabelFreq: 2, maxVocab: 1500 })` —
  counts label frequency **on the training split only**, filters rare (<2
  occurrences) words, caps at 1500 (raised from v1's 750 to match the larger
  corpus, mirroring `../main.js`'s established `maxVocab: 1500`). The cap
  isn't actually binding — the uncapped label set is 317 words, well under
  1500 — so `minLabelFreq` remains the real constraint, same as v1.
- Pairs whose label falls outside the capped vocab are **dropped**, not
  remapped to `<unk>`: 2687 raw training pairs → 320 dropped (**11.9%** — the
  *exact same rate as v1's 11.9%*, despite a 3x larger corpus) → 2367 usable
  training pairs. 430 test pairs and 444 val pairs after the same filter.

## Model + hyperparameters

```js
new AutoComplete(trainPairs, {
  inputElement, outputElement,
  hiddenUnits: 256,
  ridgeLambda: 1e-4,
  activation: 'relu',
});
model.train(); // unweighted — see "Weighting: a negative result" below
```

`hiddenUnits: 256` / `ridgeLambda: 1e-4` are unchanged from v1's neuron
sweep (see v1's table, preserved below) — re-sweeping wasn't repeated for v2
since the sweep's conclusion (256 is the point of diminishing returns) isn't
expected to change with a larger vocab in the same direction that would flip
the choice, and the priority this round was the three new capabilities, not
re-tuning an already-settled knob.

<details>
<summary>v1 neuron sweep (unchanged, kept for reference)</summary>

| hidden units | ridge λ | train top-1 | val top-1 | val top-3 | train time |
|---|---|---|---|---|---|
| 128 | 1e-2 (default) | 46.7% | 29.0% | 54.4% | 266ms |
| 128 | 1e-4 | 49.4% | 31.8% | 53.5% | 231ms |
| 256 | 1e-4 | 74.6% | 39.6% | 57.1% | 555ms |
| 512 | 1e-4 | 79.1% | 41.5% | 56.2% | 1225ms |

</details>

## Active-typing prediction (ADR-0005 §2a)

`getSuggestions()` splits the raw input into a completed-word *context* and
an in-progress *prefix* based on whether the text ends in whitespace, then
always requests the model's **full** ranked distribution (`predict(context,
vocabSize)`, not a truncated top-5) and filters to completions starting with
the prefix before taking the top few. No new model — this is a pure
inference/UI-layer change on top of the same classifier.

**Hand-derived check**, live output from the shipped model:

| Input | Suggestions (rank in full distribution) |
|---|---|
| `"i want to go to the "` (trailing space) | `the`, `park`, `beach`, `movies`, `mall` |
| `"i want to go to the p"` | `park` (rank 2), `playground` (rank 6), `party` (rank 7), `pool` (rank 9), `please` (rank 35) |
| `"i want to go to the pa"` | `park`, `party`, `part`, `pass`, `painted` |
| `"i want to go to the qzx"` (unmatched prefix) | *(empty dropdown, no error)* |

Selecting `park` while the input reads `"...the p"` produces `"...the park
"` — the prefix is **replaced**, not appended to. Verified end-to-end
(training, active-typing narrowing at each keystroke, mid-word selection,
and the unmatched-prefix empty-dropdown case) against the actual served
`index.html`/`main.js`/`context-corpus.js`, not just the underlying
pipeline functions in isolation.

**Latency:** mean 3.10ms, p50 3.06ms, p95 3.79ms, max 6.53ms per keystroke
over 200 calls (measured natively, not through the slower instrumented
harness used for functional verification). p50/p95 stay under the <5ms bar
`03` documents; the max occasionally exceeds it slightly — expected, since
each call now ranks the full ~317-word vocabulary instead of v1's
truncated top-5, and worth knowing rather than rounding away.

## Weighting: a negative result (ADR-0005 §2b)

ADR-0005 proposed weighting training pairs by
`1/log2(contextFrequency)^2` — normalized so the least-repeated context's
weight is 1.0, clamped to `[0.05, 3.0]` — on the theory that down-weighting
highly-repeated, structurally-ambiguous short contexts (like the bare
context `"i"`, which precedes a dozen different verbs) would stop them from
dominating the ridge-regression fit and free up capacity for less-ambiguous,
more-learnable contexts.

**Measured, it does the opposite.** A five-way sweep on the v2 corpus:

| Weighting | val top-1 | val top-3 |
|---|---|---|
| **unweighted (shipped)** | **36.7%** | **47.3%** |
| mild (`1/log2(f+2)^2`, floor 0.7 / ceil 1.5) | 36.3% | 47.1% |
| `1/log2(f+2)` (no square), floor 0.5 / ceil 2 | 36.0% | 46.4% |
| `1/log2(f+2)` (no square), floor 0.2 / ceil 3 | 35.6% | 45.9% |
| `1/sqrt(f)`, floor 0.3 / ceil 3 | 35.6% | 45.7% |
| `1/log2(f+2)^2` (original ADR-0005 proposal), floor 0.05 / ceil 3 | 33.6% | 42.3% |

Every weighting configuration underperforms unweighted training, and
accuracy degrades monotonically as the weighting gets more aggressive. The
theory had a real bug along the way too — an early, un-normalized version of
the formula gave *every* context a weight below 1.0 (even the rarest
context only reached 0.398), which silently over-regularizes the whole fit
since the ridge penalty `λ‖β‖²` doesn't shrink along with sample weights.
Normalizing so the rarest context sits at 1.0 fixed that specific bug, but
the corrected, properly-normalized version *still* loses to unweighted at
every strength tested.

**Why, in hindsight:** the short, ambiguous contexts this was meant to help
are exactly as common in the val/test splits as in training — they're drawn
from the same corpus. Training the model to try less hard on them doesn't
make it more accurate on them at evaluation time; it can only free up
capacity for other contexts, and empirically that trade isn't a net win on
this corpus. `contextWeights()` is kept in `main.js`, fully implemented and
covered by `AutoComplete.train()`'s test suite, and documented here as a
validated negative result — `bootstrap()` trains unweighted.

## Confidence calibration (ADR-0005 §2c)

v1's README flagged that `AutoComplete`'s ELM engine gives poorly-calibrated
confidence scores — a closed-form ridge regression against one-hot targets
optimizes squared error, not cross-entropy, so post-hoc softmax scores sit
near-uniform (~0.3% here, across 317 classes) regardless of whether the
prediction is actually correct.

**Fix:** a small secondary linear regression, `calibratedProb = a·rank +
b·rawScore + c`, fit by closed-form least squares (normal equations via the
already-exposed `Matrix.transpose`/`multiply`/`addRegularization`/
`solveCholesky` — no new math dependency) on `(rank, rawScore, isCorrect)`
triples collected from the top 10 candidates of every **validation**-split
prediction. `rank` turned out to carry essentially all the signal: raw score
is nearly flat regardless of correctness, but empirical accuracy drops
sharply by rank (rank 1: 36.7%, rank 2: 6.1%, rank 3: 4.5%, ... rank 10:
1.8%, measured on val) — exactly the top-1-vs-top-3 gap v1 already
documented, now made explicit per-rank.

**Validated on the held-out test split, not the val split it was fit on:**

| | raw scores | calibrated |
|---|---|---|
| Expected Calibration Error (test) | 0.0581 | **0.0289** |

Calibration roughly halves ECE and is applied (gated: `main.js` only keeps
the calibrated layer if it beats raw-score ECE on test; otherwise it falls
back to raw scores and logs a warning — same "don't ship an unvalidated
artifact" shape as the accuracy caching gate). The reliability table shows
calibrated confidence actually spreading across the 0–100% range instead of
collapsing to one bucket:

```
                     RAW                          CALIBRATED
confidence bucket    n     predicted  empirical    n     predicted  empirical
0–10%                4300  0.3%       6.2%         3481  3.4%       2.0%
10–20%                 —    —          —            615  13.4%     12.0%
20–30%                 —    —          —            127  24.0%     54.3%
30–40%                 —    —          —             43  34.4%     76.7%
40–50%                 —    —          —             16  45.7%     75.0%
```

Not perfectly calibrated at the high-confidence end (small bucket sizes
there make the empirical rate noisy), but a real, measured improvement over
raw scores collapsing entirely into one bucket. Displayed suggestion
percentages are still worth reading as approximate, not exact, confidence —
but they're no longer meaninglessly flat.

## Results

- **Corpus:** 688 sentences · 317-word vocab · 2367 train / 444 val / 430 test pairs
- **Train top-1:** 51.8% · **Val top-1:** 36.7% · **Val top-3:** 47.3% · **Test top-1:** 37.0% · **Test top-3:** 49.5%
- **Training time:** ~1.4s (one-time, in-browser; up from v1's 555ms — more
  data, ~2x the vocab)
- **Suggestion latency:** mean 3.1ms / p95 3.8ms per keystroke (see
  "Active-typing prediction" above)
- **Caching gate:** val top-1 ≥ 30% AND val top-3 ≥ 40% (re-measured for v2's
  larger, harder — more classes — vocab; comfortably cleared with ~6-7pp
  margin by the numbers above)

**Why v2's accuracy is lower than v1's (39.6%/57.1%), and why that's an
explained trade, not a silent regression:** the vocab nearly doubled (156 →
317 words) because the corpus grew 3x — more classes to distinguish among is
a strictly harder classification problem, independent of anything about
model quality. The dropped-pair rate staying essentially identical (11.9% in
both v1 and v2) confirms the corpus/vocab scaling behaved as intended; the
accuracy delta is the honest cost of a larger, more capable vocabulary, not
evidence of a bug.

**Hand-derived check** (ADR-0004 §6 / ADR-0005 §6): see "Active-typing
prediction" above — `"go to the p"` surfaces `park, playground, party, pool,
please`, all corpus-plausible, none syntactically-valid-but-absent.

## Unknown-context handling

`AutoComplete.predict()` always returns its top-K logits, even for a context
built entirely from words the model never trained on — there's no built-in
"I don't know" signal. `main.js` tracks the set of tokens that actually
appeared in training contexts (`knownContextTokens`) and short-circuits to
an empty suggestion list when none of the current context's tokens are in
that set. This now also covers the active-typing path: an unmatched prefix
(a known context, but no vocabulary word starts with what's been typed, e.g.
`"go to the qzx"`) degrades to an empty dropdown via the ordinary
prefix-filter-yields-nothing path, with no special-casing needed — verified
end-to-end against the live demo.

## Non-goals (see IMPL-0004 / IMPL-0005)

- `OnlineELM` personalization — parked as a documented follow-on.
- An `<unk>` fallback for out-of-vocabulary next words — dropped, not
  remapped.
- Fuzzy/typo-tolerant prefix matching — only exact `startsWith` prefix
  filtering is implemented; parked as a documented follow-on (ADR-0005 §3).
- Platt scaling / isotonic calibration — the closed-form linear regression
  cleared its own validation gate, so the more complex alternatives weren't
  needed (ADR-0005 §3).
- Promotion into `examples/practical-examples/` — stays in the `nolan-test`
  sandbox.
