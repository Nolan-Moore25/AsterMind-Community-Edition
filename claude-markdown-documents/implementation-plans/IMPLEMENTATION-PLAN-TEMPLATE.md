# Implementation Plan — <Feature / Change Title>

- **Date:** YYYY-MM-DD
- **Author:** <name>
- **Branch:** <branch the work executes on>
- **Related ADR:** ADR-XXXX
- **Related docs / bugs:** <links>

---

## 1. Goal

One paragraph: what we are building and the observable outcome that means "done."

## 2. Scope

- **In scope:**
- **Out of scope (explicitly):**
- **Assumptions / preconditions:**

## 3. Affected Areas

Files, modules, services, and data that this change touches. Cite `file:line`
where known. Flag anything shared or frozen that needs care.

| Area | File(s) | Change |
|---|---|---|
| | | |

## 4. Approach

Describe the strategy before the steps. Key design choices, why this order,
where the risk concentrates.

## 5. Step-by-Step Plan

Break into small, independently verifiable steps. Each step: what changes, and
how you confirm it before moving on.

1. **<Step name>** — change; verification.
2. **<Step name>** — change; verification.
3. ...

## 6. Data / Migration

Schema changes, migrations (additive where possible), backfills, rollback path.
State the migration file name and how it is applied.

## 7. Testing & Verification

- **Unit / spec:** what, expected values (hand-derived from spec, not copied from runtime).
- **Integration / E2E:**
- **Manual / demo:** exact command(s) to run.
- **Acceptance criteria:** the bar that must be met (e.g. positive + negative controls).

## 8. Rollout / Deploy

Feature flags, env gates, order of deploy, blue/green considerations, who runs it.

## 9. Risks & Rollback

| Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|
| | | | |

## 10. Open Questions

- [ ] <question needing an answer before or during implementation>

## 11. Done Checklist

- [ ] All steps complete and verified
- [ ] Tests green
- [ ] Docs / ADR updated
- [ ] Deployed / merged to correct branch
- [ ] Sign-off

---

*Template. Replace all `<...>` placeholders and delete guidance text before finalizing.*
