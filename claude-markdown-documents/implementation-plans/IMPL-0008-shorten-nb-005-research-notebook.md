# Implementation Plan — Shorten NB-005 (Random Fourier Features) research notebook

- **Date:** 2026-07-21
- **Author:** Nolan Moore
- **Branch:** `Simple-Prediction`
- **Related ADR:** [ADR-0008](../ADRs/ADR-0008-shorten-nb-005-research-notebook.md)
- **Related docs / bugs:** [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](./IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) (the invariants this edit must not violate); [NB-005](../research-notebooks/NB-005-random-fourier-features.md) (the file being edited)

---

## 1. Goal

Execute ADR-0008 against the actual file: delete Appendix A's 387-line code dump and replace it with a short pointer to the already-canonical test file, delete all five Mermaid diagrams, delete all four ASCII-art blocks (with the two small prose adjustments ADR-0008 §2(c) names so the surrounding narrative still reads cleanly), and — as a separate, opt-in decision — apply as much of ADR-0008 §2(d)'s itemized further-shortening list as is wanted. Done means: NB-005 lands at approximately 440–501 lines (down from 1033), every relative link and code fence in the file is still balanced, the linked worked-example suite still runs and prints every number the notebook cites, and the five things ADR-0008 explicitly protects — the Bochner derivation (§2.3), the Monte-Carlo/factoring derivation (§3.1–§3.2), all five measured tables, and the References list — are byte-identical to their pre-edit state.

## 2. Scope

- **In scope:**
  - Deleting the Appendix A fenced code block (current lines 637–1023) and replacing the section with the ~6-line pointer from ADR-0008 §2(a).
  - Deleting all five Mermaid diagrams (current lines 72–80, 167–175, 268–281, 385–400, 580–590) with no compensating prose rewrite (ADR-0008 §6 already confirmed each is redundant with its adjacent paragraph).
  - Deleting the two-spirals scatter plot and all three decision-boundary ASCII renders (current lines 357–375, 441–465, 469–493, 497–521), plus the two named prose adjustments in §4.1 and §4.2 (ADR-0008 §2(c)).
  - Re-measuring line count and re-running the link/fence checks after (a)–(c) land.
  - Deciding, as a distinct step, whether to apply some or all of ADR-0008 §2(d)'s five itemized further cuts (§1.2, §3.3, §4.3, §6, §0), each individually small and reversible.
  - Updating this repo's index: `claude-markdown-documents/README.md`'s ADR-0008 row (currently "— (not yet written)" in the Plan column) to link this file.
- **Out of scope (explicitly):**
  - Creating any new file for Appendix A's code — ADR-0008 rejected that (Option B); the canonical file already exists and is only linked, not copied.
  - Restoring any Mermaid diagram or ASCII render — both documented Option-B fallbacks (one diagram, one boundary render) stay dormant unless a reviewer asks for them after seeing the fully-cut version.
  - Touching `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` in any way — the suite, its seeds, and its printed numbers are untouched; this plan only changes how the notebook *presents* them.
  - Touching ADR-0006 / IMPL-0006 or re-deriving any math — this is a presentation-layer edit, not a content edit.
  - Adding a `## Revisions` section to NB-005 for this baseline cut (ADR-0008 §5 reserves that for if/when an Option-B fallback is exercised *later*, not for this plan's own execution).
- **Assumptions / preconditions:**
  - ADR-0008 is accepted as written; this plan executes it as-is, including its explicit line-range measurements (verified 2026-07-21 against the 1033-line file) and its protected-content list.
  - The worked-example suite is currently green (confirmed when NB-005 was first authored under ADR-0006); this plan doesn't re-verify suite *correctness*, only that the notebook's link to it still resolves and the run command still matches.

## 3. Affected Areas

| Area | File(s) | Change |
|---|---|---|
| Research notebook | `claude-markdown-documents/research-notebooks/NB-005-random-fourier-features.md` | Delete Appendix A code (→ pointer), delete 5 Mermaid diagrams, delete 4 ASCII blocks + 2 prose adjustments, optionally apply §2(d)'s further cuts |
| Decision record | `claude-markdown-documents/ADRs/ADR-0008-shorten-nb-005-research-notebook.md` | Sign-off checklist items ticked as steps below complete (no content change) |
| Index | `claude-markdown-documents/README.md` | ADR-0008 row's Plan column updated from "not yet written" to link this file |
| Untouched (verify, don't edit) | `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` | Confirm it's unchanged and still green; the notebook's pointer must name this exact path |

## 4. Approach

Land the three named cuts (Appendix A, Mermaid, ASCII) as one pass, in that order, because each is independent and none depends on the others being done first — but doing Appendix A first means every subsequent line-number reference in this plan (and any diff review) is working against a shorter, more legible file. Treat §2(d)'s further-shortening list as a distinct, later decision rather than folding it into the same edit — ADR-0008 frames it as opt-in and individually estimated, and reviewing it separately makes it easy to stop at "cuts (a)–(c) only" (≈501 lines) if that's judged enough, without re-touching already-reviewed diffs. The one place real care is needed is verifying, after every deletion, that no leftover sentence points at something that no longer exists ("as shown in the diagram above," "as the suite prints it" next to a now-absent image) — ADR-0008 §6 already pre-checked this for all nine deleted blocks, so this plan's verification steps are confirmations of that pre-check, not fresh analysis.

## 5. Step-by-Step Plan

1. **Baseline snapshot** — confirm the file is still at ADR-0008's measured state before editing: `wc -l` on NB-005 reads 1033; the five Mermaid fences, the four ASCII fences, and Appendix A's line range match ADR-0008 §1's citations exactly. Verification: numbers match; if they don't (someone else edited the file since), re-run ADR-0008's line-range analysis before proceeding rather than editing against stale line numbers.
2. **Delete Appendix A, add the pointer** — remove the `## Appendix A — the complete worked-example suite` section's 387-line ` ```ts ` block and replace the section with ADR-0008 §2(a)'s ~6-line pointer (link to `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`, the one-line `npx vitest run …` command). Verification: the link resolves (relative path check); the quoted run command is character-identical to the one used everywhere else in the notebook (§0, the file's own header comment) so there's exactly one "true" run command in the document.
3. **Delete the five Mermaid diagrams** — remove each ` ```mermaid ` fenced block in place (§1.1, §2.2, §3.2, §4.1, §5), touching nothing else on the line before or after. Verification: `grep -c '^```mermaid'` returns 0; re-read the paragraph immediately surrounding each deletion point to confirm it still reads as a complete thought with no diagram present (this is the confirmation of ADR-0008 §6's redundancy check, not a fresh judgment call).
4. **Delete the two-spirals scatter plot** (§4.1) — remove the ASCII block and change the one preceding sentence ("The training data, as the suite prints it...") to plain prose describing the dataset, per ADR-0008 §2(c)'s first named adjustment. Verification: §4.1 still states the dataset's noise/radius/turn-count parameters (already present in the paragraph above the old scatter plot) without referring to an image.
5. **Delete the three decision-boundary renders** (§4.2) — remove all three ASCII blocks and their three bolded sub-headers, collapsing that content into the existing summary paragraph ("The negative control... proves the dataset genuinely requires the kernel...") per ADR-0008 §2(c)'s second named adjustment. Verification: §4.2 still states the three models' accuracy numbers (already in the showdown table, untouched) and the negative/positive-control logic, without referencing "the boundaries above."
6. **Re-measure and re-check** — run `wc -l` (expect ≈501 lines) and the relative-link + fence-balance check (the same node one-liner used when NB-005 was first authored) across the edited file. Verification: line count in the expected range; zero broken links; even fence count.
7. **Decide on §2(d)'s further-shortening list** — review the five itemized cuts (§1.2 growth-paragraph compression, §3.3 a/b/c tightening, §4.3 "two readings" consolidation, §6 bullet trimming, §0 notation/background condensing) and apply as many as wanted, one at a time, each independently verifiable. Verification per item: the specific section reads tighter with no factual content dropped; §2.3, §3.1–§3.2, all five tables, and References remain byte-identical (diff against the post-step-6 version to confirm nothing outside the named section moved).
8. **Acceptance-bar re-read** — read the fully edited notebook once as "a reader with a calculus background but no prior kernel-methods exposure" (the STARTER's own bar, restated in ADR-0008 §6). Confirm no sentence says "as shown above/below" without something above/below it, and the derivation in §2–§3 still stands alone. Verification: pass/fail judgment call, recorded in this plan's Done Checklist below.
9. **Runnability check** — `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` still passes (the file itself is untouched by this plan, so this is a confidence check, not an expected-to-fail test). Verification: green run; output still matches every number quoted in the now-shorter notebook.
10. **Update the index** — change `claude-markdown-documents/README.md`'s ADR-0008 row, Plan column, from "— (not yet written)" to a link to this file. Verification: link resolves.

## 6. Data / Migration

None. This is a documentation-only edit to a single markdown file — no schema, no cache, no persisted state, no code path touched. Rollback is a plain `git revert` of the commit containing this edit; the pre-edit 1033-line version remains fully recoverable from git history regardless, so there is no risk of unrecoverable loss even if the shortened version is later judged too aggressive.

## 7. Testing & Verification

- **Unit / spec:** none — no source code is touched. The worked-example suite's own tests are unaffected and are not re-authored by this plan.
- **Integration / E2E:** the suite run in step 9 is the only "test" this plan depends on, and it's a confirmation that the plan didn't accidentally touch the linked file, not new coverage.
- **Manual / demo:** steps 6 and 8 (automated link/fence check, then a manual acceptance-bar read-through) are the actual verification surface for a docs-only change like this.
- **Acceptance criteria:**
  - Final line count in the 440–501 range (exact value depends on how much of step 7 is taken).
  - Zero broken relative links, zero unmatched code fences.
  - `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` green.
  - §2.3, §3.1–§3.2, all five measured tables, and References are byte-identical to the pre-edit file (diffable, not just "looks the same").
  - No orphaned "as shown above" (or equivalent) references to a deleted diagram or render.

## 8. Rollout / Deploy

None — this is a repo documentation change with no runtime surface. It merges via the normal PR flow (and, per the STARTER's "≥5 PRs" capstone bar, can reasonably be its own small PR rather than folded into unrelated work). No feature flags, no staged rollout, no deploy step.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| A step-7 prose-tightening edit accidentally nicks a protected section (derivation, a table row, References) | Low–Med | High (violates ADR-0006/ADR-0008 invariants) | Diff the four protected regions against the post-step-6 version before committing (step 7's per-item verification); revert the single offending hunk if found |
| A deleted diagram/render leaves a dangling prose reference ("as shown above") | Med | Low–Med (confusing but not factually wrong) | Step 8's dedicated acceptance-bar re-read is designed to catch exactly this before commit |
| The new Appendix-A pointer's relative link is mistyped | Low | Low | Automated link-check in step 6 catches this immediately; same script already used twice earlier in this notebook's history |
| A reviewer wants a partial restore (one Mermaid diagram, one boundary render) after seeing the cut version | Med | Low | Already a documented, scoped fallback (ADR-0008 §3 Option B for both); re-adding is a small diff, logged in a NB-005 `## Revisions` section per ADR-0008 §5 |
| Line count lands outside the 440–501 estimate | Low | Low | The estimate is a range, not a hard target; ADR-0008 itself frames step 7 as opt-in, so landing anywhere in or near the range with all invariants intact satisfies the goal |

## 10. Open Questions

- [ ] Apply all five of ADR-0008 §2(d)'s further cuts now (step 7), or land steps 2–6 only (≈501 lines) and treat further trimming as a later, separate pass?
- [ ] Does the reviewer want either documented Option-B fallback (keep the §3.2 RFF-pipeline Mermaid diagram; keep the RFF+ridge boundary render) applied preemptively, or only if requested after reviewing the fully-cut version?

## 11. Done Checklist

- [x] All steps complete and verified (steps 1–6 and 8–9; step 7's §2(d) further-shortening left deferred/opt-in per Open Questions above)
- [x] Tests green (`npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` — 7/7; full `npm test` — 19 files, 122 tests)
- [x] Docs / ADR updated (ADR-0008's sign-off checklist ticked and its Revisions section records the measured result; `claude-markdown-documents/README.md` ADR-0008 row's Plan column already links this file)
- [ ] Deployed / merged to correct branch (edit is committed to the working tree on `Simple-Prediction`; not yet committed/pushed — pending explicit go-ahead)
- [ ] Sign-off (reviewer pass on the shortened NB-005 still pending)

---

## See also

- [ADR-0008](../ADRs/ADR-0008-shorten-nb-005-research-notebook.md) — the decision this plan executes.
- [ADR-0006](../ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](./IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — the original decision and plan whose invariants this edit must preserve.
- [NB-005](../research-notebooks/NB-005-random-fourier-features.md) — the file being edited.
- [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) — the canonical worked-example source the new Appendix A pointer links to.
