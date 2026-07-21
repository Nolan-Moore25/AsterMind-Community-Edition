# ADR-0009 — Consolidate repo navigation: group intern work, group demos, fix misleading names

- **Status:** Proposed
- **Date:** 2026-07-21
- **Author:** Nolan Moore (with planning support from Claude)
- **Branch:** `repo-navigation-consolidation` (new branch — this touches `package.json`, both `tsconfig*.json`, `rollup.config.cjs`, and dozens of paths; it should land as one reviewable diff, not mixed into unrelated work)
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0001](./ADR-0001-consolidate-repo-and-prepare-for-interns.md) / [IMPL-0001](../implementation-plans/IMPL-0001-consolidate-repo-and-prepare-for-interns.md) (the prior repo-consolidation pass — deleted the 21 scaffolding variants, added the top-level docs; this ADR is the same instinct applied to `examples/`, `tests/`, and folder naming instead of `src/`); [IMPL-0009](../implementation-plans/IMPL-0009-consolidate-repo-navigation-and-naming.md) (this decision's execution plan); [NB-001](../research-notebooks/NB-001-initial-codebase-audit.md) (left an open question this ADR closes — see §1)

---

## 1. Context

A fresh read of the repo — done specifically to answer "could a new employee evaluate this codebase and get oriented quickly?" — surfaced a consistent pattern: individually reasonable decisions, made at different times for different reasons, have left `examples/` and its neighbors without a single organizing principle. None of this is broken (the build passes, `npm test` is green, every `npm run dev:*` script works); it's a navigation and naming problem, which is exactly the kind of debt that's invisible to the people who already know where things are and a real tax on everyone else.

### 1.1 Intern-related work is split across four unconnected top-level locations

- `examples/lessons/` — the L00–L06 curriculum (ADR-0002/ADR-0003), used by all three interns.
- `examples/capstones/` — the three capstone lanes (ADR-0003), each a `STARTER.md` plus whatever the intern ships.
- `examples/nolan-test/` — Nolan's **personal, ungraded** sandbox (`ham-spam/`, `word-predictor/`; ADR-0004/ADR-0005). Per its own governing ADRs and the cohort plan, this is explicitly *not* a capstone deliverable — but nothing in the name or location signals that distinction to a reader. "nolan-test" reads like a scratch/debug folder, not "one intern's pre-capstone practice work," and it does not generalize: if a future cohort's second intern wants the same kind of ungraded practice space, there's no established pattern to extend.
- `tests/capstones/<lane>/` — the vitest suites for capstone code, e.g. `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` — split away from the `examples/capstones/<lane>/` docs/code it tests, into a completely separate top-level tree.

A reader has to already know the cohort's history to understand why `examples/lessons/`, `examples/capstones/`, and `examples/nolan-test/` are three unrelated-looking siblings rather than one program's three faces, or why capstone tests live in a different top-level directory than capstone docs.

### 1.2 "Working examples" are split across three different shapes with no shared parent

`examples/` currently mixes three different organizing patterns at the same directory depth:

- **Five loose, single-purpose demos directly under `examples/`:** `ag-news-demo/`, `autocomplete-chain/`, `chain-with-save/`, `elm-drum-demo-mainthread/`, `language-awareness-demo/`. None of these five has a shared index or README — unlike every other grouping in `examples/`, they have zero collective documentation. A reader finds them only by listing the directory.
- **One themed, numbered group:** `practical-examples/01-smart-search-filtering` … `05-personalized-recommendations`, with its own README, a shared "Common Patterns" section, and a consistent per-demo structure.
- **A whole separate top-level directory, not even nested under `examples/`:** `node_examples/` — four Node/ts-node retrieval scripts plus an `experiments/` subfolder, with its own `package.json`, `package-lock.json`, and `tsconfig.json`.

`CONTRIBUTING.md:63-64` already tries to answer "where does new example code go?" with a two-row table (`examples/lessons/` for teaching artifacts, `examples/practical-examples/` for application demos) — but that table doesn't mention the five loose demos, `examples/capstones/`, `examples/nolan-test/`, or `node_examples/` at all. The table is not wrong, it's just answering a question the repo has already outgrown: there are at least four more "where does this go" categories in active use that the project's own contributor-facing decision table doesn't cover.

### 1.3 Folder names that actively mislead

- `examples/nolan-test/` — "test" suggests test code (unit/integration tests) or a throwaway scratch directory, not "an intern's ungraded personal exploration." Every actual test in this repo lives under `tests/`, so the name collides with an established, different meaning.
- `examples/elm-drum-demo-mainthread/` — the `-mainthread` suffix names an implementation detail (which JS execution context the demo runs in), not the demo's content. `git log`/`find` show no `elm-drum-demo-worker` or equivalent ever existed in this repo, so the suffix implies a variant that isn't there and doesn't help anyone decide whether to open this folder.
- `examples/ag-news-demo/` / `examples/language-awareness-demo/` — the generic `-demo` suffix on both is redundant once (per §2 below) they live under a directory that is itself named `demos/`; kept as-is, every entry in that directory would read `demos/*-demo/`.
- `node_examples/` (top level) vs. `examples/` (top level) — two sibling directories whose names differ only by a `node_` prefix invite the false inference that they're parallel/equivalent, when one is a browser-demo tree resolved by `vite.config.ts`'s `DEMO` env var and the other is a standalone ts-node sub-package with its own `package.json`. The underscore also breaks from the kebab-case convention used everywhere else in the repo (`ag-news-demo`, `chain-with-save`, `practical-examples`, etc.).
- `docs/COMPARISON_CHART.md` and `docs/REAL_WORLD_EXAMPLES.md` are `SCREAMING_SNAKE_CASE` in a `docs/` folder where every other file is `KEBAB-CASE.md` (`QUICK-START-TUTORIAL.md`, `DATA-REQUIREMENTS.md`, `TECHNICAL-REQUIREMENTS.md`, …).

### 1.4 An open question from NB-001 that was never closed

[NB-001 §"Should `src/synth/examples/` be excluded from the published package altogether?"](../research-notebooks/NB-001-initial-codebase-audit.md) flagged `src/synth/examples/` (3 files, 2,666 lines) and `src/synth/scripts/pipeline.ts` (163 lines) as "orphaned reference material — nobody imports them, nobody tests them," and posed exactly two options without picking one: "lift them into proper `node_examples/` scripts or delete them." That question is still open seven ADRs later, and it sits squarely inside this ADR's scope (it's about where runnable example/reference scripts should live), so this is the right place to close it.

### 1.5 Small, mechanical repo-hygiene items found in the same pass

- **Tracked `.DS_Store` files.** `.gitignore` already has `**/.DS_Store` (added at some point after these were first committed), but `git ls-files | grep DS_Store` still shows six tracked copies: `.DS_Store`, `examples/.DS_Store`, `examples/lessons/L00-elm-primer/.DS_Store`, `examples/lessons/L00-elm-primer/images/.DS_Store`, `node_examples/.DS_Store`, `public/.DS_Store`, `src/.DS_Store`. Adding a pattern to `.gitignore` does not untrack files already committed — these are macOS noise that every future `git status` after opening Finder in these folders risks re-dirtying.
- **A byte-identical duplicate script.** `scripts/remove-license-and-fix-imports.cjs` and `scripts/remove-license-and-fix-imports.js` are confirmed identical (`diff` produces no output), and neither is referenced from `package.json` or any other script — both appear to be leftover, already-run one-off migration tooling from the license-removal work `docs/HISTORY.md` describes.
- **A single-file `docs/` subdirectory.** `docs/syllabus/` contains exactly one file, `SYLLABUS.md` (304 lines, a pandoc-frontmatter document prepared for the RMC academic advisor). It's real content, not clutter, but it's also invisible from `claude-markdown-documents/README.md`'s ADR/plan index — a reader following the planning-docs trail has no way to discover the syllabus exists, even though it and ADR-0003/IMPL-0003 describe the same 8-week program from two different angles (external/academic vs. internal/execution) and are never cross-linked.

## 2. Decision

> We will (a) group all intern-program material — curriculum, capstones, and personal sandboxes — under one new `examples/intern-program/` parent, mirrored by `tests/intern-program/`; (b) group the five loose single-purpose demos under one new `examples/demos/` parent and move `node_examples/` to `examples/node-scripts/` so every runnable example in the repo lives under `examples/`; (c) rename the folders identified in §1.3 to describe their contents instead of their history or implementation details; and (d) apply the small hygiene fixes in §1.5, closing NB-001's open question by moving `src/synth/examples/` and `src/synth/scripts/` into the newly-created `examples/node-scripts/synth/`.

### Details

**Target layout:**

```
examples/
├── demos/                        # NEW — was 5 loose top-level dirs
│   ├── ag-news-classifier/       # was ag-news-demo/
│   ├── autocomplete-chain/       # unchanged
│   ├── chain-with-save/          # unchanged
│   ├── drum-pattern-generator/   # was elm-drum-demo-mainthread/
│   ├── language-classifier/      # was language-awareness-demo/
│   └── README.md                 # NEW — these 5 never had shared docs before
├── practical-examples/           # unchanged — already well-organized; now a clear sibling of demos/
├── node-scripts/                 # was top-level node_examples/ (own package.json/tsconfig preserved as-is)
│   └── synth/                    # NEW — absorbs src/synth/examples/ + src/synth/scripts/, closing NB-001's open question
└── intern-program/                # NEW
    ├── lessons/                   # was examples/lessons/ (internal structure unchanged: L00–L06, _shared, _template)
    ├── capstones/                 # was examples/capstones/ (internal structure unchanged)
    └── sandboxes/
        └── nolan/                 # was examples/nolan-test/ (internal structure unchanged: ham-spam/, word-predictor/)

tests/
└── intern-program/
    └── capstones/
        └── nolan-infrastructure/  # was tests/capstones/nolan-infrastructure/
```

**Why `demos/` and `practical-examples/` stay as two categories, not one.** They answer different questions — `demos/` shows off one specific library API in isolation (AG News classification, the autocomplete pipeline, chain persistence, drum-pattern generation, language detection); `practical-examples/` is organized around front-end developer pain points (search, moderation, form autocomplete, intent routing, recommendations) with a heavier, consistent documentation format (problem solved, use cases, common patterns, troubleshooting). Merging them would erase a distinction that's actually useful and would require rewriting `practical-examples/`'s already-good documentation for no organizational gain. The fix here is giving both a common, discoverable parent (`examples/`, with `demos/` finally getting the shared README `practical-examples/` already has) — not flattening them into one bucket.

**Why `node_examples/` moves inside `examples/` rather than just getting renamed in place.** The actual problem isn't the name alone — it's that "every runnable example lives under `examples/`" isn't true today, and a top-level sibling with a suspiciously similar name is the most confusing possible way for that to be false. Nesting it resolves both the naming collision and the structural inconsistency in one move. Its own `package.json`, `package-lock.json`, and `tsconfig.json` move with it unchanged — it stays a self-contained sub-package, just correctly located.

**Mechanical consequence worth calling out:** every file that moves one level deeper (into `intern-program/`, `demos/`, or `node-scripts/`) has its relative links to `claude-markdown-documents/`, `src/`, etc. shift by exactly one `../`. IMPL-0009 must fix these link depths as part of the move, not just the directory names.

**Historical documents are not rewritten.** ADR-0002 through ADR-0008, their paired implementation plans, and NB-001 through NB-005 all contain prose or links referencing paths this ADR moves (`examples/nolan-test/word-predictor/`, `examples/capstones/...`, `examples/lessons/...`, `node_examples/...`, etc.). Per this project's own convention ("don't edit accepted ADRs in place — supersede or append, never rewrite"), those records are **not** edited to match the new paths — they're a record of what was true when the decision was made, the same way ADR-0001's references to the now-deleted `src/elm/` variants are read today as history, not as live pointers. Where a stale reference could genuinely mislead a reader trying to follow it *today*, IMPL-0009 appends a one-line breadcrumb using the same `## Revisions`-style append ADR-0008 already established for NB-005, rather than rewriting the original prose. **Living documents** — `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `package.json`, `docs/*.md`, and the per-folder `README.md`/`STARTER.md` files that move with their folders — are updated in place, because their entire job is to describe current reality.

## 3. Options Considered

### Intern-work consolidation (§1.1)

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. New `examples/intern-program/{lessons,capstones,sandboxes}/` parent | One discoverable top-level entry replaces three unrelated-looking siblings; `sandboxes/<name>/` generalizes cleanly to future cohorts | Every path referencing lessons/capstones/nolan-test needs updating (§ mechanical consequence above) | ✅ chosen |
| B. Leave the three where they are, just rename `nolan-test/` → `sandbox-nolan/` in place | Smallest possible diff | Doesn't fix the actual problem: three siblings still read as unrelated top-level concerns in an `examples/` listing that also has 6 other unrelated things in it | rejected |
| C. Merge `sandboxes/` content into `capstones/` | Fewer directories | Actively wrong — ADR-0004/0005 and the cohort plan are explicit that sandbox work is *not* a graded capstone deliverable; merging them erases a distinction the interns' own governing ADRs depend on | rejected |

Tests follow the same logic: `tests/capstones/` → `tests/intern-program/capstones/`, mirroring `examples/` 1:1 so "where are the tests for X" is always "the same relative path under `tests/`."

### Demo consolidation (§1.2)

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. New `examples/demos/` for the 5 loose dirs; `practical-examples/` stays separate; `node_examples/` moves to `examples/node-scripts/` | Fixes the "no shared parent" problem for the loose demos, fixes the top-level naming collision for Node scripts, preserves the genuinely useful demos-vs-practical-examples distinction | Three directories' worth of path updates | ✅ chosen |
| B. Flatten everything (`demos/` + `practical-examples/` + `node-scripts/`) into one `examples/demos/` | Simplest possible mental model: one bucket | Destroys `practical-examples/`'s numbered, pain-point-oriented framing for no benefit; forces Node (ts-node) scripts and browser (vite) demos into the same conceptual bucket even though they run completely differently | rejected |
| C. Leave `node_examples/` at the top level, just rename the underscore away (`node-examples/`) | Zero moves, one `git mv` | Doesn't fix the actual issue — a top-level sibling of `examples/` still implies "these are parallel/equivalent," which they aren't | rejected |

### Folder renames (§1.3) and NB-001's open question (§1.4)

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Rename to describe content (`ag-news-classifier`, `drum-pattern-generator`, `language-classifier`); resolve NB-001 by moving `src/synth/examples/` + `src/synth/scripts/` into `examples/node-scripts/synth/` | Every name now answers "what's in here" without repo archaeology; closes a 7-ADR-old open question instead of leaving it open indefinitely | `src/synth/` code that other `src/synth/` files may reference by relative import needs an import-path check (these are excluded from the build per `rollup.config.cjs`, but internal relative imports must still resolve if anyone runs them) | ✅ chosen |
| B. Rename folders but leave `src/synth/examples/`/`scripts/` where they are, undecided | Smaller diff | Leaves NB-001's question open for an 8th ADR to eventually re-discover | rejected |
| C. Delete `src/synth/examples/`/`scripts/` outright (NB-001's other named option) | Removes 2,829 lines of unreferenced code | These are the only end-to-end usage examples for `OmegaSynth`'s five generation modes that exist anywhere in the repo — deleting reference material nobody has reviewed yet is exactly the kind of one-way door ADR-0001 avoided by archiving `src/elm/` instead of just deleting it | rejected (for now — nothing stops a future ADR from deleting them once someone has actually reviewed whether they still reflect current `OmegaSynth` APIs) |

## 4. Consequences

- **Positive:** `examples/` goes from 9 same-depth top-level entries mixing at least 4 different organizing principles to 4 top-level entries (`demos/`, `practical-examples/`, `node-scripts/`, `intern-program/`), each internally consistent and each answering a different, nameable question. Every folder name now describes what's inside it rather than its implementation history or a since-lost distinction. NB-001's oldest open question gets closed. Six tracked `.DS_Store` files and one duplicate script stop cluttering `git status`/diffs.
- **Negative / cost:** This is a wide, mostly-mechanical diff — every `npm run dev:*` script in `package.json` that points at a moved demo, both `tsconfig*.json` exclude lists, `rollup.config.cjs`'s two exclude arrays, `tests/lessons-schema.test.ts`'s hardcoded path, and every *living* doc (`README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/CODE-WALKTHROUGH.md`, `docs/IMPLEMENTATION-MODELS.md`, `docs/QUICK-START-TUTORIAL.md`, plus every per-folder `README.md`/`STARTER.md` that moves) needs a coordinated update in the same PR, or the repo is left in a half-migrated, more-confusing-than-before state.
- **Neutral / follow-on:** Historical ADRs/plans/notebooks keep their original (now-stale) path references per the no-rewrite principle in §2 — this is expected and matches how `src/elm/`'s references read today post-ADR-0001, not a defect introduced by this ADR. `docs/syllabus/SYLLABUS.md` is cross-linked from `claude-markdown-documents/README.md` as part of this pass (cheap, high-value fix) but is not otherwise restructured — reconciling its content against ADR-0003/IMPL-0003 is out of scope here and, if needed, is its own future ADR.
- **Risks & mitigations:** Missing one path reference during the move is the main risk (a broken `npm run dev:*` script, a 404'd doc link, or a failing `tests/lessons-schema.test.ts`). Mitigated by IMPL-0009's step-by-step plan being built directly from an exhaustive `grep` of every old path done before writing this ADR (see IMPL-0009 §3), plus running the full validation suite in §6 below before merging.

## 5. Invariants / Guardrails

- Every path that moves must have **zero** remaining references to its old location in any file that ships or runs (`package.json`, `tsconfig.json`, `tsconfig.types.json`, `rollup.config.cjs`, `vite.config.ts` needs no change — it already resolves `examples/${DEMO}` generically — and every `.test.ts` file). Verified by grep, not by memory.
- Historical decision records (ADRs, implementation plans, research notebooks) are never rewritten to match new paths — only appended to, and only where a stale reference would otherwise mislead. This preserves the "don't edit accepted ADRs in place" convention this repo already follows.
- `examples/capstones/` and `examples/lessons/`'s **internal** structure (per-lesson folder names, the 5-asset lesson format, `STARTER.md`'s 5-section shape) is unchanged by this ADR — only their parent path moves. ADR-0002's lesson-format contract and ADR-0003's capstone-lane contract are untouched.
- `node-scripts/`' (formerly `node_examples/`) own `package.json`/`package-lock.json`/`tsconfig.json` keep functioning as an independent sub-package after the move — this ADR relocates it, it does not merge its dependency tree into the root package.
- `npm run build`, `npm test`, and every `npm run dev:*` script must succeed after the move, on a clean clone, before this ADR's status can move to Accepted.

## 6. Validation

- **Grep-clean check:** `grep -rn "nolan-test\|node_examples\|ag-news-demo\|elm-drum-demo-mainthread\|language-awareness-demo\|examples/capstones\|examples/lessons\|tests/capstones" --include="*.json" --include="*.ts" --include="*.cjs"` across the repo (excluding `node_modules`, `dist`, and the historical ADR/plan/notebook files this ADR explicitly leaves alone) returns nothing outside of intentionally-preserved historical references.
- **Build/test check:** `npm run build` and `npm test` both succeed on a fresh clone after the move.
- **Dev-script spot check:** every renamed `npm run dev:*` script (`dev:news`, `dev:autocomplete`, `dev:chain`, `dev:music`, `dev:lang`, `dev:ham-spam`, `dev:word-predictor`, `dev:elm`, `dev:lesson:00`–`06`, `dev:lesson`, `dev:lesson:template`) launches and shows the expected demo, not a 404.
- **Link check:** the same relative-link/fence-balance check already used for NB-005 (per ADR-0008) run against every *living* doc this ADR touches.
- **NB-001 closure check:** `src/synth/examples/` and `src/synth/scripts/` no longer exist at their old paths; the moved copies under `examples/node-scripts/synth/` still compile standalone (they're excluded from the published build either way, but should not be silently broken).

## 7. Sign-off Checklist

- [ ] ADR reviewed
- [x] IMPL plan written and linked ([IMPL-0009](../implementation-plans/IMPL-0009-consolidate-repo-navigation-and-naming.md))
- [ ] Moves executed and grep-clean check passes
- [ ] Tests / guardrails in place (`npm run build`, `npm test`, dev-script spot check all green)
- [ ] Docs updated (`README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/*`, per-folder `README.md`/`STARTER.md`, `claude-markdown-documents/README.md` index)
- [ ] Branch correct for the work (`repo-navigation-consolidation`)

---

## See also

- [ADR-0001](./ADR-0001-consolidate-repo-and-prepare-for-interns.md) / [IMPL-0001](../implementation-plans/IMPL-0001-consolidate-repo-and-prepare-for-interns.md) — the precedent for this kind of repo-wide consolidation pass, and the "archive, don't just delete" instinct this ADR borrows for `src/synth/examples/`.
- [NB-001](../research-notebooks/NB-001-initial-codebase-audit.md) — source of the still-open `src/synth/examples/` question this ADR closes.
- [IMPL-0009](../implementation-plans/IMPL-0009-consolidate-repo-navigation-and-naming.md) — the execution plan.
