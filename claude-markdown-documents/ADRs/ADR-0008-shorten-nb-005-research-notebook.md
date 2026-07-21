# ADR-0008 — Shortening NB-005 (Random Fourier Features): cut Appendix A, drop Mermaid + ASCII renders, tighten prose

- **Status:** Accepted — cuts (a)–(c) executed 2026-07-21; §2(d) further-shortening left as an optional, not-yet-applied follow-on (see Revisions)
- **Date:** 2026-07-21
- **Author:** Nolan Moore
- **Branch:** `Simple-Prediction`
- **Supersedes / Superseded by:** —
- **Related:** [ADR-0006](./ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) (the decision that created NB-005 and the invariants this ADR must not violate); [IMPL-0008](../implementation-plans/IMPL-0008-shorten-nb-005-research-notebook.md) (this decision's execution plan, now executed); [NB-005](../research-notebooks/NB-005-random-fourier-features.md) (the document shortened).

---

## 1. Context

NB-005 shipped at 930 lines (within the STARTER's suggested "~1000–1500 lines" band), then grew to **1033 lines** in a follow-up pass that added GitHub-native LaTeX math and five Mermaid diagrams. The doc is now being asked to get materially shorter — a fresh editorial preference, not a response to any violated constraint (the STARTER's line-count guidance is a suggested band, not a ceiling this ADR is correcting). Three concrete cuts were named directly: remove the spiral ASCII renders, remove the Mermaid charts, and move Appendix A's code out to a separate file. A fourth, open-ended ask — look for further line-count reduction generally — needs its own scoped decision so it doesn't turn into unbounded, undirected trimming.

- **Background / current behavior (measured directly from the file, 2026-07-21):**
  - Total length: **1033 lines**.
  - **Appendix A** (`## Appendix A — the complete worked-example suite`) is a single ` ```ts ` fence spanning **lines 637–1023 (387 lines)** — by far the single largest block in the document, at **37% of the total file**. Its own header already states the code is "reproduced verbatim so the notebook is self-contained offline" and that the *canonical* copy is the committed file `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` — i.e., **the "separate file" the appendix should move to already exists and is already the source of truth.** The appendix is a deliberate duplicate, not unique content.
  - **Five Mermaid diagrams** total **59 lines** of fenced content (lines 72–80, 167–175, 268–281, 385–400, 580–590), added in the same pass that added the LaTeX. None of them carry information the surrounding prose doesn't already state — they were an illustrative addition on top of a notebook that was already complete without them.
  - **Four ASCII-art blocks** total **94 lines**: the two-spirals training-data scatter plot (lines 357–375, 19 lines) and three decision-boundary renders — linear ridge, RFF+ridge, exact KernelELM (lines 441–465, 469–493, 497–521; 25 lines each, 75 lines total). These are real, captured `console.log` output from the committed suite (not hand-drawn figures), but they are the most visually heavy, least information-dense content per line in the document.
  - By contrast, the **five measured numeric-result tables** (scaling-vs-$N$, approx-error-vs-$D$, the showdown, accuracy-vs-$D$, RFF-vs-Nyström — 9+9+8+11+8 = **45 lines total**) are the empirical backbone ADR-0006 §6 requires ("every quantitative claim in NB-005 traces to output printed by the committed suite") and are **not** in scope for removal — they are the notebook's evidence, not its decoration.
  - The three small inline `` ```ts `` snippets outside Appendix A (the `rff.ts` derivation-mapping excerpt in §3.3, 29 lines; the two "shared fit" usage snippets in §4.1, 8 + 12 = 20 lines) are also **not** the appendix — they're short, directly tied to the derivation and architecture narrative one paragraph above each, and stay.
- **Constraint(s):**
  - ADR-0006's acceptance bar still applies: the worked example must remain **runnable** and the derivation must remain followable by "a reader with a calculus background but no prior kernel-methods exposure" (STARTER § Deliverable 3 acceptance). Cutting Appendix A must not make the example less runnable — it already isn't the runnable copy, the linked test file is.
  - ADR-0006 §5's invariant that "every quantitative claim in NB-005 traces to output printed by the committed suite" must survive the edit — none of the five measured tables are candidates for removal.
  - STARTER § Deliverable 3 explicitly asks the notebook to "walk the derivation" of Bochner's theorem and the RFF construction — §2.3 (the completing-the-square derivation) and §3.2 (the factoring-trick derivation) are the doc's actual required content, not filler, and are **not** candidates for cutting.
- **Trigger for this decision:** the LaTeX/Mermaid pass grew the file by ~100 lines while adding comparatively little new information (the Mermaid diagrams restate prose; Appendix A was already a duplicate); the current ask is to reverse that growth and go further, prioritizing a shorter, more skimmable review artifact over exhaustive offline self-containment.

## 2. Decision

> We will delete Appendix A outright (not move it to a new file — the canonical file already exists) and replace it with a short pointer, delete all five Mermaid diagrams, delete all four ASCII-art blocks (replacing them with the one or two sentences of prose needed to keep the surrounding narrative coherent), and apply a light editorial tightening pass to the remaining prose — while leaving the derivation math (§2.3, §3.2), all five measured tables, and the References/Appendix code's *link* fully intact.

### Details

**(a) Appendix A → deleted, not moved.**

There is no need to create a new file: `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` already is the "separate file," and Appendix A's own header already says so. The fix is to delete the 387-line fenced block and replace the whole "Appendix A" section with a ~6-line pointer:

```markdown
## Appendix A — where the worked-example code lives

The runnable suite is not reproduced here — it's committed at
[`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts)
and is the canonical source for every number and table in this notebook. Run it with:

    npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts
```

Net effect: **−387 lines** for the code, **+~6 lines** for the pointer → **≈ −381 lines**. This does not violate ADR-0006's "runnable worked example" bar — the example was never *run from the appendix*; it's run from the linked file, unchanged.

**(b) Mermaid diagrams → deleted, no replacement needed.**

All five diagrams (§1.1 kernel-trick flow, §2.2 Bochner correspondence, §3.2 RFF pipeline, §4.1 three-model architecture, §5 RFF-vs-Nyström decision tree) are removed in place. Each sat directly after prose that already states the same content in words — e.g. the §4.1 diagram restates the three-model table immediately above it. No sentence needs rewriting to compensate; the fenced blocks are simply deleted. Net effect: **−59 lines**, zero information loss (verified per-diagram in §6 below).

**(c) ASCII-art blocks → deleted, prose lightly adjusted.**

The two-spirals scatter plot (§4.1) and the three decision-boundary renders (§4.2) are removed. Two small prose adjustments keep the section coherent without them:

- §4.1's "The training data, as the suite prints it..." sentence changes to a plain description (e.g. "The training data is two interleaved spiral arms — see the dataset parameters below" pointing at the existing prose paragraph that already describes noise/radius/turns), since there's no longer an image for "as the suite prints it" to refer to.
- §4.2's boundary-by-boundary walkthrough (the three bolded sub-headers "Linear ridge — a straight line...", "RFF + ridge, D=200...", "KernelELM exact RBF...") collapses into the existing one-paragraph summary that already precedes the renders ("The negative control... proves the dataset genuinely requires the kernel..."), since that paragraph's claims don't depend on the reader having just seen the pictures.

Net effect: **−94 lines** of art, **+0 to +3 lines** of adjusted transition prose → **≈ −92 lines**. This is the one cut with a genuine (if modest) pedagogical cost — see Consequences.

**(d) Further shortening — a scoped, opt-in list, not unbounded trimming.**

Rather than open-ended tightening, here is the concrete, line-item list of further cuts, each estimated, so the editor can take as many or as few as wanted:

| Section | Cut | Est. savings |
|---|---|---|
| §1.2 | The exact-KELM growth paragraph restates the $\times2.0/\times6.0/\times6.9$ numbers the table two lines above it already shows; compress to 2 sentences | ~8 lines |
| §3.3 (a)/(b)/(c) | Tighten the three "hard look" write-ups — same three insights, fewer words each | ~15–20 lines |
| §4.3 | "Two readings of this table" bullets → one tighter paragraph | ~5 lines |
| §6 | Limitations/surprises/open-questions bullets trimmed of restated cross-reference numbers already given earlier | ~10–15 lines |
| §0 | Notation table + assumed-background paragraph condensed | ~5–8 lines |

Total further savings if all taken: **~45–65 lines**. **Explicitly out of scope for cutting, regardless of how far (d) is pushed:** §2.3 (Bochner derivation), §3.1–3.2 (Monte-Carlo + factoring derivation), all five measured tables, and the References list — these are the notebook's required content per the STARTER, not padding.

**Net result.** $1033 - 381 - 59 - 92 = 501$ lines from cuts (a)–(c) alone (a **51% reduction**), before any of (d)'s optional further trimming. Applying all of (d) lands around **440–455 lines**. Either endpoint keeps 100% of the derivation math, 100% of the measured evidence, and the full reference list — the reduction comes entirely from duplicated code, restated-in-prose diagrams, and rendered-not-narrated art.

## 3. Options Considered

### Appendix A

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Delete, replace with a link to the existing test file | Zero new files; the canonical source already exists | Simplest; matches ADR-0006's own "the file wins if they disagree" framing — the appendix was always the *lesser* copy | Notebook is no longer self-contained offline (needs the repo checked out to read the code) | ✅ chosen |
| B. Move verbatim into a brand-new file (e.g. `NB-005-appendix-source.md`) | Keeps a markdown-readable copy near the notebook | Preserves "offline reading" | Creates a *second* duplicate of code that already has one committed, canonical home — solves nothing the test file doesn't already solve, just relocates the duplication problem | rejected |
| C. Keep Appendix A as-is | No editing risk | Zero line-count improvement on the single largest block in the file | Directly contradicts the explicit ask | rejected |

### Mermaid diagrams

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Delete all five | Maximum line-count win, zero unique information lost | Simple, fast, matches the explicit ask | Loses a visual on-ramp for readers who process pipelines/decision-trees better as diagrams than prose | ✅ chosen |
| B. Keep only the RFF-pipeline diagram (§3.2) — arguably the single densest one, encoding a 5-step process | Retains the one diagram with the most structure-per-line | Some visual aid survives | Still leaves four diagrams behind that restate adjacent prose; partial credit against an explicit "remove the mermaid charts" ask | rejected (noted as a fallback if reviewers want one diagram back) |

### ASCII-art blocks

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Delete all four (scatter + 3 boundaries) | Maximum savings (94 lines), matches "remove the spiral graphs" as stated (plural, unqualified) | Simple | Loses the single most visceral illustration of "linear fails, RFF and exact both succeed, here's what that looks like" | ✅ chosen |
| B. Keep one representative boundary render (e.g. RFF+ridge, the notebook's actual subject) | Retains some visual payoff at ~⅓ the line cost | A middle ground if full removal feels too lossy on review | Doesn't fully satisfy the explicit ask; three renders exist specifically to make the comparison, keeping one undercuts the "same solver, different features" point | rejected (documented fallback) |
| C. Keep all four, as now | Zero editing risk | No line-count improvement | Contradicts the explicit ask | rejected |

### Scope of "further shortening"

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Itemized, estimated list; derivation/tables/references explicitly protected | Editor can pick and choose; core content can't accidentally get cut in a broad trimming pass | Requires this ADR to enumerate items rather than give a vague mandate | Slightly more upfront analysis | ✅ chosen |
| B. Open-ended "tighten prose throughout" | Maximum flexibility | No guardrail against cutting the derivation itself in pursuit of a smaller number; unbounded scope invites scope creep | rejected |

## 4. Consequences

- **Positive:** NB-005 drops from 1033 to roughly 440–501 lines (a 51–57% reduction) with **zero loss** to the parts ADR-0006 actually gates on — the derivation, the measured tables, and the runnable example (still one click away via the pointer link). Appendix A's duplication risk (the "if these ever disagree, the file wins" caveat) disappears entirely once there's nothing left to disagree with.
- **Negative / cost:** the notebook is no longer readable fully offline without the repo checked out (Appendix A's original, explicit purpose); the decision-boundary renders — the most concrete "look, here's the shape it learned" evidence — are gone from the doc itself, leaving only the numeric showdown table to carry that argument; the Mermaid diagrams' pipeline/decision-tree visualizations are gone, leaving prose as the sole explanatory mode for those structures.
- **Neutral / follow-on:** if a reviewer wants some visual restored, Option B under both Mermaid and ASCII-art (single diagram, single boundary render) is a documented, cheap partial-restore rather than a redesign. The already-parked "browser visualizer of the $D$ sweep" (NB-005 §6 open questions, per ADR-0006 §3 Option C) remains the better long-term home for interactive boundary visualization than static text in a markdown file.
- **Risks & mitigations:** cutting prose in (d) could, if done carelessly, nick a sentence the derivation depends on — mitigated by the explicit protected list (§2.3, §3.1–3.2, all five tables, References) and by doing (d) as a distinct, reviewable pass after (a)–(c) land, not interleaved with them.

## 5. Invariants / Guardrails

- Appendix A's *link* to `tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` must remain — the worked example stays runnable by that one command regardless of what the notebook prose says.
- None of the five measured tables (scaling-vs-$N$, error-vs-$D$, showdown, accuracy-vs-$D$, RFF-vs-Nyström) may be cut or reduced in row count — they are the evidence, not the decoration.
- §2.3 (Bochner derivation) and §3.1–§3.2 (Monte-Carlo + factoring derivation) are not candidates for cutting under any interpretation of "shorten" — the STARTER requires the derivation to be walked, not summarized.
- The bandwidth-correspondence invariant ($\gamma = 1/(2\sigma^2)$) and every other ADR-0006 §5 invariant continue to apply unchanged — this ADR only touches presentation, not the underlying claims.
- If any Option-B fallback (one diagram, one boundary render) is exercised later, it must be noted in a `## Revisions` section on NB-005 itself, per the research-notebooks convention that living documents record substantive amendments.

## 6. Validation

- **Line-count check:** after the edit, `wc -l` on NB-005 should read approximately 440–501 lines depending on how much of (d) is taken, down from the current 1033.
- **No-information-loss check (Mermaid):** for each of the five deleted diagrams, the paragraph immediately preceding or following it must already state the same relationship in prose — spot-checked at time of writing: §1.1's diagram restates the kernel-trick paragraph; §2.2's restates the $(\star)$ derivation just shown; §3.2's restates the `buildRFF`/`mapRFF` two-step split already given in words; §4.1's restates the three-row model table directly above it; §5's restates the "Rule of thumb this table supports" paragraph directly above it. All five confirmed redundant before deletion.
- **Runnability check:** after Appendix A is replaced with the pointer, `npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts` (unchanged, since the test file itself is not touched by this ADR) must still pass and print every number the notebook cites.
- **Acceptance-bar check:** re-read the edited notebook once as "a reader with a calculus background but no prior kernel-methods exposure" (STARTER's own bar) — confirm the derivation in §2–§3 still stands alone without the removed diagrams, i.e. no sentence says "as shown in the diagram above" without a diagram above it.

## 7. Sign-off Checklist

- [x] ADR reviewed
- [x] IMPL plan written and linked ([IMPL-0008](../implementation-plans/IMPL-0008-shorten-nb-005-research-notebook.md))
- [x] Edit applied to NB-005 and line count re-measured (1033 → 480 lines; see Revisions)
- [x] Docs updated (this ADR is itself the doc; `claude-markdown-documents/README.md`'s ADR-0008 row links this IMPL)
- [x] Branch correct for the work

---

## Revisions

- **2026-07-21 — Cuts (a)–(c) executed as proposed; §2(d) deferred.** Appendix A was deleted and replaced with the ~6-line pointer exactly as drafted in §2(a); all five Mermaid diagrams were deleted per §2(b); all four ASCII-art blocks were deleted per §2(c), with the two named prose adjustments (a plain-language dataset description in §4.1, and the three boundary-render write-ups collapsed into the existing negative/positive-control paragraph in §4.2). Result: **1033 → 480 lines (a 53.5% reduction)** — within the estimated 440–501 range from cuts (a)–(c) alone, before any of §2(d)'s optional further trimming. A diff against the pre-edit file confirmed exactly 8 hunks, matching the 5 Mermaid deletions + Appendix A replacement + scatter-plot cut + boundary-renders cut, with zero changes outside those regions — §2.3, §3.1–§3.2, all five measured tables, and References are byte-identical to their pre-edit state. The linked worked-example suite (`npx vitest run tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`) was re-run post-edit: 7/7 tests pass, and every number it prints still matches what the shortened notebook quotes. A full `npm test` run (19 files, 122 tests) stayed green. §2(d)'s five itemized further cuts (§1.2, §3.3, §4.3, §6, §0 tightening — estimated ~45–65 more lines) were **not** applied; they remain a documented, opt-in follow-on per IMPL-0008's Open Questions, not part of this execution.

---

## See also

- [ADR-0006](./ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) / [IMPL-0006](../implementation-plans/IMPL-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — the decision and plan that created NB-005 and set the invariants this shortening must preserve.
- [NB-005](../research-notebooks/NB-005-random-fourier-features.md) — the document this ADR shortens.
- [`tests/capstones/nolan-infrastructure/rff-worked-example.test.ts`](../../tests/capstones/nolan-infrastructure/rff-worked-example.test.ts) — the canonical worked-example source Appendix A duplicated and will instead link to.
