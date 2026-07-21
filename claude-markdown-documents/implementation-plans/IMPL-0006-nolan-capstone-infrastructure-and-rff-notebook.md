# Implementation Plan — Nolan capstone: Discussions runbook, publishing runbook, and the RFF research notebook

- **Date:** 2026-07-14
- **Author:** Nolan Moore
- **Branch:** `Simple-Prediction` (author's working branch; merges to `main` via PR)
- **Related ADR:** [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md)
- **Related docs / bugs:** [`examples/capstones/nolan-infrastructure/STARTER.md`](../../examples/capstones/nolan-infrastructure/STARTER.md) (the capstone contract); [ADR-0003](../ADRs/ADR-0003-summer-2026-curriculum-structure.md) § Capstone lanes (the A-SMART source)

---

## 1. Goal

Ship the three artifacts of the Nolan capstone as reviewable repo content: (1) `examples/capstones/nolan-infrastructure/DISCUSSIONS-GUIDE.md`, a complete enable-and-seed runbook for GitHub Discussions with paste-ready category plan, six seed threads, and a moderation policy; (2) `docs/PUBLISHING.md`, the NPM publish runbook (local dry-run, 2FA, CI-based provenance, smoke test, rollback) that lets Julian publish v4.0.0 using only the doc; (3) `claude-markdown-documents/research-notebooks/NB-005-random-fourier-features.md`, the RFF derivation notebook, backed by a permanent seeded vitest suite at `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` importing only public AsterMind API. Done means: all files exist, the suite is green inside a green `npm test`, every number in NB-005 was printed by the committed suite, and the index tables in `claude-markdown-documents/` reference the new artifacts. The Julian-facing ceremonies (dry-run rehearsal, sign-off, Discussions enablement) are explicitly out of this plan's scope.

## 2. Scope

- **In scope:**
  - `DISCUSSIONS-GUIDE.md` in the capstone lane folder (runbook + seed content + moderation policy + acceptance mapping).
  - `docs/PUBLISHING.md` (prereqs, dry-run, manual-publish path, CI-provenance path with workflow YAML, smoke test mirroring the L02 you-try bar, rollback).
  - `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` — seeded, deterministic-in-expectation, assertion-gated; prints every table NB-005 cites.
  - `NB-005-random-fourier-features.md` (~1000–1500 lines per STARTER).
  - Index updates: `claude-markdown-documents/README.md` (ADR/plan table + notebook table), `claude-markdown-documents/research-notebooks/README.md` (index table).
- **Out of scope (explicitly):**
  - Actually enabling Discussions or creating threads on GitHub (admin action; Julian executes the guide).
  - Any real `npm publish` — including a supervised dry-run *with Julian* (STARTER's "run an actual dry-run end-to-end with Julian" is a scheduled ceremony, not a repo artifact; deferred per kickoff note).
  - Committing a `.github/workflows/publish.yml` (the YAML lives *inside* PUBLISHING.md as the recommended follow-on; arming it is Julian's call — ADR-0006 §3, deliverable-2 Option C).
  - `presentation.md` (final-week artifact, separate task).
  - Any change to `src/` — the library already has everything the notebook needs (`rff.ts`, `krr.ts`, `KernelELM.ts`).
- **Assumptions / preconditions:**
  - `buildRFF`/`mapRFF`/`ridgeSolvePro`/`KernelELM`/`Matrix` are exported from `src/index.ts` (verified: `src/pro/index.ts:8` re-exports `./math/index.js`; `src/index.ts:9` exports `KernelELM`).
  - Vitest picks up `tests/**/*.test.ts` (verified: `vite.config.ts` `test.include`).
  - The existing test suite is green on this branch before the new suite lands.

## 3. Affected Areas

| Area | File(s) | Change |
|---|---|---|
| Capstone lane | `examples/capstones/nolan-infrastructure/DISCUSSIONS-GUIDE.md` | New — deliverable 1 |
| Repo docs | `docs/PUBLISHING.md` | New — deliverable 2 (note: ships in the npm tarball via `files: ["docs", ...]`, `package.json:20-25`) |
| Capstone tests | `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` | New — deliverable 3's runnable worked example; joins `npm test` |
| Research notebooks | `claude-markdown-documents/research-notebooks/NB-005-random-fourier-features.md` | New — deliverable 3 |
| Indexes | `claude-markdown-documents/README.md`, `claude-markdown-documents/research-notebooks/README.md` | Add ADR-0006/IMPL-0006 row and NB-005 rows |
| ADRs | `claude-markdown-documents/ADRs/ADR-0006-...md` | New (already landed alongside this plan) |

Nothing frozen or shared is touched; `src/` is deliberately untouched.

## 4. Approach

Author the cheap, dependency-free documents first (guide, publishing runbook) so review can start on them while the measurement work runs. The worked-example suite lands **before** NB-005 because the notebook transcribes the suite's printed tables — writing prose first would invert the "measure, then record" discipline IMPL-0004/0005 established. Risk concentrates in exactly one place: the suite's runtime and determinism inside `npm test` (which is also the `prepublishOnly` gate). That is contained by pinning the N/D grids, seeding every random draw (dataset RNG and `buildRFF`'s `rng` param), and asserting only seed-stable qualitative bounds — never wall-clock numbers.

Bandwidth discipline, fixed before any measurement: σ is chosen once for the spirals dataset; `KernelELM` comparisons always use `gamma = 1/(2σ²)` (ADR-0006 invariant). All timings are reported from one machine and labeled as such in the notebook — the *ratios* are the claim, not the absolute milliseconds.

## 5. Step-by-Step Plan

1. **ADR-0006 + this plan** — land the decision record and plan. Verification: both files exist, cross-linked, numbering follows the monotonic convention (next free number: 0006).
2. **DISCUSSIONS-GUIDE.md** — write the runbook: enablement (UI + `gh api` paths), category plan (Q&A / Ideas / Show & tell / Announcements), six paste-ready seed threads (≥1 per category; welcome post carries the moderation policy), triage cadence, GraphQL seeding recipe, STARTER-checkbox mapping. Verification: every STARTER deliverable-1 acceptance box maps to a numbered section; seed thread count ≥5 with all categories covered.
3. **docs/PUBLISHING.md** — write the runbook per ADR-0006 §2 (dual-path: local manual vs CI provenance). Verify every `package.json` claim against the file (`files`, `prepublishOnly`, `publishConfig`, `exports` incl. the `./workers/elm-worker.js` subpath that must appear in the tarball). Verification: doc contains the exact dry-run commands, the workflow YAML, the smoke-test script mirroring the L02 ≥80% bar, and the rollback matrix; no step instructs an actual publish.
4. **Worked-example suite, part 1 (infrastructure)** — seeded LCG RNG, two-spirals generator, one-hot encoding, ASCII grid renderer, a small Φ-gram ridge fit built on `ridgeSolvePro`, timing helpers. Verification: suite compiles and a trivial smoke test (‖z_raw‖² = D identity from ADR-0006 §6) passes.
5. **Worked-example suite, part 2 (measurements)** — four printed tables: (a) exact-KernelELM fit/predict time vs N ∈ {250, 500, 1000, 2000}; (b) kernel-approximation error vs D ∈ {10, 50, 200, 1000} with 1/√D reference; (c) spirals showdown — linear vs RFF+ridge vs exact KernelELM (accuracy, fit ms, predict ms, ASCII boundaries) plus an accuracy-vs-D sweep; (d) RFF vs Nyström at matched feature budget. Assertions: linear ≤ 70%, RFF ≥ 90%, exact ≥ 90%, error(D=1000) < error(D=10), norm identity. Verification: `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` green; output captured for NB-005.
6. **Full-suite check** — `npm test` (run mode) stays green with the new file included; note the added wall-clock cost. Verification: zero failures; suite cost recorded in NB-005's "how to run" section.
7. **NB-005** — write the notebook per ADR-0006 §2 structure, transcribing the captured tables verbatim; include the full worked-example code inline and the one-command repro line. Verification: every number in the notebook exists in the captured suite output; a calculus-background read-through of the Bochner section stands alone (no assumed kernel-methods background); length lands in the STARTER's ~1000–1500 band.
8. **Index updates** — add the 0006 row to `claude-markdown-documents/README.md` § Decisions and plans, NB-005 rows to both README index tables. Verification: links resolve (relative paths correct from each README).

## 6. Data / Migration

None — no schema, no persisted state, no cache. The only migration-adjacent fact: `docs/PUBLISHING.md` enters the npm tarball via the `files` allowlist on the *next* publish, which is intended (the runbook documents itself into the artifact it publishes). Rollback of any step is `git revert` of the corresponding file.

## 7. Testing & Verification

- **Unit / spec:** the worked-example suite itself. Hand-derived expected values: ‖z_raw(x)‖² = D exactly for any x (cos² + sin² = 1 summed over D features — asserted to 1e-9); z(x)ᵀz(y) → k(x,y) as D grows (asserted as strict error decrease between D=10 and D=1000, wide-margin to absorb Monte-Carlo noise under the fixed seed).
- **Integration / E2E:** `npm test` full run green (the suite lives inside the `prepublishOnly` gate it documents).
- **Manual / demo:** `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` — prints every NB-005 table; that command is quoted in the notebook.
- **Acceptance criteria (mapped to the STARTER checklist):**
  - *Discussions:* guide exists with ≥3 categories designed, ≥6 seed threads authored, moderation policy included → the repo-side share of the checkbox; enablement itself is Julian's deferred step.
  - *PUBLISHING.md:* exists, end-to-end (dry-run → publish → smoke test → rollback), provenance + 2FA covered honestly (CI-only for provenance); Julian cold-read pending.
  - *NB-005:* exists at the required path, worked example imports real AsterMind code only, derivation readable with calculus background; positive control (RFF ≥ 90% on spirals) and negative control (linear ≈ chance) both asserted in CI.

## 8. Rollout / Deploy

Nothing deploys. Merge to `main` via PR (counts toward the STARTER's ≥5-PR bar). The only "rollout" is social: hand Julian DISCUSSIONS-GUIDE.md and PUBLISHING.md for the deferred ceremonies, which have their own checklist items in ADR-0006 §7.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| Worked-example suite slows `npm test` enough to annoy (it's inside `prepublishOnly`) | Med | Low | N capped at 2000, D at 1000; if cost grows past ~2 min, shrink grids — the notebook records numbers from the committed grid at time of writing |
| Seeded RFF draw happens to sit near an assertion bound → flake | Low | Med | Margins are wide (90% floor vs ~99% observed; error-decrease compared across 100× D span); seed is fixed, so CI sees the identical draw every run |
| npm provenance/2FA docs drift under PUBLISHING.md | Med | Med | Doc links authoritative npm docs at each step and states its own written-on date; review-before-publish step tells the operator to re-check the two linked pages |
| Timings in NB-005 not reproducible on other machines | High | Low | Notebook labels the machine, claims only ratios/asymptotics; assertions never gate on time |
| DISCUSSIONS-GUIDE.md drifts from GitHub's UI wording | Med | Low | Guide gives both UI path and `gh api` path (API is stabler); enablement is a one-time action expected within weeks |

## 10. Open Questions

- [ ] Does Julian want the manual-local publish for v4.0.0 first, or go straight to the CI-provenance workflow? (PUBLISHING.md supports both; affects which follow-on lands next.)
- [ ] Should the seed threads be posted under Julian's account or Nolan's (with maintainer pin)? Guide assumes Julian enables, either account seeds.
- [ ] Post-enablement: adopt `.github/DISCUSSION_TEMPLATE/` forms for Q&A? (Deferred follow-on from ADR-0006 §3 Option B.)

## 11. Done Checklist

- [x] All steps complete and verified
- [x] Tests green (`npm test` including the new worked-example suite)
- [x] Docs / ADR updated (ADR-0006 sign-off boxes for repo-side work; index tables)
- [ ] Deployed / merged to correct branch (PR to `main` pending)
- [ ] Sign-off (Julian: PUBLISHING.md cold-read + Discussions enablement — deferred ceremonies)

---

## See also

- [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — the decision this plan executes.
- [`examples/capstones/nolan-infrastructure/STARTER.md`](../../examples/capstones/nolan-infrastructure/STARTER.md) — the capstone contract and acceptance checklist.
- [NB-005](../research-notebooks/NB-005-random-fourier-features.md) — deliverable 3.
- `docs/PUBLISHING.md`, `examples/capstones/nolan-infrastructure/DISCUSSIONS-GUIDE.md` — deliverables 2 and 1.
