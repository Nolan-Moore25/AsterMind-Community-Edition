// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
// main.js — spam vs ham text classifier (bag-of-words + ELM)
// Dataset: AbdulHadi806/mail_spam_ham_dataset (HuggingFace), mirrored locally as
// /mail_spam_ham_dataset.json — 5613 labeled SMS/email messages (~86% ham / 14% spam).
//
// Note on the feature representation: AsterMind's built-in text encoder
// (useTokenizer:true) one-hots characters by *position*, which makes it very
// sensitive to where a word lands in the message — "free" at character 5 and
// "free" at character 50 produce unrelated feature patterns. That measured
// ~61% validation accuracy here. A plain bag-of-words vector (does this
// message contain word X, yes/no) is position-invariant and measured ~95%,
// so that's what this demo trains on, via ELM's numeric/vector mode.

const { ELM } = window.astermind;

const DATA_URL = '/mail_spam_ham_dataset.json';
const CATEGORIES = ['ham', 'spam'];
const MODEL_KEY = 'spam_ham_classifier_v2';
const VOCAB_OPTS = { minDocFreq: 3, maxVocab: 1500 };

// The trained weight matrix runs several MB — too big for localStorage's ~5-10MB
// quota, so it's cached in IndexedDB instead (same approach as the ag-news demo).
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

function tokenize(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

// Vocabulary is learned from the training split only, so the validation
// split stays an honest estimate of how the model does on unseen words.
function buildVocab(rows, { minDocFreq, maxVocab }) {
    const docFreq = new Map();
    for (const { text } of rows) {
        for (const tok of new Set(tokenize(text))) {
            docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
        }
    }
    return [...docFreq.entries()]
        .filter(([, count]) => count >= minDocFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxVocab)
        .map(([word]) => word);
}

function vectorize(text, vocabIndex) {
    const vec = new Array(vocabIndex.size).fill(0);
    for (const tok of tokenize(text)) {
        const idx = vocabIndex.get(tok);
        if (idx != null) vec[idx] = 1;
    }
    return vec;
}

window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('userInput');
    const output = document.getElementById('autoOutput');
    const fill = document.getElementById('langFill');
    const status = document.getElementById('status');

    const setStatus = (msg) => { if (status) status.textContent = msg; };

    let classifier = null;
    let vocabIndex = null;

    // Confusion matrix is for the "spam" class: tp/fp/fn/tn against "ham".
    function evaluate(rows) {
        let tp = 0, fp = 0, fn = 0, tn = 0;
        for (const { text, label } of rows) {
            const [top] = classifier.predictFromVector([vectorize(text, vocabIndex)], 1)[0];
            const pred = top?.label;
            if (pred === 'spam' && label === 'spam') tp++;
            else if (pred === 'spam' && label === 'ham') fp++;
            else if (pred === 'ham' && label === 'spam') fn++;
            else tn++;
        }
        const precision = tp / Math.max(1, tp + fp);
        const recall = tp / Math.max(1, tp + fn);
        const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        return { n: rows.length, tp, fp, fn, tn, accuracy: (tp + tn) / rows.length, precision, recall, f1 };
    }

    function formatConfusion(label, m) {
        const pad = (v) => String(v).padStart(5);
        return `${label} (n=${m.n}) — accuracy ${(m.accuracy * 100).toFixed(1)}% · F1 ${(m.f1 * 100).toFixed(1)}% · ` +
            `precision ${(m.precision * 100).toFixed(1)}% · recall ${(m.recall * 100).toFixed(1)}%\n` +
            `              pred ham  pred spam\n` +
            `  actual ham  ${pad(m.tn)}     ${pad(m.fp)}\n` +
            `  actual spam ${pad(m.fn)}     ${pad(m.tp)}`;
    }

    function reportMetrics(trainMetrics, valMetrics, source) {
        console.log(`Model ready (${source}).`);
        console.log(formatConfusion('train', trainMetrics));
        console.log(formatConfusion('val', valMetrics));
        const confusionEl = document.getElementById('confusion');
        if (confusionEl) {
            confusionEl.textContent = `${formatConfusion('train', trainMetrics)}\n\n${formatConfusion('val', valMetrics)}`;
        }
        setStatus(`✅ Model ready (${source}) — val accuracy ${(valMetrics.accuracy * 100).toFixed(1)}% · ` +
            `F1 ${(valMetrics.f1 * 100).toFixed(1)}% · recall ${(valMetrics.recall * 100).toFixed(1)}% · ` +
            `precision ${(valMetrics.precision * 100).toFixed(1)}% (n=${valMetrics.n})`);
    }

    async function train(trainRows) {
        setStatus(`🧠 Training on ${trainRows.length} messages — one-time, ~5s…`);
        // Yield a tick so the status text paints before the blocking training call.
        await new Promise((r) => setTimeout(r, 0));

        const vocab = buildVocab(trainRows, VOCAB_OPTS);
        vocabIndex = new Map(vocab.map((word, i) => [word, i]));

        classifier = new ELM({
            categories: CATEGORIES,
            inputSize: vocab.length,
            useTokenizer: false,
            hiddenUnits: 256,
            activation: 'relu',
            log: { verbose: true, modelName: 'SpamHamClassifier' }
        });

        const X = trainRows.map((r) => vectorize(r.text, vocabIndex));
        const Y = trainRows.map((r) => classifier.oneHot(CATEGORIES.length, CATEGORIES.indexOf(r.label)));

        // ~14% of messages are spam — upweight them so the regression doesn't
        // just learn to always predict "ham" and call it a day.
        const spamCount = trainRows.filter((r) => r.label === 'spam').length;
        const hamCount = trainRows.length - spamCount;
        const spamWeight = hamCount / Math.max(1, spamCount);
        const weights = trainRows.map((r) => (r.label === 'spam' ? spamWeight : 1));

        classifier.trainFromData(X, Y, { weights });
        return vocab;
    }

    async function bootstrap() {
        setStatus('📥 Loading dataset…');
        const all = await fetch(DATA_URL).then((r) => r.json());
        const splitIdx = Math.floor(all.length * 0.9);
        const trainRows = all.slice(0, splitIdx);
        const valRows = all.slice(splitIdx);

        const cached = await idbGet(MODEL_KEY);
        if (cached) {
            vocabIndex = new Map(cached.vocab.map((word, i) => [word, i]));
            classifier = new ELM({ categories: CATEGORIES, inputSize: cached.vocab.length, useTokenizer: false, hiddenUnits: 256 });
            classifier.loadModelFromJSON(cached.modelJSON);
        } else {
            await train(trainRows);
        }

        const trainMetrics = evaluate(trainRows);
        const valMetrics = evaluate(valRows);
        reportMetrics(trainMetrics, valMetrics, cached ? 'cached' : 'freshly trained');

        if (!cached) {
            const passed = valMetrics.accuracy >= 0.9 && valMetrics.recall >= 0.6;
            if (passed) {
                await idbSet(MODEL_KEY, { vocab: [...vocabIndex.keys()], modelJSON: classifier.savedModelJSON });
                console.log('💾 Model cached to IndexedDB — future page loads skip training.');
            } else {
                console.warn('❌ Model not cached: validation thresholds not met.');
            }
        }

        input.disabled = false;
        input.placeholder = 'Type an email or text message…';
    }

    bootstrap();

    input.addEventListener('input', () => {
        const val = input.value.trim();
        if (!val || !classifier) {
            output.textContent = '';
            fill.style.width = '0%';
            fill.textContent = '';
            fill.style.background = '#ccc';
            return;
        }

        const [top] = classifier.predictFromVector([vectorize(val, vocabIndex)], 1)[0];
        if (!top) return;

        const pct = Math.round(top.prob * 100);
        const isSpam = top.label === 'spam';
        output.textContent = isSpam ? `🚫 SPAM (${pct}%)` : `✅ HAM (${pct}%)`;

        fill.style.width = `${pct}%`;
        fill.textContent = `${top.label.toUpperCase()} ${pct}%`;
        fill.style.background = isSpam
            ? 'linear-gradient(to right, #b91c1c, #f87171)'
            : 'linear-gradient(to right, #15803d, #4ade80)';
    });
});
