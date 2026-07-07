# ADR-XXXX — <Short Decision Title>

- **Status:** Proposed | Accepted | Superseded by ADR-YYYY | Deprecated
- **Date:** YYYY-MM-DD
- **Author:** <name>
- **Branch:** <branch the work executes on>
- **Supersedes / Superseded by:** ADR-YYYY (if any)
- **Related:** IMPL plan, prior ADRs, research notebooks, bug reports

---

## 1. Context

What is the situation that forces a decision? State the problem, the constraints,
and the forces in tension. Cite code with `file:line` where a claim rests on the
codebase — do not infer. Include what is currently true and why it is inadequate.

- Background / current behavior:
- Constraint(s):
- Trigger for this decision:

## 2. Decision

The decision, stated in one or two sentences, in active voice.

> We will <do X> by <means Y> so that <outcome Z>.

### Details

Expand on the mechanism. What exactly changes, where, and how. Interfaces, data
shapes, migration steps, invariants that must hold.

## 3. Options Considered

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. <chosen> | | | | ✅ chosen |
| B. | | | | rejected |
| C. do nothing | | | | rejected |

Explain *why* the chosen option beat the runners-up — not just that it did.

## 4. Consequences

- **Positive:** what gets better.
- **Negative / cost:** what gets worse or harder; debt taken on.
- **Neutral / follow-on:** things that must change downstream as a result.
- **Risks & mitigations:** what could go wrong and how it is contained.

## 5. Invariants / Guardrails

Rules that must never be violated after this decision lands. Note any lint,
test, or CI gate that pins them (e.g. `some-contract.spec.ts`).

## 6. Validation

How we know the decision is correctly implemented: tests, benchmarks, manual
verification, acceptance criteria. Hand-derived expected values where relevant.

## 7. Sign-off Checklist

- [ ] ADR reviewed
- [ ] IMPL plan written and linked
- [ ] Tests / guardrails in place
- [ ] Docs updated
- [ ] Branch correct for the work

---

*Template. Replace all `<...>` placeholders and delete guidance text before finalizing.*
