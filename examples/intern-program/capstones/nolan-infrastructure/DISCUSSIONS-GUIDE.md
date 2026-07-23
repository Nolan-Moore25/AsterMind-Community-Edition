# GitHub Discussions — enablement and seeding runbook

> **Capstone deliverable 1** of the [Nolan infrastructure lane](./STARTER.md).
> **Audience:** a repo admin on `AsterMindAI/AsterMind-Community-Edition` (that's Julian). Everything below is written so you can go from "Discussions doesn't exist" to "live, categorized, seeded, and moderated" in one ~15-minute sitting. All thread content is paste-ready — no authoring needed during setup.
>
> **Why this is a document and not a done thing:** enabling Discussions is a repo-**settings** action that requires admin permission; it cannot be done by committing files. The authorship half of the deliverable (category design, seed threads, moderation policy) is all here and reviewable; the click belongs to an admin. Rationale: [ADR-0006 §3](../../../claude-markdown-documents/ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md).

---

## 0. Why Discussions at all

Right now every question about AsterMind has exactly two homes: a GitHub **issue** (wrong for "how do I…?" — issues are a work queue, and closing a question feels like dismissing the asker) or a private message to Julian (doesn't scale, isn't searchable, teaches nobody else). Discussions gives questions, ideas, and demos a public, searchable, non-work-queue home:

| Surface | For | Not for |
|---|---|---|
| **Issues** | Reproducible bugs, scoped feature work someone will execute | Questions, brainstorming, demos |
| **Discussions** | Questions ("how do I…?"), open-ended ideas, showing off what you built | Anything that needs an assignee and a Done state |
| **PRs** | Code review | Design debates (start those in Discussions, link the thread from the PR) |

The summer cohort is the immediate audience (three interns asking overlapping questions), and external contributors are the long-term one.

---

## 1. Enable Discussions (admin, ~1 minute)

**UI path:** repo page → **Settings** → **General** → scroll to **Features** → check **Discussions**. A "Discussions" tab appears in the repo's top nav immediately.

**CLI path** (equivalent, needs `gh` authenticated with admin scope):

```bash
gh api -X PATCH repos/AsterMindAI/AsterMind-Community-Edition \
  -F has_discussions=true
```

**Verify:** `https://github.com/AsterMindAI/AsterMind-Community-Edition/discussions` loads instead of 404, and the **Discussions** tab is visible to a logged-out browser (one click from the repo page — that's the STARTER's reachability bar).

---

## 2. Configure categories (~3 minutes)

GitHub auto-creates default categories (Announcements, General, Ideas, Polls, Q&A, Show and tell). Edit them via **Discussions tab → pencil icon next to "Categories"** to match this plan:

| Category | Format | Description to paste | Keep/create |
|---|---|---|---|
| 📣 **Announcements** | *Announcement* (only maintainers can post) | "Releases, curriculum news, and program updates from the AsterMind team." | keep default |
| ❓ **Q&A** | *Question / Answer* (askers can mark an accepted answer) | "Ask anything about using AsterMind — setup, training, the lessons, the math. No question too basic; the lessons assume zero ML background and so does this category." | keep default |
| 💡 **Ideas** | *Open discussion* | "Feature requests and direction proposals. If it turns into scoped work, a maintainer converts it to an issue." | keep default |
| 🎨 **Show & tell** | *Open discussion* | "Built something with AsterMind? Demos, capstones, experiments — post a link and a paragraph. Small things welcome." | keep default ("Show and tell") |
| — General | — | — | **delete** (routes everything ambiguous; with Q&A + Ideas well-described it only collects miscategorized posts) |
| — Polls | — | — | **delete** (no current use; re-add when there's a real poll to run) |

That yields **4 categories** — comfortably over the STARTER's ≥3 bar, and each has a distinct format so the category choice teaches posters what kind of thread they're starting.

> The **Q&A format matters**: it's the only one with accepted answers, which is what makes the category self-serve over time (searchers see the ✔ answer first).

---

## 3. Seed threads (~10 minutes, paste-ready)

Six threads, at least one per category. Post threads 1–2 in **Announcements**, 3–4 in **Q&A**, 5 in **Ideas**, 6 in **Show & tell**. **Pin thread 1** (⋯ menu → Pin discussion) — it carries the moderation policy, which satisfies the STARTER's "moderation policy in a pinned post" option (the alternative, a CONTRIBUTING.md section, can come later; see §6).

For Q&A seeds: post the question, then immediately post the answer as a comment and **mark it as the accepted answer** — a Q&A category where the seed questions are visibly *answered* teaches visitors the category works.

---

### Thread 1 — 📣 Announcements — **pin this one**

**Title:** `Welcome to AsterMind Discussions 👋 (start here)`

```markdown
Welcome! This is the community home for **AsterMind Community Edition** — a tiny,
on-device machine-learning library for the web: train real classifiers in the
browser in milliseconds, no GPU, no server, no Python.

## Where to post

- ❓ **Q&A** — any "how do I…?" or "why does…?" question. Zero-ML-background
  questions are explicitly welcome; our lesson series assumes none either.
- 💡 **Ideas** — feature requests, API suggestions, curriculum wishes.
- 🎨 **Show & tell** — you built a thing! Show us. Demos, class projects,
  capstones, weird experiments.
- 📣 **Announcements** — releases and program news (maintainer posts only).

**Bugs and reproducible defects still go to
[Issues](https://github.com/AsterMindAI/AsterMind-Community-Edition/issues)** —
if you're not sure whether something is a bug or a misunderstanding, ask in Q&A
first and we'll convert it to an issue if it turns out to be real.

## Good first stops

- [README quick start](https://github.com/AsterMindAI/AsterMind-Community-Edition#readme)
- The lesson series under `examples/lessons/` (L00 assumes nothing and runs in
  your browser: `npm run dev:lesson:00`)
- [CONTRIBUTING.md](https://github.com/AsterMindAI/AsterMind-Community-Edition/blob/main/CONTRIBUTING.md)
  if you want to send a PR

## House rules (the moderation policy)

1. **Be kind, be specific.** Critique code and ideas, never people. Assume the
   asker is missing context, not intelligence.
2. **No question is too basic.** This library exists partly as a teaching
   vehicle; "what's a classifier?" is on-topic.
3. **Show your inputs.** For Q&A: what you ran, what you expected, what
   happened instead. Code blocks beat screenshots; minimal repros beat pasted
   walls of code.
4. **Search first, link generously.** Duplicate questions get answered with a
   link to the earlier thread — that's a feature, not a brush-off.
5. **No spam, no self-promo without substance.** Show & tell posts should show
   the thing, not just link a product page. Crypto/SEO/link-farm posts are
   removed on sight.
6. **Security reports are not Discussions.** Suspected vulnerabilities go
   privately to the maintainer (see repo README) — never a public thread.
7. **Maintainers may edit titles/categories** to keep things findable, and
   will convert Ideas threads into Issues when they become scoped work (we'll
   always link back).

Moderation actions escalate gently: friendly nudge → edit/move → lock → remove
+ block for repeat abuse. If you think a call was wrong, comment on the thread
or email the maintainer — we'd rather fix it than defend it.

**Response expectations:** this is a small team. We triage weekly (usually
Fridays); unanswered Q&A older than a week gets a maintainer reply, even if
that reply is "don't know yet."
```

---

### Thread 2 — 📣 Announcements

**Title:** `v4.0.0 — what changed and what's next`

```markdown
AsterMind Community Edition **v4.0.0** is tagged. Headlines:

- **The big cleanup.** The 21 speculative ELM variants are gone; what remains
  is real, tested code: `ELM`, `KernelELM` (exact + Nyström), `OnlineELM`,
  `DeepELM`, the task classes, retrieval/reranking, and OmegaSynth.
- **A lesson curriculum.** `examples/lessons/L00`–`L06` teach the library from
  "what's a neuron" to kernels & Nyström, each lesson a runnable slide deck
  (`npm run dev:lesson:00` …).
- **Docs that match the code.** Every README claim is checked against the
  actual API.

**What's next:** first npm publish of v4.0.0 (watch this space), and the
summer capstone demos will land in Show & tell as they ship.

Questions about anything in v4 → open a thread in ❓ Q&A.
```

---

### Thread 3 — ❓ Q&A (self-answer, then mark accepted)

**Title:** `What ML knowledge do I need to use this library?`

**Question body:**

```markdown
I'm a web developer with no machine-learning background. The README says
AsterMind trains classifiers in the browser — do I need to know the math
(linear algebra? calculus?) before I can use it, and if not, where should
I actually start?
```

**Answer to post and mark as accepted:**

```markdown
Short version: **none to start, and the repo teaches you the rest as you go.**

- **To *use* it:** if you can call `fit`/`predict`-shaped APIs, you're ready
  now. Start with lesson **L02 (first classifier)** — you'll train a text
  classifier in the browser and check its accuracy without touching any math:
  `npm run dev:lesson:02`.
- **To *understand* it:** the lesson series builds the intuition in order —
  L00 (what an ELM even is, no prerequisites) → L03 (embeddings & similarity)
  → L05 (confidence) → L06 (kernels & Nyström). High-school algebra is enough
  for L00–L05; L06 introduces the kernel trick gently.
- **To go deep:** the research notebooks under
  `claude-markdown-documents/research-notebooks/` derive the math from scratch
  (e.g. NB-005 derives Random Fourier Features assuming only calculus).

A useful mental model for the whole library: an ELM is "random feature layer +
linear regression solved in closed form." Everything else here is a variation
on that theme — which is why training takes milliseconds, not minutes.
```

---

### Thread 4 — ❓ Q&A (self-answer, then mark accepted)

**Title:** `How do I save a trained model and load it later (no retraining)?`

**Question body:**

```markdown
Training is fast, but I don't want my users to retrain a classifier on every
page load. Can I train once, save the result, and ship the trained model with
my app?
```

**Answer to post and mark as accepted:**

```markdown
Yes — every trainable class can serialize to JSON, and the repo's own demos
show the full pattern:

1. **Train once**, then export: models expose JSON round-tripping (see the
   `chain-with-save` demo: `npm run dev:chain`, and the export step in lesson
   L02's third You-Try).
2. **Ship the JSON** as a static asset (it's small — these are linear-solve
   models, not gigabyte checkpoints).
3. **Load + predict** at runtime — no training call at all.

For browser apps that retrain occasionally (e.g. personalization), the
`examples/nolan-test/` demos show a heavier-duty pattern: cache the trained
model in **IndexedDB** keyed by a version string, retrain only when the key
changes, and gate the cached model on a held-out validation check before
trusting it.

If your model should *keep learning* after deployment, that's a different
tool — look at `OnlineELM` (lesson L04) which updates incrementally without
full retraining.
```

---

### Thread 5 — 💡 Ideas

**Title:** `What should the lesson series cover after L06?`

```markdown
The curriculum currently ships **L00–L06** (primer → JS/TS → first classifier
→ embeddings → online learning → confidence → kernels/Nyström).

We have opinions about what comes next, but this thread is for yours. Some
candidates we're weighing:

- **L07: retrieval + reranking** — the `EmbeddingStore` / reranking pipeline
  (build a tiny semantic search in the browser)
- **L08: synthetic data with OmegaSynth** — when you don't have training data
- **L09: model evaluation beyond accuracy** — calibration, confusion matrices,
  "when to distrust your classifier"
- **Random Fourier Features as a lesson** — NB-005 exists as a research
  notebook; is a beginner-friendly lesson version worth it?

What would *you* want to learn next? What did you hit in a real project that
the lessons didn't prepare you for? If a proposal here gets traction, a
maintainer will convert it to an issue and scope it.
```

---

### Thread 6 — 🎨 Show & tell

**Title:** `L00 in the wild — the ELM primer as a self-running demo`

````markdown
Kicking off Show & tell with the repo's own front door: **L00, the ELM
primer** — 16 slides that explain what an Extreme Learning Machine is,
assuming nothing, with live in-browser demos on the slides themselves.

Run it locally:

```bash
git clone https://github.com/AsterMindAI/AsterMind-Community-Edition.git
cd AsterMind-Community-Edition
npm install
npm run dev:lesson:00
```

What to notice while it runs:

- Training happens **live in your tab** each time — milliseconds, no server
  round-trip. Open devtools and watch: no network calls during training.
- Slide 12's demo retrains on every parameter change. That interactivity *is*
  the pitch: models cheap enough to retrain on a slider drag.

**Your turn:** post what you've built — class projects, experiments,
capstones, half-finished weirdness all welcome. Template: what it is (1–2
sentences), a link or repro command, and one thing that surprised you while
building it. The summer capstone demos (adaptive rock-paper-scissors, a
LOTL command classifier, and an RFF research notebook) will land in this
category as they ship.
````

---

## 4. Scripted seeding (optional, for repeatability)

Creating discussions is GraphQL-only (no REST endpoint). If you'd rather seed from the terminal than paste six times:

```bash
# 1. Get the repo ID and category IDs
gh api graphql -f query='
  query {
    repository(owner: "AsterMindAI", name: "AsterMind-Community-Edition") {
      id
      discussionCategories(first: 10) { nodes { id name } }
    }
  }'

# 2. Create one discussion per thread (repeat per seed, swapping IDs/body)
gh api graphql -f query='
  mutation($repo: ID!, $cat: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {repositoryId: $repo, categoryId: $cat,
                             title: $title, body: $body}) {
      discussion { url }
    }
  }' -f repo=<REPO_ID> -f cat=<CATEGORY_ID> \
     -f title="Welcome to AsterMind Discussions 👋 (start here)" \
     -F body=@thread-1-welcome.md
```

(Save each thread body from §3 to a temp `.md` file for the `-F body=@file` form; pinning and marking accepted answers still need the UI.)

---

## 5. Ongoing moderation (the part that keeps it alive)

The policy text lives in Thread 1 (pinned). Operationally:

- **Weekly triage (Fridays, ~10 min):** answer or acknowledge every unanswered Q&A thread; mark accepted answers the asker forgot to mark (askers and maintainers both can); move miscategorized threads; convert ripe Ideas to issues with a back-link.
- **During the internship:** Nolan does first-pass triage (answering what he can, flagging what he can't) as part of the cohort-lead role; Julian handles anything needing maintainer authority (locks, removals, converts, Announcements).
- **The dashboard for triage** is the Discussions tab filtered by `is:unanswered` — bookmark `…/discussions?discussions_q=is%3Aunanswered`.
- **Escalation ladder** (from the pinned policy): nudge → edit/move → lock → remove + block. Security reports get redirected to private channels immediately.

---

## 6. Follow-ons (explicitly not part of this setup)

- **`.github/DISCUSSION_TEMPLATE/` category forms** — worth adding once categories exist, so Q&A posts arrive pre-structured (what-I-ran / expected / actual). Deferred: [ADR-0006 §3, deliverable-1 Option B](../../../claude-markdown-documents/ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md).
- **CONTRIBUTING.md pointer** — add a two-line "Questions → Discussions, bugs → Issues" note to `CONTRIBUTING.md` § Asking for help after enablement (a PR, needs the live URL).
- **README badge/link** — same: one line in the README's community section once the tab is live.

---

## 7. Acceptance mapping (STARTER → this guide)

| STARTER acceptance item | Where satisfied |
|---|---|
| Discussions enabled | §1 (admin action — the deferred click) |
| ≥3 categories | §2 (four: Announcements, Q&A, Ideas, Show & tell) |
| ≥5 seeded threads, ≥1 per category | §3 (six threads: 2 Announcements, 2 Q&A, 1 Ideas, 1 Show & tell) |
| Moderation policy in a pinned post (or CONTRIBUTING.md) | §3 Thread 1 (pinned) + §5 operations; CONTRIBUTING.md pointer deferred to §6 |
| Reachable one click from the repo page | §1 verification step (the Discussions tab) |
