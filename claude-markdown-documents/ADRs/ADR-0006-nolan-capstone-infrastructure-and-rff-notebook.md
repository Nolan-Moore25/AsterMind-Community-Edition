# ADR-0006 — Executing the Nolan capstone: Discussions runbook, publishing runbook, and the RFF research notebook

- **Status:** Accepted
- **Date:** 2026-07-14
- **Author:** Nolan Moore
- **Branch:** `Simple-Prediction` (author's working branch at time of writing; merges to `main` via PR)
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0003](./ADR-0003-summer-2026-curriculum-structure.md) (defines the capstone lane and the A-SMART contract); [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) (this decision's execution plan); [`examples/capstones/nolan-infrastructure/STARTER.md`](../../examples/capstones/nolan-infrastructure/STARTER.md) (the scoping doc this ADR turns into concrete file-level decisions); [NB-005](../research-notebooks/NB-005-random-fourier-features.md) (the deliverable-3 artifact).

---

## 1. Context

ADR-0003 assigned Nolan the *community infrastructure + RFF research notebook* capstone lane, and `examples/capstones/nolan-infrastructure/STARTER.md` scoped it as three deliverables due July 24, 2026:

1. **GitHub Discussions** on `AsterMindAI/AsterMind-Community-Edition` — ≥3 categories, ≥5 seeded threads, documented moderation policy.
2. **`docs/PUBLISHING.md`** — an end-to-end NPM publish runbook (dry-run, provenance, 2FA, smoke test, rollback) good enough that Julian would push the publish button using only this doc. v4.0.0 is tagged in git (`package.json:3`, `"version": "4.0.0"`) but has never been `npm publish`'d.
3. **`NB-005-random-fourier-features.md`** — a research notebook deriving Random Fourier Features from scratch, with a runnable worked example that imports real AsterMind code from `src/pro/math/`.

The STARTER scopes *what*; it deliberately leaves *how* open ("STARTER (initial scoping — refine at kickoff)"). Executing it forces several decisions with non-obvious tradeoffs, which is what this ADR records:

- Background / current behavior:
  - The repo has no Discussions surface, and **enabling Discussions is a GitHub repo-settings action requiring admin permission** — it cannot be done by committing files. Nolan does not hold admin on the `AsterMindAI` org repo; Julian does. So the repo-side deliverable cannot literally be "Discussions is live" — it has to be an artifact that makes going live a ~15-minute admin task.
  - `package.json` is publish-ready in shape: `publishConfig.access: "public"` (`package.json:58-61`), a `prepublishOnly` gate running `clean && build && test` (`package.json:56`), and a `files` allowlist of `dist`, `README.md`, `LICENSE`, `docs` (`package.json:20-25`). Nothing documents how a human uses these safely, and npm **provenance cannot be generated from a local machine at all** — `npm publish --provenance` only works from a supported cloud CI (GitHub Actions / GitLab) with an OIDC token, a constraint the STARTER's "publish procedure with provenance enabled" wording doesn't surface.
  - `src/pro/math/rff.ts` **already implements RFF** — `buildRFF()` (`rff.ts:10-17`, spectral weights `W ~ N(0, 1/σ²)`, phases `b ~ U[0, 2π]`) and `mapRFF()` (`rff.ts:19-34`, paired cos/sin features with a block L2-normalize). It is exported on the public API via `src/pro/index.ts:8` → `src/index.ts:67`. The notebook's job is therefore *derive and validate what exists*, not implement anything — which also means the "no toy reimplementations" acceptance bar is satisfiable by importing.
  - The comparison targets exist too: `KernelELM` (`src/core/KernelELM.ts`) has `mode: 'exact'` (full N×N kernel matrix + Cholesky solve) and `mode: 'nystrom'` (landmark approximation, `KernelELM.ts:25-38`) — exactly the (c) baseline and the §5 RFF-vs-Nyström comparison the STARTER asks for. `ridgeSolvePro` (`src/pro/math/krr.ts:120`) is a production ridge solver usable for both the plain-linear baseline and the RFF+linear model.
  - Research notebooks NB-001–NB-004 establish the format (Date/Tags/Outcome header, Question → Method → findings → surprises → open questions) and the discipline that **numbers are measured, then recorded** — IMPL-0004/0005 hardened that into "record what was actually measured, don't assert."
- **Constraint(s):**
  - Capstone code conventions (`examples/capstones/README.md` § Code conventions): capstone artifacts are first-class repo content; non-rendering logic gets vitest tests under `tests/capstones/<lane>/`; runtime imports come only from the public AsterMind API.
  - The vitest include glob is `tests/**/*.test.ts` (`vite.config.ts` `test.include`), so anything placed under `tests/capstones/nolan-infrastructure/` joins `npm test` — and `npm test` is also the `prepublishOnly` gate, so the worked example must be deterministic and reasonably fast or it degrades the publish path it sits next to.
  - No actual `npm publish` may be executed as part of this work — v4.0.0's first publish is Julian's button to push. Same for enabling Discussions: outward-facing org actions are Julian's.
  - The Julian-facing steps (dry-run rehearsal, sign-off, Discussions enablement) are **explicitly deferred** — this ADR covers producing the artifacts, not the ceremonies around them.
- **Trigger for this decision:** the capstone window is in its final stretch (W9 of the IMPL-0003 calendar, "hit measurable bar" week — Jul 13–17). The STARTER needs to become concrete files now so the remaining time goes to review, rehearsal, and the presentation rather than scoping.

## 2. Decision

> We will ship deliverable 1 as a self-contained enablement runbook with paste-ready seed content in the capstone lane folder, deliverable 2 as `docs/PUBLISHING.md` structured around the "local dry-run, CI-based provenance publish" reality of npm, and deliverable 3 as NB-005 backed by a *permanent* vitest worked-example suite at `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` that imports `buildRFF`/`mapRFF`/`ridgeSolvePro`/`KernelELM` from the real library and prints every number the notebook cites.

### Details

**Deliverable 1 — `examples/capstones/nolan-infrastructure/DISCUSSIONS-GUIDE.md`.**

A runbook an admin can execute top-to-bottom in ~15 minutes: how to enable Discussions (both the Settings-UI path and the `gh api` path), the category plan (Q&A in question/answer format, Ideas, Show & tell, plus announcement-format Announcements), the full markdown body of **six** seed threads (one more than the ≥5 bar, at least one per category, including a pinned welcome post that carries the moderation policy), a moderation/triage policy with a weekly cadence, and the GraphQL `createDiscussion` recipe for scripted seeding. The guide maps each STARTER acceptance checkbox to the step that satisfies it. Seed content is written to be pasted verbatim — the admin contributes permissions, not authorship.

**Deliverable 2 — `docs/PUBLISHING.md`.**

Structured around the constraint the STARTER didn't surface: **provenance requires CI**. The doc covers (a) prerequisites (npm account, 2FA enrollment, `@astermind` org membership, npm ≥ 9.5); (b) the local dry-run — `npm publish --dry-run` (which exercises the full `prepublishOnly` gate) plus `npm pack --dry-run` for fast file-list review against `files` (`package.json:20-25`); (c) two publish paths, clearly separated: the *manual local publish* (2FA OTP, **no provenance possible**) and the *recommended GitHub Actions publish* (OIDC `id-token: write`, `npm publish --provenance`, complete workflow YAML included); (d) a post-publish smoke test that installs the tarball in a clean directory and re-runs the L02 you-try bar (train a two-language greeting classifier, ≥80% held-out accuracy) in Node against the published artifact; (e) rollback reality: published version numbers are burned forever, `npm unpublish` has a narrow 72-hour window, so the primary rollback is `npm deprecate` + publish a patched version. Since `files` includes `docs`, the runbook ships inside the very tarball it describes — the doc calls this out in its file-list review step.

**Deliverable 3 — NB-005 + a permanent worked-example suite.**

- The worked example is **committed as a vitest suite**, not a throwaway harness: `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`. It uses a seeded RNG end-to-end (dataset generation and `buildRFF`'s `rng` parameter, `rff.ts:10`) so every printed number is reproducible, and it asserts the notebook's qualitative claims as loose bounds (linear fails on spirals; RFF+linear and exact KernelELM both exceed 90%; kernel-approximation error shrinks as D grows) so `npm test` re-validates the notebook's story forever without flaking on timing noise.
- The suite measures four things, all printed as tables NB-005 transcribes verbatim: (1) exact-KernelELM fit/predict wall-clock vs N (the O(N²)-memory / O(N³)-solve scaling motivation); (2) mean absolute kernel-approximation error `|z(x)ᵀz(y) − k(x,y)|` vs D against a 1/√D reference; (3) the three-way spirals showdown — plain linear ridge vs RFF+ridge vs exact RBF KernelELM — accuracy, train time, predict time, plus ASCII decision boundaries; (4) RFF-vs-Nyström at matched feature budget (both via public API: `mapRFF` features vs `KernelELM mode:'nystrom'`).
- Bandwidth correspondence is pinned once and used everywhere: `buildRFF(d, D, sigma)` samples `W ~ N(0, 1/σ²)`, which approximates `k(x,y) = exp(−‖x−y‖²/(2σ²))`, so the equivalent `KernelELM` RBF `gamma` is `γ = 1/(2σ²)`. Getting this wrong makes every cross-model comparison silently unfair — it is a named invariant, not a code detail.
- NB-005 follows the NB-001–004 format at STARTER scale (~1000–1500 lines): the scaling problem (measured), Bochner's theorem with the Gaussian transform pair derived by completing the square, the Monte-Carlo construction and why paired cos/sin makes the estimator unbiased, a line-by-line mapping of the math onto `rff.ts` (including proving the code's L2-normalize is *exactly* the textbook 1/√D scaling, because Σₖ(cos²+sin²) = D identically), the measured worked example, RFF vs Nyström, limitations, and surprises. Rahimi & Recht (NeurIPS 2007) is cited as the primary source.

## 3. Options Considered

### Deliverable 1 — form of the Discussions artifact

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Enablement runbook + paste-ready seed content in the lane folder | Everything an admin needs to go live in one sitting | Executable by the one person with permissions; seed-thread authorship (the actual intern work) is done and reviewable in-repo; survives as onboarding doc after enablement | Discussions aren't literally live until Julian runs it | ✅ chosen |
| B. Commit `.github/DISCUSSION_TEMPLATE/` category forms only | Repo-side config GitHub natively reads | Pure git artifact | Templates only structure *new* posts in *existing* categories — they can't enable Discussions, create categories, or seed threads; solves the smallest 10% of the deliverable | rejected (noted in the guide as a follow-on once categories exist) |
| C. Enable + seed live now via `gh api` GraphQL | Do it, don't document it | Deliverable literally done | Requires admin permission Nolan doesn't have; an outward-facing org-repo action taken without the maintainer pressing the button — wrong on process even if credentials allowed it | rejected |

Option A wins because the deliverable's real content — category design, seed threads, moderation policy — is authorship, and authorship is committable. The only part that isn't (clicking Enable) is precisely the part that belongs to Julian anyway.

### Deliverable 2 — shape of PUBLISHING.md

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Dual-path runbook: local dry-run + manual publish, CI workflow for provenance | Documents what's actually possible where | Honest about the local-provenance impossibility; Julian can choose manual-now/CI-later without re-research; includes the workflow YAML so the CI path is concrete | Longer doc; describes a workflow file that isn't committed yet | ✅ chosen |
| B. Local-only publish runbook | Simplest reading of the STARTER | Short | "Publish procedure with provenance enabled" is **unsatisfiable locally** — the doc would either omit provenance or lie about where it works | rejected |
| C. Commit a publish-on-tag GitHub Actions workflow now | Automate first, document second | Provenance for free on every release | Touches org security posture (trusted publishing / token strategy is Julian's call); an untested publish workflow sitting armed in `.github/workflows/` is a footgun before the first manual publish has ever succeeded | rejected (the doc includes the YAML as the recommended follow-on) |

### Deliverable 3 — notebook topic and worked-example vehicle

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. RFF (as scoped), worked example as a permanent vitest suite under `tests/capstones/nolan-infrastructure/` | Derive + validate the existing `rff.ts` | `rff.ts` already public API so "no toy reimplementations" is free; complements the L06 Nyström lesson instead of duplicating it; suite joins `npm test` so the notebook's numbers stay verified; matches the capstone code convention for test placement | Suite adds ~1–2 min to `npm test` (bounded by pinning N and D grids) | ✅ chosen |
| B. One of the STARTER's sanctioned alternatives (KRR from scratch / kernel benchmark / Nyström deep-dive) | Swap topics | KRR-from-scratch is arguably more foundational | No reason to swap: the RFF code exists, the Nyström comparison is reachable through the same `KernelELM` API, and alternatives require notifying Julian first (STARTER § alternatives) for zero gained leverage | rejected |
| C. Worked example as a browser demo (like `examples/nolan-test/`) | Interactive boundary visualization | Prettier decision boundaries | The notebook needs *numbers in a document*, not interactivity; browser demos can't join `npm test`; benchmark timings in a browser tab are noisier and less reproducible than Node | rejected (ASCII boundary renders in-notebook instead; a browser visualizer is a documented follow-on) |
| D. Throwaway harness, numbers pasted then script deleted (IMPL-0004 pattern) | Measure once, keep only prose | Zero permanent test-time cost | The acceptance bar is a **runnable** worked example — deleting the runner fails the contract; IMPL-0004's harnesses validated code that *stayed* in a demo, here the runner *is* the artifact | rejected |

## 4. Consequences

- **Positive:** all three deliverables become reviewable repo artifacts this week, leaving W9–W10 for Julian's cold-read of PUBLISHING.md, the Discussions enablement, and presentation prep; the notebook's every number is regenerable by one command (`npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`); the publish runbook removes the actual blocker (nobody has written down how to safely publish v4.0.0) rather than a proxy for it.
- **Negative / cost:** `npm test` gets slower by the worked-example suite (bounded, but real — and it sits inside the `prepublishOnly` gate); PUBLISHING.md documents a CI workflow that doesn't exist yet, which risks drift if the eventual workflow diverges from the documented YAML; DISCUSSIONS-GUIDE.md goes stale the day Discussions go live (mitigated: its seed content and moderation policy migrate into the live pinned post, and the guide says so).
- **Neutral / follow-on:** Julian's dry-run rehearsal and sign-off remain open checklist items on the STARTER (deferred by design); `presentation.md` is a separate later artifact; `.github/DISCUSSION_TEMPLATE/` forms become worthwhile only after categories exist.
- **Risks & mitigations:** the exact-KernelELM scaling benchmark is the slowest test — N is capped at 2000 and the assertion is on accuracy, not time, so CI-speed variance can't flake it. RFF results vary with the random draw — mitigated by seeding `buildRFF`'s `rng` parameter and asserting bounds with comfortable margins. npm's 2FA/provenance/trusted-publishing surface changes frequently — PUBLISHING.md links the authoritative npm docs at each step and dates its own claims.

## 5. Invariants / Guardrails

- The worked example imports **only** public-API code (`buildRFF`, `mapRFF`, `ridgeSolvePro`, `KernelELM`, `Matrix` from `src/index`) — reimplementing any library math in the suite or the notebook fails the capstone's own acceptance bar.
- Every quantitative claim in NB-005 traces to output printed by the committed suite under fixed seeds — no hand-edited or "remembered" numbers.
- The RBF bandwidth correspondence `γ = 1/(2σ²)` holds across every cross-model comparison in the suite and the notebook.
- All suite assertions are qualitative-with-margin (accuracy floors/ceilings, monotone error decrease), never wall-clock thresholds — timings are printed for the notebook but must not gate CI.
- Nothing in this work executes `npm publish` (dry-run only) or mutates GitHub org/repo settings — those are Julian-gated actions the artifacts *prepare*.
- The suite must leave the full `npm test` run green; it extends the gate it lives inside, it doesn't get excluded from it.

## 6. Validation

- **Hand-derived check (normalization equivalence):** for any x, the raw RFF vector has ‖z‖² = Σₖ(cos²(wₖᵀx+bₖ) + sin²(wₖᵀx+bₖ)) = D exactly, so `mapRFF`'s L2-normalize (`rff.ts:30-32`) equals the textbook √(1/D) scaling — the suite asserts ‖z_raw‖² = D to machine precision and NB-005 walks the identity.
- **Hand-derived check (unbiasedness):** z(x)ᵀz(y) = (1/D)Σₖ cos(wₖᵀ(x−y)) by the angle-difference identity; its expectation under `W ~ N(0, σ⁻²I)` is exp(−‖x−y‖²/(2σ²)) — verified empirically by the approximation-error table converging toward 0 as D grows, at roughly the 1/√D Monte-Carlo rate.
- **Positive/negative controls on spirals:** plain linear ridge must fail (≈ chance, the negative control proving the dataset is genuinely non-linear); RFF+linear and exact KernelELM must both exceed 90% (positive controls); the suite asserts all three.
- **Acceptance-bar trace:** each STARTER checkbox maps to an artifact — Discussions boxes → DISCUSSIONS-GUIDE.md sections; PUBLISHING.md boxes → the doc + the deferred Julian rehearsal; NB-005 boxes → the notebook + suite. IMPL-0006 §7 carries the full mapping.
- **Suite green:** `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` passes, and a full `npm test` run stays green with the suite included.

## 7. Sign-off Checklist

- [x] ADR reviewed
- [x] IMPL plan written and linked
- [x] Tests / guardrails in place (worked-example suite committed and green)
- [x] Docs updated (DISCUSSIONS-GUIDE.md, docs/PUBLISHING.md, NB-005, index tables)
- [x] Branch correct for the work
- [ ] Julian: PUBLISHING.md cold-read + dry-run rehearsal (deferred by design)
- [ ] Julian: Discussions enabled + seeded from the guide (deferred by design)

---

## See also

- [ADR-0003](./ADR-0003-summer-2026-curriculum-structure.md) — the curriculum decision that created this capstone lane.
- [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — the execution plan for this decision.
- [`examples/capstones/nolan-infrastructure/STARTER.md`](../../examples/capstones/nolan-infrastructure/STARTER.md) — the scoping contract.
- [NB-005](../research-notebooks/NB-005-random-fourier-features.md) — the research-notebook deliverable.
- `src/pro/math/rff.ts`, `src/pro/math/krr.ts`, `src/core/KernelELM.ts` — the library surface the notebook derives and validates.
