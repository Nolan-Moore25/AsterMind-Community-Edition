// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
// main.js — context-based next-word predictor, v2 (ADR-0005 / IMPL-0005):
// active-typing (mid-word) prediction, a larger log²-weighted corpus, and
// calibrated confidence scores. See README.md for how this differs from
// 03-smart-form-autocomplete's prefix -> remaining-characters-of-the-same-
// field completion, and from the v1 whole-word-only predictor (ADR-0004).

const { AutoComplete, Matrix } = window.astermind;

const K = 3;
const VOCAB_OPTS = { minLabelFreq: 2, maxVocab: 1500 };
const HIDDEN_UNITS = 256;
const RIDGE_LAMBDA = 1e-4;

// Many contexts are only 1-2 tokens long (e.g. "i" precedes a dozen different
// verbs across this corpus) and are structurally ambiguous — no model can
// reliably guess a single next word for them. The v2 corpus's vocab (317
// words, up from v1's 156) makes the classification task itself harder, so
// the gate is re-measured against the larger vocab rather than reused from
// v1 unchanged — see README.md "Results" for the measured numbers and margin.
const MIN_VAL_TOP1_ACCURACY = 0.30;
const MIN_VAL_TOP3_ACCURACY = 0.40;
const SUGGESTION_TOPK = 5;

// Sample weights are clamped so no context's influence goes to (near) zero
// or dominates by more than 3x a unit-weighted sample (ADR-0005 §5) — kept
// for contextWeights() below, which is measured but NOT applied by default;
// see the comment on contextWeights() for why.
const WEIGHT_FLOOR = 0.05;
const WEIGHT_CEIL = 3.0;

// Calibration is fit on ranks 1..CALIBRATION_MAX_RANK of each val/test pair's
// full ranked prediction list.
const CALIBRATION_MAX_RANK = 10;
const CALIBRATION_RIDGE = 1e-6;
const ECE_BUCKETS = 10;

// Cached payload shape changed (weighting metadata, calibration
// coefficients) — bump the key so a v1 cache entry is never loaded against
// v2 code (ADR-0005 §5), same versioning-on-shape-change precedent as
// ../ham-spam/main.js's `spam_ham_classifier_v5`.
const MODEL_KEY = 'word_predictor_v2';

// The trained beta matrix (up to a 1500-class output layer) is likely to
// exceed localStorage's ~5-10MB quota the same way the spam classifier's
// did, so this reuses the ham-spam sandbox's IndexedDB caching instead.
const DB_NAME = 'astermind_models';
const STORE = 'models';

function idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}
async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Same tokenizer shape as ../ham-spam/main.js, extended to keep word-internal
// apostrophes ("don't") as a single token.
function tokenize(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9']+/g) || [];
}

// Deterministic shuffle so the split is reproducible across reloads, the
// same idea as ../ham-spam/main.js relying on a pre-shuffled dataset.
function seededShuffle(arr, seed) {
    const out = arr.slice();
    let s = seed;
    for (let i = out.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// Three-way split (train/val/test) at the *sentence* level, not the window
// level — two overlapping windows from the same sentence must never land on
// opposite sides. Val fits the cache-gate + calibration regression; test is
// held out purely to validate the calibration layer, so that check isn't
// graded on the same data it was fit on (ADR-0005 §2c).
function splitCorpus(sentences, ratios = { train: 0.7, val: 0.15 }, seed = 42) {
    const shuffled = seededShuffle(sentences, seed);
    const trainEnd = Math.round(shuffled.length * ratios.train);
    const valEnd = trainEnd + Math.round(shuffled.length * ratios.val);
    return {
        trainSentences: shuffled.slice(0, trainEnd),
        valSentences: shuffled.slice(trainEnd, valEnd),
        testSentences: shuffled.slice(valEnd),
    };
}

// Sliding-window training-pair generator: (last-K-words context) -> (next word).
// Shorter-than-K contexts at the start of a sentence are kept as-is.
function buildContextPairs(sentences, k = K) {
    const pairs = [];
    for (const sentence of sentences) {
        const tokens = tokenize(sentence);
        for (let i = 1; i < tokens.length; i++) {
            const start = Math.max(0, i - k);
            pairs.push({ input: tokens.slice(start, i).join(' '), label: tokens[i] });
        }
    }
    return pairs;
}

// Vocabulary is learned from the training split only, so the validation and
// test splits stay an honest estimate of how the model does on unseen words.
// Same shape as buildVocab() in ../ham-spam/main.js, but counting label frequency
// across training pairs rather than per-document feature presence.
function buildNextWordVocab(trainPairs, { minLabelFreq, maxVocab }) {
    const freq = new Map();
    for (const { label } of trainPairs) {
        freq.set(label, (freq.get(label) || 0) + 1);
    }
    return [...freq.entries()]
        .filter(([, count]) => count >= minLabelFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxVocab)
        .map(([word]) => word);
}

// Pairs whose label falls outside the capped vocabulary are dropped, not
// remapped to an <unk> bucket — an untrained "unknown word" prediction is
// worse than no suggestion, which the UI already handles as an empty dropdown.
function filterToVocab(pairs, vocabSet) {
    return pairs.filter((p) => vocabSet.has(p.label));
}

// Per-pair sample weight = 1 / log2(contextFrequency + 2)^2, normalized so
// the least-repeated context's weight is 1.0 (ridge-neutral — an earlier,
// un-normalized version silently over-regularized every sample, since the
// ridge penalty λ‖β‖² doesn't shrink along with sample weights), then
// clamped to [WEIGHT_FLOOR, WEIGHT_CEIL] (ADR-0005 §2b).
//
// MEASURED, NOT APPLIED: a five-way sweep (unweighted vs. four weighting
// strengths, see README.md "Weighting: a negative result") found weighted
// training strictly *hurts* val accuracy on this corpus (best weighted
// config: 36.3% top-1 / 47.1% top-3, vs. 36.7% / 47.3% unweighted) — the
// short, structurally ambiguous contexts this was meant to help are exactly
// as common in val/test as in training, so training the model to try less
// hard on them doesn't improve matched-distribution accuracy. Kept here,
// tested, and documented as a validated negative result rather than deleted,
// per ADR-0005; `bootstrap()` below trains unweighted.
function contextWeights(trainPairs) {
    const freq = new Map();
    for (const { input } of trainPairs) freq.set(input, (freq.get(input) || 0) + 1);
    const raw = (f) => 1 / Math.pow(Math.log2(f + 2), 2);
    const minFreq = Math.min(...freq.values());
    const norm = raw(minFreq);
    return trainPairs.map(({ input }) => {
        const w = raw(freq.get(input)) / norm;
        return Math.min(WEIGHT_CEIL, Math.max(WEIGHT_FLOOR, w));
    });
}

// AutoComplete only ships top1Accuracy(); this adds the top-k variant needed
// for the ADR-0004 §6 / ADR-0005 top-3 metric.
function topKAccuracy(model, pairs, k) {
    let correct = 0;
    for (const { input, label } of pairs) {
        const preds = model.predict(input, k);
        if (preds.some((p) => p.completion === label)) correct++;
    }
    return correct / Math.max(1, pairs.length);
}

// Splits raw input text into a completed-word *context* (last up-to-K
// tokens) and an in-progress *prefix* (the word still being typed), based
// purely on whether the text ends in whitespace. When it does (or the input
// is empty), prefix is '' and this reproduces v1's whole-next-word behavior
// exactly (ADR-0005 §2a).
function splitInput(rawText, k = K) {
    const endsWithSpace = /\s$/.test(rawText);
    const tokens = tokenize(rawText);
    if (endsWithSpace || tokens.length === 0) {
        return { context: tokens.slice(-k), prefix: '' };
    }
    return { context: tokens.slice(0, -1).slice(-k), prefix: tokens[tokens.length - 1] };
}

// Collects (rank, rawScore, isCorrect) for the top CALIBRATION_MAX_RANK
// candidates of every pair's full ranked prediction — the training/eval set
// for the calibration regression (ADR-0005 §2c).
function collectCalibrationRows(pairs, model, vocabSize) {
    const rows = [];
    for (const { input, label } of pairs) {
        const ranked = model.predict(input, vocabSize);
        const n = Math.min(CALIBRATION_MAX_RANK, ranked.length);
        for (let i = 0; i < n; i++) {
            rows.push({ rank: i + 1, rawScore: ranked[i].prob, isCorrect: ranked[i].completion === label ? 1 : 0 });
        }
    }
    return rows;
}

// Closed-form least squares: calibratedProb = a*rank + b*rawScore + c,
// fit via normal equations using the already-exposed Matrix helpers (no new
// math dependency — same closed-form-regression idiom the rest of this repo
// already uses for the primary ELM prediction).
function fitCalibration(rows) {
    const X = rows.map((r) => [r.rank, r.rawScore, 1]);
    const Y = rows.map((r) => [r.isCorrect]);
    const Xt = Matrix.transpose(X);
    const XtX = Matrix.addRegularization(Matrix.multiply(Xt, X), CALIBRATION_RIDGE);
    const XtY = Matrix.multiply(Xt, Y);
    const beta = Matrix.solveCholesky(XtX, XtY, 1e-10);
    return { a: beta[0][0], b: beta[1][0], c: beta[2][0] };
}

function applyCalibration(coeffs, rank, rawScore) {
    const v = coeffs.a * rank + coeffs.b * rawScore + coeffs.c;
    return Math.min(1, Math.max(0, v));
}

// Expected Calibration Error: bucket predictions by confidence into deciles,
// weight each bucket's |predicted - empirical| gap by its share of the data.
function expectedCalibrationError(points, numBuckets = ECE_BUCKETS) {
    const buckets = Array.from({ length: numBuckets }, () => ({ sum: 0, correct: 0, count: 0 }));
    for (const { confidence, isCorrect } of points) {
        const idx = Math.min(numBuckets - 1, Math.max(0, Math.floor(confidence * numBuckets)));
        buckets[idx].sum += confidence;
        buckets[idx].correct += isCorrect;
        buckets[idx].count += 1;
    }
    let ece = 0;
    const total = points.length;
    for (const b of buckets) {
        if (b.count === 0) continue;
        ece += (b.count / total) * Math.abs(b.sum / b.count - b.correct / b.count);
    }
    return ece;
}

// Compares raw-score ECE against calibrated-score ECE on a held-out split
// the calibration regression was never fit on.
function evaluateCalibration(testPairs, model, vocabSize, coeffs) {
    const rows = collectCalibrationRows(testPairs, model, vocabSize);
    const raw = rows.map((r) => ({ confidence: r.rawScore, isCorrect: r.isCorrect }));
    const calibrated = rows.map((r) => ({ confidence: applyCalibration(coeffs, r.rank, r.rawScore), isCorrect: r.isCorrect }));
    return { rawECE: expectedCalibrationError(raw), calibratedECE: expectedCalibrationError(calibrated) };
}

window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sentenceInput');
    const suggestionsEl = document.getElementById('suggestions');
    const status = document.getElementById('status');
    const metricsEl = document.getElementById('metrics');

    const setStatus = (msg) => { if (status) status.textContent = msg; };

    let model = null;
    let vocabSize = 0;
    // Tokens the model actually trained on as *context* (not label) — a
    // context built entirely from words outside this set is one the model
    // has no real signal for, so it degrades to an empty dropdown instead
    // of returning its top-5 logits for effectively unseen input.
    let knownContextTokens = new Set();
    // { a, b, c } fit by fitCalibration(), or null if the calibration layer
    // didn't beat raw-score ECE on the test split — in that case getSuggestions
    // falls back to raw (uncalibrated) scores rather than shipping an
    // unvalidated artifact (ADR-0005 §5).
    let calibrationCoeffs = null;

    function calibrate(rank, rawScore) {
        return calibrationCoeffs ? applyCalibration(calibrationCoeffs, rank, rawScore) : rawScore;
    }

    // Active-typing prediction (ADR-0005 §2a): always pulls the model's
    // *full* ranked distribution (topK = vocabSize, not SUGGESTION_TOPK — the
    // slice down to a handful of suggestions happens after prefix filtering,
    // not before it) and, when the user is mid-word, filters to candidates
    // whose completion starts with the in-progress prefix before taking the
    // top few. Each candidate's rank is its position in the *full* ranked
    // list (preserved through the filter), matching how calibration was fit.
    function getSuggestions(rawText, topK = SUGGESTION_TOPK) {
        if (!model || !rawText.trim()) return [];
        const { context, prefix } = splitInput(rawText);
        if (!context.some((t) => knownContextTokens.has(t))) return [];

        const ranked = model.predict(context.join(' '), vocabSize).map((p, i) => ({ ...p, rank: i + 1 }));
        const filtered = prefix ? ranked.filter((p) => p.completion.startsWith(prefix)) : ranked;
        return filtered.slice(0, topK).map((p) => ({ word: p.completion, prob: calibrate(p.rank, p.prob) }));
    }

    function renderSuggestions(suggestions) {
        suggestionsEl.innerHTML = '';
        if (suggestions.length === 0) {
            suggestionsEl.classList.remove('show');
            return;
        }
        suggestionsEl.classList.add('show');
        suggestions.forEach((s, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.index = index;
            item.innerHTML = `
                <span class="suggestion-word">${s.word}</span>
                <span class="suggestion-prob">${Math.round(s.prob * 100)}%</span>
            `;
            item.addEventListener('click', () => selectSuggestion(s.word));
            suggestionsEl.appendChild(item);
        });
    }

    // Replaces the in-progress prefix when mid-word; appends a fresh word
    // (v1's exact behavior) when the input ends in whitespace — this is a
    // running sentence, not a single bounded field value (03 replaces the
    // whole field; that behavior doesn't fit here either way).
    function selectSuggestion(word) {
        const { prefix } = splitInput(input.value);
        if (prefix) {
            input.value = input.value.slice(0, -prefix.length) + word + ' ';
        } else {
            const needsSpace = input.value.length > 0 && !input.value.endsWith(' ');
            input.value += (needsSpace ? ' ' : '') + word + ' ';
        }
        input.focus();
        suggestionsEl.classList.remove('show');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function updateSelection(items, index) {
        items.forEach((item, i) => item.classList.toggle('selected', i === index));
        if (items[index]) items[index].scrollIntoView?.({ block: 'nearest' });
    }

    function handleSuggestionNavigation(event) {
        if (!suggestionsEl.classList.contains('show')) return;
        const items = suggestionsEl.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        const selected = suggestionsEl.querySelector('.suggestion-item.selected');
        let selectedIndex = selected ? parseInt(selected.dataset.index, 10) : -1;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items, selectedIndex);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
            updateSelection(items, selectedIndex);
        } else if (event.key === 'Enter' && selected) {
            event.preventDefault();
            selectSuggestion(selected.querySelector('.suggestion-word').textContent);
        } else if (event.key === 'Escape') {
            suggestionsEl.classList.remove('show');
        }
    }

    let suggestionTimeout = null;
    input.addEventListener('input', () => {
        if (suggestionTimeout) clearTimeout(suggestionTimeout);
        suggestionTimeout = setTimeout(() => {
            const t0 = performance.now();
            const suggestions = getSuggestions(input.value);
            const latency = performance.now() - t0;
            renderSuggestions(suggestions);
            if (suggestions.length > 0) console.log(`suggestion latency: ${latency.toFixed(2)}ms`);
        }, 100);
    });
    input.addEventListener('keydown', handleSuggestionNavigation);
    input.addEventListener('blur', () => {
        setTimeout(() => suggestionsEl.classList.remove('show'), 200);
    });
    input.addEventListener('focus', () => {
        if (input.value.trim()) renderSuggestions(getSuggestions(input.value));
    });

    // A degenerate corpus/vocab (e.g. every candidate word filtered out by
    // minLabelFreq) makes ELM.trainFromData throw synchronously inside this
    // async function — caught by bootstrap()'s wrapper below so the page
    // fails visibly (status text + console.error) instead of hanging with
    // an unhandled rejection and a permanently-disabled input. Found via
    // IMPL-0007's audit of IMPL-0004/0005's never-actually-run gate-break
    // negative control.
    async function bootstrapUnsafe() {
        setStatus('📚 Building training pairs from corpus…');
        await new Promise((r) => setTimeout(r, 0));

        const { trainSentences, valSentences, testSentences } = splitCorpus(window.CONTEXT_CORPUS_SENTENCES || []);
        const rawTrainPairs = buildContextPairs(trainSentences);
        const rawValPairs = buildContextPairs(valSentences);
        const rawTestPairs = buildContextPairs(testSentences);

        const vocab = buildNextWordVocab(rawTrainPairs, VOCAB_OPTS);
        const vocabSet = new Set(vocab);
        vocabSize = vocab.length;

        const trainPairs = filterToVocab(rawTrainPairs, vocabSet);
        const valPairs = filterToVocab(rawValPairs, vocabSet);
        const testPairs = filterToVocab(rawTestPairs, vocabSet);

        knownContextTokens = new Set(trainPairs.flatMap((p) => p.input.split(' ')));

        const droppedTrain = rawTrainPairs.length - trainPairs.length;
        const droppedPct = ((droppedTrain / Math.max(1, rawTrainPairs.length)) * 100).toFixed(1);
        console.log(
            `Vocab: ${vocab.length} words · dropped ${droppedTrain}/${rawTrainPairs.length} train pairs (${droppedPct}%) outside the cap`
        );

        const cached = await idbGet(MODEL_KEY);
        let trainMs = 0;

        if (cached && cached.vocabSize === vocab.length && cached.k === K) {
            setStatus('📦 Loading cached model…');
            await new Promise((r) => setTimeout(r, 0));
            model = new AutoComplete(trainPairs, {
                inputElement: input,
                outputElement: suggestionsEl,
                hiddenUnits: HIDDEN_UNITS,
                ridgeLambda: RIDGE_LAMBDA,
                activation: 'relu',
            });
            model.loadModelFromJSON(cached.modelJSON);
            calibrationCoeffs = cached.calibration || null;
        } else {
            setStatus(`🧠 Training on ${trainPairs.length} context→word pairs — one-time…`);
            await new Promise((r) => setTimeout(r, 0));

            model = new AutoComplete(trainPairs, {
                inputElement: input,
                outputElement: suggestionsEl,
                hiddenUnits: HIDDEN_UNITS,
                ridgeLambda: RIDGE_LAMBDA,
                activation: 'relu',
                metrics: { accuracy: MIN_VAL_TOP1_ACCURACY },
            });
            // Trains unweighted — see the contextWeights() comment above for
            // the measured, documented reason log²-frequency weighting isn't
            // applied here despite being implemented and tested.
            const t0 = performance.now();
            model.train();
            trainMs = performance.now() - t0;
        }

        const trainTop1 = model.top1Accuracy(trainPairs);
        const valTop1 = model.top1Accuracy(valPairs);
        const valTop3 = topKAccuracy(model, valPairs, 3);
        const testTop1 = model.top1Accuracy(testPairs);
        const testTop3 = topKAccuracy(model, testPairs, 3);

        let calibrationText = '(loaded from cache)';
        if (!cached) {
            setStatus('📐 Fitting confidence calibration…');
            await new Promise((r) => setTimeout(r, 0));
            const calibrationRows = collectCalibrationRows(valPairs, model, vocabSize);
            const fitted = fitCalibration(calibrationRows);
            const { rawECE, calibratedECE } = evaluateCalibration(testPairs, model, vocabSize, fitted);

            if (calibratedECE < rawECE) {
                calibrationCoeffs = fitted;
                calibrationText = `applied (test ECE ${rawECE.toFixed(4)} raw -> ${calibratedECE.toFixed(4)} calibrated)`;
                console.log(`💡 Calibration applied: raw ECE ${rawECE.toFixed(4)} -> calibrated ECE ${calibratedECE.toFixed(4)}`);
            } else {
                calibrationCoeffs = null;
                calibrationText = `not applied (test ECE ${rawECE.toFixed(4)} raw vs ${calibratedECE.toFixed(4)} calibrated — no improvement)`;
                console.warn(`❌ Calibration not applied: raw ECE ${rawECE.toFixed(4)} vs calibrated ECE ${calibratedECE.toFixed(4)} (no improvement).`);
            }
        }

        const metricsText =
            `vocab: ${vocab.length} words · train pairs: ${trainPairs.length} · val pairs: ${valPairs.length} · test pairs: ${testPairs.length}\n` +
            `train top-1: ${(trainTop1 * 100).toFixed(1)}% · val top-1: ${(valTop1 * 100).toFixed(1)}% · val top-3: ${(valTop3 * 100).toFixed(1)}%\n` +
            `test top-1: ${(testTop1 * 100).toFixed(1)}% · test top-3: ${(testTop3 * 100).toFixed(1)}%\n` +
            `calibration: ${calibrationText}` +
            (trainMs ? `\ntraining time: ${trainMs.toFixed(0)}ms` : '\n(loaded from cache — no training this run)');
        if (metricsEl) metricsEl.textContent = metricsText;
        console.log(metricsText);

        if (!cached) {
            const passed = valTop1 >= MIN_VAL_TOP1_ACCURACY && valTop3 >= MIN_VAL_TOP3_ACCURACY;
            if (passed) {
                await idbSet(MODEL_KEY, {
                    vocabSize: vocab.length,
                    k: K,
                    modelJSON: model.model.savedModelJSON,
                    calibration: calibrationCoeffs,
                });
                console.log('💾 Model cached to IndexedDB — future page loads skip training.');
            } else {
                console.warn(
                    `❌ Model not cached: val top-1 ${(valTop1 * 100).toFixed(1)}% / top-3 ${(valTop3 * 100).toFixed(1)}% ` +
                    `below the ${(MIN_VAL_TOP1_ACCURACY * 100).toFixed(0)}% / ${(MIN_VAL_TOP3_ACCURACY * 100).toFixed(0)}% gate.`
                );
            }
        }

        setStatus(`✅ Ready — val top-1 ${(valTop1 * 100).toFixed(1)}% · val top-3 ${(valTop3 * 100).toFixed(1)}% (n=${valPairs.length})`);
        input.disabled = false;
        input.placeholder = 'Type a sentence… e.g. "i want to go to the p"';
    }

    async function bootstrap() {
        try {
            await bootstrapUnsafe();
        } catch (e) {
            console.error('Bootstrap failed:', e);
            setStatus(`❌ Failed to load: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    bootstrap();
});
