# AsterMind-ELM — Node Examples

Lightweight, end-to-end retrieval demos built on `@astermind/astermind-elm`. Each script is standalone, uses local assets, and logs what it’s doing (TF-IDF size, layer shapes, saved weights, metrics, etc.).

## Quick start

```bash
# from repo root
pnpm i        # or npm i / yarn
# run any example with ts-node + ESM
npx ts-node --esm examples/node-scripts/<script>.ts
```

**Data layout expected**

- `public/ag-news-classification-dataset/train.csv` (AG News)
- `public/go_textbook.md` (the book/corpus demos)
- Optional: `examples/node-scripts/elm_weights/` and `examples/node-scripts/embeddings/` will be created/cached automatically.

---

## Demo index

| Script | What it shows | Data | Outputs |
|---|---|---|---|
| `agnews-two-stage-retrieval.ts` | Distill **Sentence-BERT** into small **ELM student chains** (optionally use a **DeepELM teacher**) and evaluate **Recall@K / MRR** with **score-level ensembling** | AG News CSV | Metrics to CSV, console leaderboard |
| `book-index-elm-tfidf.ts` | Build a **hybrid book retriever**: Paragraph **ELM → Indexer ELMChain** (dense) **+ TF-IDF** blend | `go_textbook.md` | `embeddings.json`, console top-K |
| `tfidf-elm-dense-retrieval.ts` | **TF-IDF → ELM autoencoder** (X→X) for **compact dense retrieval** (cosine) | `go_textbook.md` | `elm_weights/*`, `embeddings.json`, console top-K |
| `deepelm-kelm-retrieval.ts` | Two-stage: **DeepELM on answers (Y→Y)** to shape target space, then **Kernel ELM** (regression) to map **queries→answer space**; retrieve with cosine | Tiny in-file Q/A set | Optional saved embeddings/KELM snapshot, console top-K & tiny-set metrics |

---

## 1) AG News — SBERT→ELM Students (with optional Deep Teacher)

**File:** `agnews-two-stage-retrieval.ts`

**What it does**
- Computes teacher embeddings with Sentence-BERT (`all-MiniLM-L6-v2`).
- (Optional) Trains **DeepELM** autoencoders on teacher space to make a smoother, low-D, cosine-friendly target (“deep” teacher).
- Trains **small ELM chains** from simple char encodings to approximate the teacher (deep supervision per layer).
- Ensembles by **averaging per-chain cosine scores** and reports **R@1, R@K, MRR**.

**Run**
```bash
npx ts-node --esm examples/node-scripts/agnews-two-stage-retrieval.ts \
  --sample=5000 --split=0.2 --topK=5 \
  --seq=512,256,128 --act=gelu --dropout=0.02 --ensemble=3 \
  --maxLen=200 --teacher=raw   # or --teacher=deep
```

**Outputs**
- Console baseline (SBERT) and student metrics.
- A timestamped CSV with configuration + metrics.

---

## 2) Book Index — Paragraph ELM + Indexer ELMChain + TF-IDF (Hybrid)

**File:** `book-index-elm-tfidf.ts`

**What it does**
- Splits `go_textbook.md` into sections by headings.
- Builds **TF-IDF** features (lexical grounding).
- Trains a **Paragraph ELM** (X→X) and a small **Indexer ELMChain** (X→X) for dense paragraph embeddings.
- **Hybrid score**: `total = α·cos(dense) + (1−α)·cos(tfidf)` and returns top-K.

**Run**
```bash
npx ts-node --esm examples/node-scripts/book-index-elm-tfidf.ts
# optional flags may exist depending on your local version:
#   --vocab=5000  --seq=256,128  --dropout=0.02  --maxLen=160  --alpha=0.7  --topK=5
```

**Outputs**
- `embeddings.json` (dense store with metadata).
- Console top-K for a sample query and basic stats.

**Good for**
- Fast, explainable retriever with both semantic and keyword signals.

---

## 3) TF-IDF → ELM (Autoencoder) → Dense Retrieval

**File:** `tfidf-elm-dense-retrieval.ts`

**What it does**
- Splits `go_textbook.md` by headings.
- Vectorizes sections with **TF-IDF** (cap vocab).
- Trains a **single ELM autoencoder** (X→X) and uses the **hidden layer** as the dense embedding.
- Does cosine retrieval; prints top-K.

**Run**
```bash
npx ts-node --esm examples/node-scripts/tfidf-elm-dense-retrieval.ts
# optional flags in some versions:
#   --vocab=5000  --hidden=128  --dropout=0.02
```

**Outputs**
- `elm_weights/elm_tfidf_autoencoder_*.json`
- `embeddings.json`
- Console top-K

**Good for**
- Minimal dependencies, very fast inference, solid baseline.

---

## 4) DeepELM (Answer Space) + Kernel ELM (Query→Embedding)

**File:** `deepelm-kelm-retrieval.ts`

**What it does**
- Uses a tiny in-file **Q/A set**.
- Trains **DeepELM** autoencoders on target texts (answers) to define the **answer embedding space**.
- Trains **Kernel ELM (KELM)** (regression) to map **queries** into that space.
- Retrieves nearest answers via cosine (with `EmbeddingStore`).

**Run**
```bash
npx ts-node --esm examples/node-scripts/deepelm-kelm-retrieval.ts \
  --topK=3 --m=256 --whiten=true --ridge=0.01 --gamma=auto --mode=nystrom \
  --saveEmb=targets.json --saveKELM=kelm.json
```

**Flags**
- `--topK` Top-K retrieval.
- `--m` Nyström landmarks (when `--mode=nystrom`).
- `--whiten` Whiten Nyström features.
- `--ridge` Ridge λ for KELM.
- `--gamma` RBF gamma (`auto` uses a median heuristic).
- `--mode` `nystrom` or `exact`.
- `--maxLen` Encoder max length.
- `--saveEmb`, `--saveKELM` to export artifacts.

**Outputs**
- Console top-K for a sample query, tiny-set **Recall@1** and **MRR**.
- Optional saved answer embeddings / KELM snapshot.

**Good for**
- Strong two-stage retrieval on small/medium labeled sets where “answer space” structure matters.

---

## Conventions & Tips

- **Caching:** Most demos cache model JSON under `examples/node-scripts/elm_weights/` to keep reruns fast.
- **Embeddings:** Saved in `examples/node-scripts/embeddings/` as JSON (vectors + metadata).
- **Cosine everywhere:** All dense vectors are L2-normalized; scores are cosine unless noted.
- **Performance knobs:**  
  - TF-IDF vocab (`--vocab`) and encoder `--maxLen` trade accuracy vs. speed.  
  - ELM widths/sequence (`--seq`) and `--dropout` set quality/latency.  
  - Hybrids expose `--alpha` to balance dense vs. lexical.  
- **Troubleshooting:** If imports/types fail, ensure `@astermind/astermind-elm` is built and that paths to `public/` files match your repo layout.

---

Happy hacking!

## LEGAL
- © 2026 AsterMind AI Co. – All Rights Reserved.
- Patent Pending US 63/897,713
