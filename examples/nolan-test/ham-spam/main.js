// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
// main.js — spam vs ham text classifier (bag-of-words + ELM)
// Dataset: AbdulHadi806/mail_spam_ham_dataset (HuggingFace), mirrored locally as
// /mail_spam_ham_dataset.json — 5613 labeled SMS/email messages (~86% ham / 14% spam).
// Only a 900-message stratified subset (600 ham / 300 spam, split evenly across
// train/val/test) is actually used — training time scales ~linearly with row
// count, and row count is the dominant cost, so this keeps training fast.


const { ELM, Matrix, Activations } = window.astermind;

const DATA_URL = '/mail_spam_ham_dataset.json';
const CATEGORIES = ['ham', 'spam'];
const MODEL_KEY = 'spam_ham_classifier_v5';
const VOCAB_OPTS = { minDocFreq: 3, maxVocab: 1500 };

// Keep the dataset small (training time scales ~linearly with row count, and
// it's the dominant cost) — 200 ham + 100 spam per split, three splits.
const SPLIT_SIZES = { ham: 200, spam: 100 };

// email-augment-data.js (loaded as a separate <script>) provides 30 ham + 30
// spam modern email examples — 10 of each per split.
const AUGMENT_SPLIT_SIZES = { ham: 10, spam: 10 };

// The 20 augmented rows per split are vastly outnumbered by the 300 SMS rows
// per split, and some words ("reply", "call") actually point the *opposite*
// direction in 2011-era SMS spam vs. modern email ham (legit "reply C to
// confirm" appointment texts vs. classic "Reply Y to claim" SMS spam). Without
// upweighting, the SMS majority drowns out the email examples and an obvious
// ham appointment reminder still gets flagged as spam. 8x (tuned empirically)
// is enough to flip that without hurting held-out SMS accuracy much.
const EMAIL_WEIGHT_MULTIPLIER = 8;

// Same ridge penalty used by the production model and the neuron sweep below,
// so the sweep is an honest "what if hidden units changes, all else equal" comparison.
const RIDGE_LAMBDA = 1;

// Hidden-layer sizes to compare after the main model is ready — illustrates
// the classic ELM bias/variance tradeoff: too few neurons underfits (train
// and val are both bad), too many overfits (train climbs toward 100% while
// val/test lag further and further behind).
const NEURON_SWEEP = [8, 16, 32, 64, 128, 256, 512, 1024];

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

// classifier.predictFromVector() re-transposes W and re-derives the
// activation function on *every single row* — fine for one live prediction,
// but evaluating hundreds of rows that way re-does that setup hundreds of
// times. Batching it (transpose W once, one matmul for the whole batch)
// measured ~9-11x faster — the difference between the neuron sweep below
// taking ~1.5s and ~15s.
function batchedPredict(clf, vectors) {
    const { W, b, beta } = clf.model;
    const H = Activations.apply(
        Matrix.multiply(vectors, Matrix.transpose(W)).map((row) => row.map((val, j) => val + b[j][0])),
        Activations.get(clf.activation)
    );
    return Matrix.multiply(H, beta).map((logits) =>
        Activations.softmax(logits)
            .map((p, i) => ({ label: clf.categories[i], prob: p }))
            .sort((a, b2) => b2.prob - a.prob)
    );
}

// The dataset JSON is already shuffled (fixed seed), so taking a prefix per
// class is equivalent to a random sample. Stratified 3-way train/val/test
// split — each split gets the same ham:spam ratio. Rows are tagged with
// `source` so training can upweight the hand-written email examples.
function splitDataset(all, { ham: hamPerSplit, spam: spamPerSplit }, source) {
    const byLabel = (label) => all.filter((r) => r.label === label).map((r) => ({ ...r, source }));
    const chunk3 = (rows, perSplit) => [
        rows.slice(0, perSplit),
        rows.slice(perSplit, perSplit * 2),
        rows.slice(perSplit * 2, perSplit * 3)
    ];

    const [hamTrain, hamVal, hamTest] = chunk3(byLabel('ham'), hamPerSplit);
    const [spamTrain, spamVal, spamTest] = chunk3(byLabel('spam'), spamPerSplit);

    return {
        trainRows: [...hamTrain, ...spamTrain],
        valRows: [...hamVal, ...spamVal],
        testRows: [...hamTest, ...spamTest]
    };
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
    // clf/vocabIdx default to the production model, but can be overridden to
    // evaluate one-off models (see runNeuronSweep) without disturbing it.
    function evaluate(rows, clf = classifier, vocabIdx = vocabIndex) {
        const predictions = batchedPredict(clf, rows.map((r) => vectorize(r.text, vocabIdx)));
        let tp = 0, fp = 0, fn = 0, tn = 0;
        rows.forEach(({ label }, i) => {
            const pred = predictions[i][0]?.label;
            if (pred === 'spam' && label === 'spam') tp++;
            else if (pred === 'spam' && label === 'ham') fp++;
            else if (pred === 'ham' && label === 'spam') fn++;
            else tn++;
        });
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

    function reportMetrics(splits, source) {
        console.log(`Model ready (${source}).`);
        const blocks = splits.map(([label, m]) => formatConfusion(label, m));
        blocks.forEach((b) => console.log(b));
        const confusionEl = document.getElementById('confusion');
        if (confusionEl) confusionEl.textContent = blocks.join('\n\n');

        const [, valMetrics] = splits.find(([label]) => label === 'val');
        setStatus(`✅ Model ready (${source}) — val accuracy ${(valMetrics.accuracy * 100).toFixed(1)}% · ` +
            `F1 ${(valMetrics.f1 * 100).toFixed(1)}% · recall ${(valMetrics.recall * 100).toFixed(1)}% · ` +
            `precision ${(valMetrics.precision * 100).toFixed(1)}% (n=${valMetrics.n})`);
    }

    function formatNeuronSweep(results) {
        const cell = (m) => `${(m.accuracy * 100).toFixed(1)}/${(m.f1 * 100).toFixed(1)}`.padStart(11);
        const header = `  hidden │ train acc/F1 │  val acc/F1 │ test acc/F1 │  time`;
        const rows = results.map(({ hiddenUnits, ms, train, val, test }) =>
            `  ${String(hiddenUnits).padStart(6)} │ ${cell(train)} │ ${cell(val)} │ ${cell(test)} │ ${String(ms).padStart(4)}ms`);
        return [header, ...rows].join('\n');
    }

    // Trains one fresh ELM per entry in NEURON_SWEEP (same vocab, weights, and
    // ridge penalty as the production model — only hiddenUnits varies) so the
    // train/val/test columns show the bias/variance tradeoff in isolation.
    function runNeuronSweep(trainRows, valRows, testRows) {
        const vocab = buildVocab(trainRows, VOCAB_OPTS);
        const vocabIdx = new Map(vocab.map((word, i) => [word, i]));

        const spamCount = trainRows.filter((r) => r.label === 'spam').length;
        const hamCount = trainRows.length - spamCount;
        const spamWeight = hamCount / Math.max(1, spamCount);
        const weights = trainRows.map((r) => {
            const classWeight = r.label === 'spam' ? spamWeight : 1;
            const sourceWeight = r.source === 'email' ? EMAIL_WEIGHT_MULTIPLIER : 1;
            return classWeight * sourceWeight;
        });

        return NEURON_SWEEP.map((hiddenUnits) => {
            const sweepClassifier = new ELM({
                categories: CATEGORIES,
                inputSize: vocab.length,
                useTokenizer: false,
                hiddenUnits,
                activation: 'relu',
                ridgeLambda: RIDGE_LAMBDA,
                log: { verbose: false, modelName: `NeuronSweep(${hiddenUnits})` }
            });

            const X = trainRows.map((r) => vectorize(r.text, vocabIdx));
            const Y = trainRows.map((r) => sweepClassifier.oneHot(CATEGORIES.length, CATEGORIES.indexOf(r.label)));

            const t0 = performance.now();
            sweepClassifier.trainFromData(X, Y, { weights });
            const ms = Math.round(performance.now() - t0);

            return {
                hiddenUnits,
                ms,
                train: evaluate(trainRows, sweepClassifier, vocabIdx),
                val: evaluate(valRows, sweepClassifier, vocabIdx),
                test: evaluate(testRows, sweepClassifier, vocabIdx)
            };
        });
    }

    async function train(trainRows) {
        setStatus(`🧠 Training on ${trainRows.length} messages — one-time…`);
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
            ridgeLambda: RIDGE_LAMBDA,
            log: { verbose: true, modelName: 'SpamHamClassifier' }
        });

        const X = trainRows.map((r) => vectorize(r.text, vocabIndex));
        const Y = trainRows.map((r) => classifier.oneHot(CATEGORIES.length, CATEGORIES.indexOf(r.label)));

        // upweight the hand-written email rows so they aren't drowned out by
        // the much larger SMS portion (see EMAIL_WEIGHT_MULTIPLIER above).
        const spamCount = trainRows.filter((r) => r.label === 'spam').length;
        const hamCount = trainRows.length - spamCount;
        const spamWeight = hamCount / Math.max(1, spamCount);
        const weights = trainRows.map((r) => {
            const classWeight = r.label === 'spam' ? spamWeight : 1;
            const sourceWeight = r.source === 'email' ? EMAIL_WEIGHT_MULTIPLIER : 1;
            return classWeight * sourceWeight;
        });

        classifier.trainFromData(X, Y, { weights });
        return vocab;
    }

    async function bootstrap() {
        setStatus('📥 Loading dataset…');
        const all = await fetch(DATA_URL).then((r) => r.json());
        const sms = splitDataset(all, SPLIT_SIZES, 'sms');
        const email = splitDataset(window.EMAIL_AUGMENT_EXAMPLES || [], AUGMENT_SPLIT_SIZES, 'email');

        const trainRows = [...sms.trainRows, ...email.trainRows];
        const valRows = [...sms.valRows, ...email.valRows];
        const testRows = [...sms.testRows, ...email.testRows];

        const cached = await idbGet(MODEL_KEY);
        if (cached) {
            vocabIndex = new Map(cached.vocab.map((word, i) => [word, i]));
            classifier = new ELM({ categories: CATEGORIES, inputSize: cached.vocab.length, useTokenizer: false, hiddenUnits: 256 });
            classifier.loadModelFromJSON(cached.modelJSON);
        } else {
            await train(trainRows);
        }

        const splits = [
            ['train', evaluate(trainRows)],
            ['val', evaluate(valRows)],
            ['test', evaluate(testRows)]
        ];
        reportMetrics(splits, cached ? 'cached' : 'freshly trained');

        if (!cached) {
            const [, valMetrics] = splits.find(([label]) => label === 'val');
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

        // Let the "ready" status paint before the (also blocking) sweep runs.
        await new Promise((r) => setTimeout(r, 0));
        const sweepEl = document.getElementById('neuronSweep');
        if (sweepEl) sweepEl.textContent = '🧠 Running neuron-count sweep…';
        const sweepResults = runNeuronSweep(trainRows, valRows, testRows);
        console.log('Neuron sweep (hiddenUnits vs. train/val/test):');
        console.log(formatNeuronSweep(sweepResults));
        if (sweepEl) sweepEl.textContent = formatNeuronSweep(sweepResults);
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
