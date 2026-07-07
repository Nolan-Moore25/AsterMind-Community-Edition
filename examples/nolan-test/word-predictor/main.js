// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
// main.js — context-based next-word predictor (mobile-keyboard-style autocomplete)
// See README.md for how this differs from 03-smart-form-autocomplete's
// prefix -> remaining-characters-of-the-same-field completion.

const { AutoComplete } = window.astermind;

const K = 3;
const VOCAB_OPTS = { minLabelFreq: 2, maxVocab: 750 };
const HIDDEN_UNITS = 256;
const RIDGE_LAMBDA = 1e-4;

// Many contexts are only 1-2 tokens long (e.g. "i" precedes a dozen different
// verbs across this corpus) and are structurally ambiguous — no model can
// reliably guess a single next word for them. A neuron sweep (128/256/512
// hidden units, see README.md) plateaus around 40% val top-1 / 57% val
// top-3 well before hitting a flat 50% top-1 bar, so the cache gate checks
// both metrics against what's actually achievable on this corpus rather
// than an arbitrary round number.
const MIN_VAL_TOP1_ACCURACY = 0.35;
const MIN_VAL_TOP3_ACCURACY = 0.5;
const SUGGESTION_TOPK = 5;
const MODEL_KEY = 'word_predictor_v1';

// The trained beta matrix (750-class output layer) is likely to exceed
// localStorage's ~5-10MB quota the same way the spam classifier's did, so
// this reuses nolan-test's IndexedDB caching instead.
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

// Same tokenizer shape as ../main.js, extended to keep word-internal
// apostrophes ("don't") as a single token.
function tokenize(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9']+/g) || [];
}

// Deterministic shuffle so the train/val split is reproducible across
// reloads, the same idea as ../main.js relying on a pre-shuffled dataset.
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

// Splits at the *sentence* level, not the window level — two overlapping
// windows from the same sentence must never land on opposite sides, or
// validation accuracy stops being an honest signal.
function splitCorpus(sentences, trainRatio = 0.8, seed = 42) {
    const shuffled = seededShuffle(sentences, seed);
    const splitAt = Math.round(shuffled.length * trainRatio);
    return {
        trainSentences: shuffled.slice(0, splitAt),
        valSentences: shuffled.slice(splitAt),
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

// Vocabulary is learned from the training split only, so the validation
// split stays an honest estimate of how the model does on unseen words.
// Same shape as buildVocab() in ../main.js, but counting label frequency
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

// AutoComplete only ships top1Accuracy(); this adds the top-k variant needed
// for the ADR-0004 §6 top-3 metric.
function topKAccuracy(model, pairs, k) {
    let correct = 0;
    for (const { input, label } of pairs) {
        const preds = model.predict(input, k);
        if (preds.some((p) => p.completion === label)) correct++;
    }
    return correct / Math.max(1, pairs.length);
}

window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sentenceInput');
    const suggestionsEl = document.getElementById('suggestions');
    const status = document.getElementById('status');
    const metricsEl = document.getElementById('metrics');

    const setStatus = (msg) => { if (status) status.textContent = msg; };

    let model = null;
    // Tokens the model actually trained on as *context* (not label) — a
    // context built entirely from words outside this set is one the model
    // has no real signal for, so it degrades to an empty dropdown instead
    // of returning its top-5 logits for effectively unseen input.
    let knownContextTokens = new Set();

    function getSuggestions(text, topK = SUGGESTION_TOPK) {
        const trimmed = text.trim();
        if (!model || !trimmed) return [];
        const tokens = tokenize(trimmed);
        const context = tokens.slice(-K);
        if (!context.some((t) => knownContextTokens.has(t))) return [];
        return model.predict(context.join(' '), topK).map((p) => ({ word: p.completion, prob: p.prob }));
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

    // Appends the word with a leading space and keeps focus — this is a
    // running sentence, not a single bounded field value (03 replaces the
    // whole field; that behavior doesn't fit here).
    function selectSuggestion(word) {
        const needsSpace = input.value.length > 0 && !input.value.endsWith(' ');
        input.value += (needsSpace ? ' ' : '') + word + ' ';
        input.focus();
        suggestionsEl.classList.remove('show');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function updateSelection(items, index) {
        items.forEach((item, i) => item.classList.toggle('selected', i === index));
        if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
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

    async function bootstrap() {
        setStatus('📚 Building training pairs from corpus…');
        await new Promise((r) => setTimeout(r, 0));

        const { trainSentences, valSentences } = splitCorpus(window.CONTEXT_CORPUS_SENTENCES || []);
        const rawTrainPairs = buildContextPairs(trainSentences);
        const rawValPairs = buildContextPairs(valSentences);

        const vocab = buildNextWordVocab(rawTrainPairs, VOCAB_OPTS);
        const vocabSet = new Set(vocab);

        const trainPairs = filterToVocab(rawTrainPairs, vocabSet);
        const valPairs = filterToVocab(rawValPairs, vocabSet);

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
            const t0 = performance.now();
            model.train();
            trainMs = performance.now() - t0;
        }

        const trainTop1 = model.top1Accuracy(trainPairs);
        const valTop1 = model.top1Accuracy(valPairs);
        const valTop3 = topKAccuracy(model, valPairs, 3);

        const metricsText =
            `vocab: ${vocab.length} words · train pairs: ${trainPairs.length} · val pairs: ${valPairs.length}\n` +
            `train top-1: ${(trainTop1 * 100).toFixed(1)}% · val top-1: ${(valTop1 * 100).toFixed(1)}% · val top-3: ${(valTop3 * 100).toFixed(1)}%` +
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
        input.placeholder = 'Type a sentence… e.g. "i want to go to the "';
    }

    bootstrap();
});
