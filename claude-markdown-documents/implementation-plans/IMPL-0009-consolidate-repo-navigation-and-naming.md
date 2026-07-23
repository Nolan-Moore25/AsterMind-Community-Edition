# Implementation Plan — Consolidate repo navigation and naming

- **Date:** 2026-07-21
- **Author:** Nolan Moore (with planning support from Claude)
- **Branch:** `repo-navigation-consolidation`
- **Related ADR:** [ADR-0009](../ADRs/ADR-0009-consolidate-repo-navigation-and-naming.md)
- **Related docs / bugs:** [ADR-0001](../ADRs/ADR-0001-consolidate-repo-and-prepare-for-interns.md) / [IMPL-0001](./IMPL-0001-consolidate-repo-and-prepare-for-interns.md) (precedent); [NB-001](../research-notebooks/NB-001-initial-codebase-audit.md) (the open question this closes)

---

## 1. Goal

Execute ADR-0009 against the actual filesystem: move intern-program material under `examples/intern-program/` (mirrored by `tests/intern-program/`), move the five loose demos under `examples/demos/`, relocate `node_examples/` to `examples/node-scripts/`, resolve NB-001 by moving `src/synth/examples/` + `src/synth/scripts/` into `examples/node-scripts/synth/`, rename the folders ADR-0009 §1.3 identifies as misleading, and apply the small hygiene fixes (untrack `.DS_Store`, delete the duplicate script, kebab-case the two `docs/` outliers, cross-link the syllabus). Done means: every path in the target layout exists, every reference to an old path in a file that ships or runs is updated, historical ADRs/plans/notebooks are left untouched (or given a one-line append, never a rewrite), `npm run build` and `npm test` pass, and every `npm run dev:*` script launches its demo correctly on a clean clone.

## 2. Scope

- **In scope:** all moves, renames, and reference updates listed in §3–§5 below; the `.DS_Store` untrack; deleting the duplicate `remove-license-and-fix-imports.js`; renaming `docs/COMPARISON_CHART.md` → `docs/COMPARISON-CHART.md` and `docs/REAL_WORLD_EXAMPLES.md` → `docs/REAL-WORLD-EXAMPLES.md`; adding one cross-link between `claude-markdown-documents/README.md` and `docs/syllabus/SYLLABUS.md`.
- **Out of scope (explicitly):**
  - Rewriting any Accepted ADR, implementation plan, or research notebook's prose to match new paths (ADR-0009 §2's no-rewrite principle) — only living docs are edited in place.
  - Reconciling `docs/syllabus/SYLLABUS.md`'s content against ADR-0003/IMPL-0003 — this plan only adds the missing cross-link, per ADR-0009 §4 Neutral/follow-on.
  - Deleting `src/synth/examples/`/`src/synth/scripts/` (ADR-0009 Option C, rejected) — they are moved, not removed.
  - Any change to `examples/practical-examples/`'s internal structure or documentation — it keeps its content and format, only gains a sibling.
  - Any change to the lesson format, capstone `STARTER.md` shape, or A-SMART/TSDR pedagogy (ADR-0002/ADR-0003 territory).
  - The standalone `Nolan-Moore25/ELM-Next-word-predictor` repo — it's a separate, already-forked project; this plan does not touch it.
- **Assumptions / preconditions:**
  - ADR-0009 is accepted as written before this plan executes.
  - Executed on a clean working tree (`git status` clean) on the `repo-navigation-consolidation` branch, cut from `main`.
  - No other in-flight branch is simultaneously editing `package.json`, `examples/`, `node_examples/`, or `tests/capstones/` — merge conflicts here would be painful given the volume of path references.

## 3. Affected Areas

### 3.1 Directory moves (`git mv`, preserves history)

| From | To |
|---|---|
| `examples/lessons/` | `examples/intern-program/lessons/` |
| `examples/capstones/` | `examples/intern-program/capstones/` |
| `examples/nolan-test/` | `examples/intern-program/sandboxes/nolan/` |
| `tests/capstones/` | `tests/intern-program/capstones/` |
| `examples/ag-news-demo/` | `examples/demos/ag-news-classifier/` |
| `examples/autocomplete-chain/` | `examples/demos/autocomplete-chain/` |
| `examples/chain-with-save/` | `examples/demos/chain-with-save/` |
| `examples/elm-drum-demo-mainthread/` | `examples/demos/drum-pattern-generator/` |
| `examples/language-awareness-demo/` | `examples/demos/language-classifier/` |
| `node_examples/` | `examples/node-scripts/` |
| `src/synth/examples/` | `examples/node-scripts/synth/examples/` |
| `src/synth/scripts/` | `examples/node-scripts/synth/scripts/` |
| `docs/COMPARISON_CHART.md` | `docs/COMPARISON-CHART.md` |
| `docs/REAL_WORLD_EXAMPLES.md` | `docs/REAL-WORLD-EXAMPLES.md` |

### 3.2 Files requiring content edits (live path references)

| Area | File(s) | Change |
|---|---|---|
| Build config | `package.json` (root) | Every `dev:*` script's `DEMO=` value updated per §4 table below |
| Sub-package dep path | `examples/node-scripts/package.json` | `"@astermind/astermind-elm": "file:.."` → `"file:../.."` — the local-path dep on the repo-root package must gain one `../` now that the sub-package sits one level deeper (verified during planning; the IMPL's original "moves unchanged" was wrong). Also check `examples/node-scripts/package-lock.json` for a resolved `".."` path and regenerate/patch if present. |
| Type-check config | `tsconfig.json`, `tsconfig.types.json` | Remove the now-redundant `"node_examples"` exclude entry (`"examples"` already covers it once nested); no other change needed |
| Bundler config | `rollup.config.cjs` | Remove `'node_examples'` from both `exclude` arrays (same redundancy as above) |
| Test glob | `tests/lessons-schema.test.ts:5` | `resolve(__dirname, "..", "examples", "lessons")` → `resolve(__dirname, "..", "examples", "intern-program", "lessons")` |
| Root docs | `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` | Update every path reference to the tables in §3.1; `ARCHITECTURE.md`'s repository-layout tree block gets the new structure; `CONTRIBUTING.md`'s "where does this go" table (lines 63-64) gains rows for `demos/`, `capstones/`, `sandboxes/`, `node-scripts/` |
| Living guides | `docs/CODE-WALKTHROUGH.md`, `docs/IMPLEMENTATION-MODELS.md`, `docs/QUICK-START-TUTORIAL.md` | Update every reference to a moved demo path |
| Capstone docs | `examples/intern-program/capstones/README.md`, `.../thomas-adaptive-game/STARTER.md`, `.../jarrett-lotl-classifier/STARTER.md`, `.../nolan-infrastructure/STARTER.md`, `.../nolan-infrastructure/DISCUSSIONS-GUIDE.md` | Fix outbound relative links (now one level deeper: `../../../claude-markdown-documents/...` instead of `../../claude-markdown-documents/...`); update sibling references to `sandboxes/nolan/`, `tests/intern-program/capstones/` |
| Lesson docs | `examples/intern-program/lessons/README.md`, `_template/README.md`, each `L0N-*/README.md` that links out | Fix outbound relative link depth |
| Sandbox docs | `examples/intern-program/sandboxes/nolan/word-predictor/README.md` | Fix outbound relative links; fix any self-referential path text |
| Node-scripts docs | `examples/node-scripts/README.md` | Update every `node_examples/<script>` command example to `examples/node-scripts/<script>` (or drop the path prefix if the README is meant to be read from inside that directory — confirm during execution) |
| Living index | `claude-markdown-documents/README.md` | Update the "Topic" column's path mentions for the ADR-0003/0004/0005/0006 rows (this is a navigation index, not a decision record — update in place); add a new row for ADR-0009/IMPL-0009 (already added as part of authoring this ADR); add a one-line cross-link to `docs/syllabus/SYLLABUS.md` |
| Publishing guide | `docs/PUBLISHING.md` | Update its `examples/capstones/...` reference |
| CHANGELOG | none | `CHANGELOG.md`'s `node_examples/` mentions describe past releases — leave untouched (historical record, same principle as the ADRs) |

### 3.3 Historical documents — append-only, per ADR-0009 §2's no-rewrite principle

| File | What to do |
|---|---|
| ADR-0004, ADR-0005, IMPL-0004, IMPL-0005 | No edit. Their `examples/nolan-test/word-predictor/` references describe where the code lived when the decision was made. |
| ADR-0006, IMPL-0006, ADR-0003, IMPL-0003, NB-005 | No edit. Their `examples/capstones/...` references are historically accurate as written. |
| ADR-0002, IMPL-0002, NB-002, NB-004, IMPL-0003 | No edit. Their `examples/lessons/...` references are historically accurate as written. |
| NB-001, NB-003, `docs/HISTORY.md`, `CHANGELOG.md` | No edit. `node_examples/` mentions are describing past investigation/cleanup work. |
| IMPL-0007 | No edit. |

If, during execution, a specific historical reference is judged genuinely likely to mislead a reader (not just "technically stale"), append a single-line breadcrumb in that document's `## Revisions` section (creating one if absent) — do not touch the original prose. Expect this to be rare; the historical docs above are describing what a decision *was*, not offering live navigation.

## 4. Approach

Do the moves before the reference updates, in dependency order, so nothing is edited against a stale path:

1. **`git mv` everything first** (§3.1), in one commit or a tightly-scoped series — directory moves are individually low-risk and git tracks renames automatically at >50% similarity, so history (`git log --follow`) survives.
2. **Fix config next** (`package.json`, both `tsconfig*.json`, `rollup.config.cjs`, `tests/lessons-schema.test.ts`) — these gate whether the build and tests even run, so fixing them immediately after the moves means every subsequent step can be checked with `npm run build`/`npm test` rather than manual inspection.
3. **Fix living docs last** — by this point the repo is mechanically correct (build green, tests green); doc updates are then purely about accuracy, not about unblocking anything.
4. **Hygiene items (`.DS_Store`, duplicate script, `docs/` renames, syllabus cross-link) can happen in parallel with any of the above** — they're independent of the directory-move dependency chain.

The one place needing real care: relative link depth. Every file moving into a new one-level-deeper parent (`intern-program/`, `demos/`, `node-scripts/`) has every `../` in its outbound links off by one afterward. Fix these link-by-link during step 3, then run the link-check in step 9 to confirm — don't rely on eyeballing.

## 5. Step-by-Step Plan

1. **Baseline check** — confirm `git status` is clean and `npm test` / `npm run build` pass before any change, so any later failure is attributable to this plan's edits. Verification: both green.
2. **Execute directory moves** — run the fourteen `git mv` operations in §3.1 (create parent directories as needed: `examples/demos/`, `examples/intern-program/`, `examples/intern-program/sandboxes/`, `examples/node-scripts/synth/`, `tests/intern-program/`). Verification: `find examples tests -maxdepth 3` matches ADR-0009's target layout; `git status` shows renames, not add+delete pairs (confirms git's similarity detection kicked in).
3. **Update `package.json`** — rewrite each `dev:*` script's `DEMO=` value per this mapping: `dev:ham-spam` → `intern-program/sandboxes/nolan/ham-spam`; `dev:word-predictor` → `intern-program/sandboxes/nolan/word-predictor`; `dev:news` → `demos/ag-news-classifier`; `dev:autocomplete` → `demos/autocomplete-chain`; `dev:chain` → `demos/chain-with-save`; `dev:music` → `demos/drum-pattern-generator`; `dev:lang` → `demos/language-classifier`; `dev:elm`, `dev:lesson:00`–`06`, `dev:lesson`, `dev:lesson:template` → `intern-program/lessons` (only the `DEMO=` value changes; the `--open /LNN.../ ` and `--open /_template/` suffixes are unaffected). `dev:search`/`moderation`/`form-autocomplete`/`intent`/`recommendations` are unaffected (practical-examples doesn't move). Verification: `grep "DEMO=" package.json` shows only new paths; no `nolan-test`, `ag-news-demo`, `autocomplete-chain` (bare, i.e. not under `demos/`), `chain-with-save` (bare), `elm-drum-demo-mainthread`, or `language-awareness-demo` remain.
4. **Update `tsconfig.json`, `tsconfig.types.json`, `rollup.config.cjs`** — remove the now-redundant `"node_examples"` / `'node_examples'` exclude entries (the pre-existing `"examples"` / `'examples'` entries already cover the relocated directory). Verification: `grep node_examples tsconfig.json tsconfig.types.json rollup.config.cjs` returns nothing; `npm run build` still succeeds and `dist/` still excludes everything it excluded before.
   - **4a. Fix the node-scripts sub-package dep path** — in `examples/node-scripts/package.json`, change `"@astermind/astermind-elm": "file:.."` to `"file:../.."` (the local-path dep on the repo root needs one more `../` now that the sub-package is one level deeper). Check `examples/node-scripts/package-lock.json` for a `".."`-resolved path to the root package and patch or delete-and-regenerate it if present. Verification: `grep '"file:' examples/node-scripts/package.json` shows `file:../..`; the sub-package is not installed in CI so this is a correctness edit, not a gating one, but a `cd examples/node-scripts && npm install` should resolve the local dep without error if spot-checked.
   - **4b. Synth reference scripts move byte-identical, not repaired** — `examples/node-scripts/synth/examples/` and `.../scripts/` are relocated verbatim by the `git mv` in step 2 with **no import edits**. Per ADR-0009 §1.4/§2, these files are already non-compiling in place (`quickstart.ts` → `../synth/index.js` doesn't exist; `evaluateGeneratedData.ts` → `../scripts/loadTrainingData` doesn't exist) and are excluded from every build/test gate, so they are preserved as flagged reference material rather than half-repaired. Verification: `git diff --stat` shows these files as pure renames (0 content changes); the fix-or-delete decision is left to a future ADR.
5. **Update `tests/lessons-schema.test.ts:5`** — change the hardcoded path per §3.2. Verification: `npx vitest run tests/lessons-schema.test.ts` passes and actually discovers all 7 lessons (not zero, which would indicate a silently-wrong path).
6. **Update root docs** (`README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`) — apply every path change in §3.2, including `ARCHITECTURE.md`'s ASCII tree and `CONTRIBUTING.md`'s "where does this go" table gaining the four new rows (`examples/demos/` → "a single-feature library showcase," `examples/intern-program/capstones/` → "a capstone deliverable," `examples/intern-program/sandboxes/` → "personal, ungraded practice work," `examples/node-scripts/` → "a standalone Node/ts-node script"). Verification: every markdown link in these three files resolves (manual check or the link-check script from step 9).
7. **Update `docs/CODE-WALKTHROUGH.md`, `docs/IMPLEMENTATION-MODELS.md`, `docs/QUICK-START-TUTORIAL.md`, `docs/PUBLISHING.md`** — fix every reference to a moved path. Verification: same link-check.
8. **Update the moved folders' own docs** (capstone `README.md`/`STARTER.md`/`DISCUSSIONS-GUIDE.md`, lesson `README.md`s, sandbox `word-predictor/README.md`, `node-scripts/README.md`) — fix outbound relative-link depth (now one level deeper) and any path text describing their own old location. Verification: link-check; spot-read each for "as described above at `examples/oldpath/...`"-style leftover text.
9. **Run the link/fence-balance check** across every file touched in steps 6-8 (the same relative-link checker used for NB-005 per ADR-0008). Verification: zero broken links.
10. **Update `claude-markdown-documents/README.md`** — fix the Topic-column path mentions for the ADR-0003/0004/0005/0006 rows (living index, not a decision record) and add the one-line `docs/syllabus/SYLLABUS.md` cross-link. Verification: link resolves; ADR-0009's own row (added when this ADR was authored) is present and accurate.
11. **Hygiene: untrack `.DS_Store`** — `git rm --cached .DS_Store examples/.DS_Store examples/lessons/L00-elm-primer/.DS_Store examples/lessons/L00-elm-primer/images/.DS_Store node_examples/.DS_Store public/.DS_Store src/.DS_Store` (paths adjusted for the `node_examples/` → `examples/node-scripts/` move if not yet renamed on disk by the OS regenerating one). Verification: `git ls-files | grep -i DS_Store` returns nothing; the files still exist on disk (untracked, not deleted) since `.gitignore` already covers them going forward.
12. **Hygiene: delete the duplicate script** — confirm `diff scripts/remove-license-and-fix-imports.cjs scripts/remove-license-and-fix-imports.js` is still empty, confirm neither is referenced anywhere (`grep -rn "remove-license-and-fix-imports" --include="*.json" .`), then delete `scripts/remove-license-and-fix-imports.js` (keep the `.cjs`, matching this repo's other maintenance scripts' extension). Verification: file gone; `npm run build` / `npm test` unaffected (confirms it truly was unreferenced).
13. **Hygiene: rename the two `docs/` outliers** — `git mv docs/COMPARISON_CHART.md docs/COMPARISON-CHART.md` and `git mv docs/REAL_WORLD_EXAMPLES.md docs/REAL-WORLD-EXAMPLES.md`; grep for and fix any inbound links to the old filenames. Verification: `grep -rln "COMPARISON_CHART\|REAL_WORLD_EXAMPLES" --include="*.md" .` returns nothing.
14. **Full validation pass** — `npm run build`, `npm test`, then manually launch every renamed `dev:*` script and confirm the correct demo loads (§6 of ADR-0009). Verification: all green; no 404s; lesson picker (`examples/intern-program/lessons/index.html`) still lists all 7 lessons correctly.
15. **Final grep-clean check** — re-run the exhaustive grep from ADR-0009 §6 across the whole repo (excluding `node_modules`, `dist`, and the historical files named in §3.3) and confirm zero stray old-path references remain outside the intentionally-preserved historical set.

## 6. Data / Migration

None. This is a filesystem reorganization plus documentation/config edits — no runtime data, schema, or persisted state is touched. `git mv` preserves history for every moved file (confirmed via `git log --follow <new-path>` post-move). Rollback is a plain `git revert` of the consolidating commit(s); nothing here is destructive at the git-history level.

## 7. Testing & Verification

- **Unit / spec:** `npm test` (full vitest suite) green after every step from §5.5 onward; `tests/lessons-schema.test.ts` specifically discovers all 7 lessons under the new path.
- **Integration / E2E:** every `npm run dev:*` script launches its correct demo (manual browser check per script, per ADR-0009 §6).
- **Manual / demo:** the link/fence-balance check (step 9) across every edited markdown file; a manual read of `CONTRIBUTING.md`'s updated "where does this go" table to confirm it now actually covers every category present in `examples/`.
- **Acceptance criteria:**
  - `find examples tests -maxdepth 3` matches ADR-0009's target layout exactly.
  - Zero stray references to any old path outside the historical-documents allowlist (§3.3).
  - `npm run build`, `npm test`, and all `dev:*` scripts succeed on a clean clone of the branch.
  - `git ls-files | grep -i DS_Store` empty; the duplicate script and the two `SCREAMING_SNAKE_CASE.md` files are gone (renamed/deleted as specified).
  - `claude-markdown-documents/README.md` links to both ADR-0009 and `docs/syllabus/SYLLABUS.md`.

## 8. Rollout / Deploy

No runtime rollout — this is a repo-structure change with no deploy step, feature flag, or staged release. It should land as one PR (large, but a single coherent diff is far easier to review than a half-migrated repo split across several PRs). No npm version bump is required by this change alone, though it's reasonable to bundle it with the next release's changelog entry noting the reorganization for anyone with the old paths bookmarked or scripted against.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| A path reference is missed, breaking a `dev:*` script or a doc link | Med | Low–Med (annoying, not data-destructive) | Step 15's exhaustive grep-clean check, run last, specifically to catch stragglers before merge |
| Relative-link depth math is wrong in a moved folder's own docs | Med | Low | Step 9's link-check catches broken relative links mechanically, independent of manual review |
| Someone has an in-flight branch touching `examples/nolan-test/` or `node_examples/` when this merges | Low | Med (merge conflict, possible silent path drift) | Coordinate merge timing; this plan's Assumptions/preconditions call this out explicitly |
| `git mv`'s rename detection doesn't kick in for a heavily-edited file, losing `git log --follow` continuity | Low | Low | Verify with `git log --follow` on a few moved files post-merge; if broken, `git blame` on the pre-move commit still recovers full history |
| A historical ADR/plan reference is judged mid-execution to need more than a breadcrumb (i.e., feels like it needs a real rewrite) | Low | Low | Stop and treat that specific document as its own small follow-up decision rather than improvising a rewrite under this plan — per ADR-0009 §2, historical records aren't rewritten as a matter of course |

## 10. Open Questions

- [ ] Should `examples/node-scripts/README.md`'s command examples keep the `examples/node-scripts/` prefix, or assume the reader has already `cd`'d into that directory? (Affects how many lines in that README need editing — a style call, not a correctness one.)
- [ ] Does `docs/syllabus/SYLLABUS.md` get reconciled against ADR-0003/IMPL-0003's curriculum content as a near-term follow-up, or does the cross-link added here suffice for now? (Explicitly out of scope for this plan either way — flagging so it doesn't get lost.)

## 11. Done Checklist

- [x] All steps complete and verified
- [x] Tests green (`npm test` — 19 files / 122 tests; `npm run build` — OK)
- [x] Docs / ADR updated (ADR-0009 sign-off checklist ticked)
- [ ] Deployed / merged to correct branch (work is committed-ready on `repo-navigation-consolidation`; **not yet committed/merged** — pending review)
- [ ] Sign-off (reviewer pass pending)

## 12. Execution notes (2026-07-21)

Executed on branch `repo-navigation-consolidation`. All fourteen moves in §3.1 landed as `git mv` (history-preserving); the synth relocation shows as add+delete in `git status` rather than `R`, but the files are byte-identical so `git log --follow` / `git diff -M` still resolve the rename.

**Beyond the written steps, the following path references also needed fixing (found by the code-and-asset scan and the grep-clean pass, not just the doc-link pass the plan anticipated):**

1. **`tests/intern-program/capstones/nolan-infrastructure/rff-worked-example.test.ts`** imported `../../../src/index`; the deeper location needed `../../../../src/index`. This was a real test failure (caught by `npm test`), not a doc-only edit — the plan under-scoped it by treating moved-file link fixes as docs-only.
2. **`examples/intern-program/lessons/index.html`** had three **absolute GitHub `blob/main/examples/capstones/...` URLs** that would have 404'd after merge — repointed to `examples/intern-program/capstones/...`.
3. **`examples/node-scripts/*.ts` header comments** (run-command examples) still said `node_examples/` — bulk-updated to `examples/node-scripts/`.
4. **Numerous display-text/comment path strings** across lesson content (`_shared/lesson.css`, `_shared/lessons-schema.json`, `_shared/lesson-deck.js`, `_template/index.html`, `_template/README.md`, L01 speaker-notes), capstone STARTERs (Jarrett/Thomas code+test destination paths), `docs/PUBLISHING.md`, `docs/HISTORY.md`, `docs/CODE-WALKTHROUGH.md`, `docs/IMPLEMENTATION-MODELS.md`, and the sandbox word-predictor were updated for accuracy.

**The two planning-time findings (see §3.2, §4a/4b) were handled as documented:** `examples/node-scripts/package.json` + `package-lock.json` had their `file:..` local-dep path deepened to `file:../..`; the synth reference scripts were relocated byte-identical and left un-repaired (pre-existing broken imports preserved, flagged for a future fix-or-delete ADR).

**Final grep-clean:** the only remaining old-path tokens live in intentionally-preserved records — historical ADRs/IMPLs/NBs (0002–0008, NB-001–005), `CHANGELOG.md`, `docs/HISTORY.md`'s retired-file names (with a breadcrumb added), and ADR-0009/IMPL-0009/`ARCHITECTURE.md`'s own before→after explanations.

---

## See also

- [ADR-0009](../ADRs/ADR-0009-consolidate-repo-navigation-and-naming.md) — the decision this plan executes.
- [ADR-0001](../ADRs/ADR-0001-consolidate-repo-and-prepare-for-interns.md) / [IMPL-0001](./IMPL-0001-consolidate-repo-and-prepare-for-interns.md) — the precedent this plan's structure borrows from.
- [NB-001](../research-notebooks/NB-001-initial-codebase-audit.md) — the open question this plan closes in step 2 (via ADR-0009 §1.4).
