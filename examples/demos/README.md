# AsterMind Demos

Single-feature, browser-based demos — each one shows **one** AsterMind capability in isolation, loaded straight from the built UMD bundle (`window.astermind`). No build step, no framework, no server round-trips.

> These are the "here's what one API does" showcases. If you want problem-oriented, copy-into-your-app recipes (search, moderation, recommendations, …) with heavier documentation, see [`../practical-examples/`](../practical-examples/) instead. For the intern curriculum, see [`../intern-program/lessons/`](../intern-program/lessons/).

## Demos

| Demo | What it shows | Run it | Files |
|------|---------------|--------|-------|
| [`ag-news-classifier/`](./ag-news-classifier/) | Four-way news-topic classification on the AG News dataset, trained off the main thread in a Web Worker | `npm run dev:news` | `index.html`, `agnews-demo.js`, `agnews-worker.js` |
| [`autocomplete-chain/`](./autocomplete-chain/) | `AutoComplete` wired into a text input, suggesting completions as you type | `npm run dev:autocomplete` | `index.html`, `main.js` |
| [`chain-with-save/`](./chain-with-save/) | Training an `ELMChain` in a worker, then **saving and reloading** the model as JSON so inference needs no retraining | `npm run dev:chain` | `index.html`, `main.js`, `worker.js`, `styles.css` |
| [`drum-pattern-generator/`](./drum-pattern-generator/) | Generating drum patterns on the main thread, loading the UMD bundle directly (see its own [`README.md`](./drum-pattern-generator/README.md)) | `npm run dev:music` | `index.html`, `app.js`, `README.md` |
| [`language-classifier/`](./language-classifier/) | Detecting the language of a short phrase from a small greetings corpus | `npm run dev:lang` | `index.html`, `main.ts` |

## How they load the library

Each demo pulls the compiled bundle via a `<script src="/astermind.umd.js">` tag. That file is served from the repo's [`public/`](../../public/) directory (vite's static root) and is refreshed from `dist/` on every `npm run build` by the `postbuild` step — so if a demo shows stale behavior, rebuild first. Data files (CSVs, saved model JSON) are likewise served from `public/` under absolute paths (e.g. `/language_greetings_1500.csv`).

## Running without the npm scripts

Every `npm run dev:*` script above is just `cross-env DEMO=demos/<name> vite` under the hood (see [`package.json`](../../package.json)). To serve a demo by hand, point any static server at its folder — but you'll need `astermind.umd.js` and any data files reachable at the paths above, which is exactly what the vite `publicDir` config provides for free.
