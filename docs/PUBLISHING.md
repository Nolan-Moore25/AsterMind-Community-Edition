# Publishing `@astermind/astermind-community` to npm

> **Status of this doc:** written 2026-07-14 against npm's then-current 2FA/provenance behavior; each step links the authoritative npm doc — re-skim those two pages before a publish, they change more often than this repo does.
> **Current package state:** `v4.0.0` is tagged in git and has **never been published** — the next publish is the package's *first*, which changes a few defaults (called out inline below).
> **Who runs this:** the npm `@astermind` org owner (Julian). Everything is copy-paste; nothing assumes memory of prior publishes.

---

## 0. The 60-second overview

```
 one-time setup          every publish
 ─────────────           ──────────────────────────────────────────────
 npm account             1. preflight   (clean tree, tag == version)
 2FA enabled       ───►  2. dry-run     (npm publish --dry-run + file review)
 @astermind org          3. publish     (Path A: local+2FA | Path B: CI+provenance)
 npm ≥ 9.5               4. smoke test  (clean-dir install, L02 bar)
                         5. announce    (GitHub release ⇄ Discussions)
                              └── if broken: 6. rollback (deprecate / dist-tag / patch)
```

The single most important fact in this doc: **`prepublishOnly` already guards the gate.** `package.json` wires `npm publish` to run `npm run clean && npm run build && npm test` automatically first (`package.json` → `scripts.prepublishOnly`) — a publish with failing tests aborts itself. Your job is everything the script *can't* check: the right files in the tarball, the right auth posture, and a working artifact on the registry afterward.

---

## 1. Prerequisites (one-time)

### 1.1 Accounts and permissions

- An npm account at <https://www.npmjs.com>, member of the **`@astermind` org** with publish rights (Owner/Admin/Developer role). Verify: `npm org ls astermind` (or check <https://www.npmjs.com/org/astermind>).
- Because the package is **scoped** (`@astermind/...`), npm would default its first publish to *private* (a paid feature) — this repo already pins `"publishConfig": { "access": "public" }` in `package.json`, so no `--access public` flag is needed. Don't remove that block.

### 1.2 Two-factor authentication (2FA)

Follow npm's official guide: <https://docs.npmjs.com/configuring-two-factor-authentication>

1. npmjs.com → avatar → **Account Settings** → **Two-Factor Authentication** → **Enable 2FA**.
2. Choose **"Authorization and writes"** (not "Authorization only") — this is the mode that makes *publishing* require a fresh OTP, which is the protection that matters for a supply-chain-sensitive action.
3. Use an authenticator app (or a passkey/security key); store the recovery codes somewhere that is not this repo.

With this mode on, local publishes prompt for a 6-digit OTP (or take `--otp=123456` on the command line).

> **Org-level hardening (recommended after the first publish):** in the npm package settings, set *Publishing access* → **"Require two-factor authentication and disallow tokens"**. Note the tradeoff: that setting blocks token-based CI publishing (Path B's token variant) — CI then requires **trusted publishing** (§5.3), which is the better end-state anyway.

### 1.3 Toolchain

- **npm ≥ 9.5** (provenance support floor; check `npm --version`). Node 18+ per the repo's build toolchain.
- Logged in: `npm whoami` should print your username. If not: `npm login` (completes in the browser, 2FA included).

---

## 2. What actually ships (read once, review every publish)

The tarball contents are controlled by the `files` allowlist in `package.json`:

```json
"files": [ "dist", "README.md", "LICENSE", "docs" ]
```

Plus npm's always-included files (`package.json`, `README`, `LICENSE`). Three things to internalize:

- **`dist/` is the product** — the rollup UMD + ESM bundles, the type declarations, and `dist/workers/elm-worker.js`. The `exports` map exposes two entry points: the package root and the `./workers/elm-worker.js` subpath. **If `dist/workers/` is missing from the tarball, the worker subpath 404s for every consumer** — this is the #1 thing to eyeball in the dry-run file list.
- **`docs/` ships too** — including this very file. That's intentional (consumers get the docs offline), but it means the tarball grows with every doc; if the file list ever looks bloated, this allowlist entry is the first suspect.
- **`src/` does not ship.** Consumers get compiled JS + `.d.ts` types, not TypeScript sources. Sourcemaps in `dist/` do ship.

---

## 3. Preflight (2 minutes)

From a **clean checkout of `main`** (not a working branch):

```bash
git status                      # must be clean — the tarball is built from disk, not git
git checkout main && git pull
node --version && npm --version # sanity: npm ≥ 9.5

# the version being published, and the tag that should match it
node -p "require('./package.json').version"    # → 4.0.0
git tag --list 'v4*'                            # → v4.0.0 must exist and point at HEAD:
git rev-list -n1 v4.0.0 && git rev-parse HEAD   # → the same SHA twice

npm ci                          # exact lockfile install, no drift
```

If the version was already published once (`npm view @astermind/astermind-community versions` errors with 404 *only* before the first-ever publish), **bump the version first** — npm permanently refuses to reuse a version number, even after an unpublish (§7).

---

## 4. The dry-run (do this before every publish, no exceptions)

Two commands, two different jobs:

### 4.1 Fast file-list review — `npm pack --dry-run`

```bash
npm run build            # pack doesn't run prepublishOnly; build so dist/ is fresh
npm pack --dry-run
```

This prints the exact tarball manifest without touching the registry. Review it against this checklist:

- [ ] `dist/astermind.esm.js`, `dist/astermind.umd.js` (+ `.map`s) present
- [ ] `dist/index.d.ts` (and the rest of the type tree) present
- [ ] **`dist/workers/elm-worker.js` present** (the `exports` subpath — see §2)
- [ ] `README.md`, `LICENSE`, `docs/` present
- [ ] **Nothing unexpected**: no `src/`, no `tests/`, no `examples/`, no `.env`, no scratch files that happened to be sitting in `dist/`
- [ ] Reported unpacked size is in the same ballpark as the last release (a sudden 10× is a packing accident, not growth)

### 4.2 Full-gate rehearsal — `npm publish --dry-run`

```bash
npm publish --dry-run
```

Unlike `pack`, this runs the **entire publish pipeline** — including `prepublishOnly` (clean → build → full test suite) — and stops just short of the actual upload. Expect it to take a few minutes (the test suite is the long pole; note that `tests/intern-program/capstones/nolan-infrastructure/` includes the RFF benchmark suite). Success criteria:

- [ ] `prepublishOnly` completes: build clean, **all tests green**
- [ ] The printed file list matches what §4.1 showed
- [ ] The printed name/version is exactly what you intend to release

If anything fails here, **stop** — fix on a branch, merge, re-run. The dry-run failing is the system working.

---

## 5. Publishing

Two supported paths. **Provenance is only possible on Path B** — npm provenance statements are generated from a cloud CI's OIDC identity (GitHub Actions / GitLab CI); a laptop has no such identity, and `npm publish --provenance` from a local machine simply errors. Official docs: <https://docs.npmjs.com/generating-provenance-statements>

**Recommendation for v4.0.0 specifically:** Path A for the first publish (smallest moving-parts count, and trusted publishing can only be configured for a package that already exists), then set up Path B + trusted publishing so v4.0.1+ ship with provenance forever after.

### 5.1 Path A — manual publish from a laptop (2FA, no provenance)

```bash
# after §3 preflight and §4 dry-run, on main, clean tree:
npm publish
# → npm prompts for your 2FA OTP (or: npm publish --otp=123456)
```

That's the whole command. `publishConfig` already pins the registry and public access; `prepublishOnly` re-runs the gate one final time.

### 5.2 Path B — GitHub Actions publish with provenance (the end-state)

Provenance cryptographically links the published tarball to the exact repo, commit, and workflow run that built it (Sigstore attestation; consumers verify with `npm audit signatures`, and npmjs.com shows a "built and signed" badge). Requirements: public repo, npm ≥ 9.5 on the runner, `id-token: write` permission, and auth via either a granular token (§5.2a) or trusted publishing (§5.3).

Reference workflow — **not yet committed to `.github/workflows/`**; arming an automated publish is a maintainer decision ([ADR-0006 §3](../claude-markdown-documents/ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md)). When adopted, save as `.github/workflows/publish.yml`:

```yaml
name: Publish to npm (with provenance)

on:
  release:
    types: [published]      # publish when a GitHub Release is published for a tag

permissions:
  contents: read
  id-token: write            # REQUIRED for provenance (OIDC)

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}   # omit entirely when using trusted publishing (§5.3)
```

(`prepublishOnly` runs inside `npm publish` on the runner, so the CI publish is gated by the same clean/build/test pipeline as a local one.)

#### 5.2a Token variant

Create a **granular access token** on npmjs.com (Access Tokens → Generate New Token → *Granular*): read+write scoped to *only* `@astermind/astermind-community`, shortest practical expiry, then store it as the `NPM_TOKEN` repo secret. Caveat: if the package later enables "require 2FA and disallow tokens" (§1.2), this variant stops working by design — migrate to §5.3.

### 5.3 Trusted publishing (token-free CI — set up after the first publish)

On npmjs.com → package → **Settings** → **Trusted Publisher**: register this GitHub repo (`AsterMindAI/AsterMind-Community-Edition`) + the exact workflow filename (`publish.yml`). After that, the workflow above needs **no `NPM_TOKEN` at all** — npm trusts the workflow's OIDC identity directly, there is no long-lived credential to leak, and provenance comes with it. This is the recommended steady state; it simply can't be configured before the package exists on the registry, which is why v4.0.0 goes out via Path A.

---

## 6. Post-publish smoke test (5 minutes, every publish)

Prove the *registry artifact* works — not your checkout. In a scratch directory **outside this repo**:

```bash
mkdir -p /tmp/astermind-smoke && cd /tmp/astermind-smoke && rm -rf node_modules package*.json
npm init -y >/dev/null
npm install @astermind/astermind-community@4.0.0    # pin the version you just shipped
```

Save as `smoke.mjs`, then run `node smoke.mjs`:

```js
// Post-publish smoke test — mirrors the L02 "first classifier" You-Try bar:
// train a two-language greeting classifier, require ≥80% held-out accuracy.
import { IntentClassifier, ELM, KernelELM, buildRFF } from '@astermind/astermind-community';

// 1. Surface check — the public API actually exported what we ship
for (const [name, ref] of Object.entries({ IntentClassifier, ELM, KernelELM, buildRFF }))
    if (!ref) throw new Error(`missing export: ${name}`);

// 2. Behavior check — L02 bar (ELM init is random; allow 3 attempts like L02's "re-click Train")
const train = [
    { text: 'hello there friend',       label: 'english' },
    { text: 'good morning everyone',    label: 'english' },
    { text: 'how are you today',        label: 'english' },
    { text: 'nice to meet you',         label: 'english' },
    { text: 'bonjour mon ami',          label: 'french'  },
    { text: 'salut tout le monde',      label: 'french'  },
    { text: 'comment allez vous',       label: 'french'  },
    { text: 'enchante de faire',        label: 'french'  },
];
const heldOut = [
    { text: 'hello everyone',      label: 'english' },
    { text: 'good day friend',     label: 'english' },
    { text: 'you are welcome',     label: 'english' },
    { text: 'bonjour tout le monde', label: 'french' },
    { text: 'salut mon ami',       label: 'french'  },
    { text: 'comment vas tu',      label: 'french'  },
];
let best = 0;
for (let attempt = 1; attempt <= 3 && best < 0.8; attempt++) {
    const clf = new IntentClassifier({ categories: ['english', 'french'], hiddenUnits: 32, useTokenizer: true, activation: 'relu' });
    clf.train(train);
    const hits = heldOut.filter(ex => clf.predict(ex.text, 1)[0].label === ex.label).length;
    best = Math.max(best, hits / heldOut.length);
    console.log(`attempt ${attempt}: held-out accuracy ${(100 * hits / heldOut.length).toFixed(0)}%`);
}
if (best < 0.8) throw new Error(`L02 bar failed: best held-out accuracy ${(100 * best).toFixed(0)}% < 80%`);
console.log('✅ smoke test passed');
```

Then three registry-side checks:

```bash
# CJS/UMD entry also resolves (the exports map's "require" branch)
node -e "const a = require('@astermind/astermind-community'); if (!a.ELM) throw new Error('UMD entry broken'); console.log('✅ require() ok')"

# registry metadata sane
npm view @astermind/astermind-community version dist.unpackedSize

# provenance verification (Path B publishes only)
npm audit signatures
```

- [ ] `smoke.mjs` passes (ESM import + the L02 accuracy bar)
- [ ] `require()` entry resolves
- [ ] `npm view` shows the new version; unpacked size is sane
- [ ] (Path B) `npm audit signatures` reports verified attestations; the npmjs.com page shows the provenance badge

Optional deeper check: `npm run dev:lesson:02` in the repo still passes its in-browser You-Trys — but that exercises the repo build, not the registry artifact; the clean-dir test above is the one that counts here.

---

## 7. Rollback — when a publish is broken

**The rule that shapes everything:** a version number, once published, is **burned forever**. Even if you unpublish 4.0.0, you can never publish a different 4.0.0. So rollback is almost never "remove it"; it's "stop people from getting it."

In order of preference:

### 7.1 Point `latest` back at the last good version (instant, reversible)

If a *previous* good version exists (won't apply to the very first publish):

```bash
npm dist-tag add @astermind/astermind-community@4.0.0 latest
```

New `npm install`s immediately resolve to the good version again. The broken version stays installable-by-exact-pin only.

### 7.2 Deprecate the broken version (the standard tool)

```bash
npm deprecate @astermind/astermind-community@4.0.1 \
  "Broken build (worker subpath missing) — use 4.0.2 instead"
```

Every install of that version now prints the warning. Reversible (`npm deprecate <pkg>@<ver> ""`).

### 7.3 Publish a fixed patch (the real fix)

Fix on `main` → bump patch version → full procedure from §3. Deprecation (7.2) plus patch-forward (7.3) is the standard pair.

### 7.4 Unpublish (rare, constrained — last resort)

`npm unpublish @astermind/astermind-community@4.0.1` works only inside npm's policy window — broadly: within **72 hours** of publish, or beyond that only if the version has no dependents and negligible downloads. Full policy: <https://docs.npmjs.com/policies/unpublish>. Reserve it for "published a secret/credential by accident" — and if that happens, **also rotate the secret**, because registry mirrors and installed copies already have it. For "it's buggy," use 7.1–7.3.

---

## 8. One-page publish checklist

```
PREFLIGHT   [ ] on main, clean tree, pulled          [ ] npm whoami works
            [ ] package.json version == git tag      [ ] npm ci clean
DRY-RUN     [ ] npm pack --dry-run file list OK (workers file present!)
            [ ] npm publish --dry-run green end-to-end (tests pass)
PUBLISH     [ ] Path A: npm publish + OTP    — or —  Path B: CI run green, provenance badge
SMOKE       [ ] clean-dir install + smoke.mjs ≥80%   [ ] require() entry ok
            [ ] npm view shows new version           [ ] (B) npm audit signatures verified
ANNOUNCE    [ ] GitHub Release notes                 [ ] Discussions announcement thread
IF BROKEN   [ ] dist-tag back → deprecate → patch-forward (unpublish = last resort)
```

---

## See also

- npm 2FA: <https://docs.npmjs.com/configuring-two-factor-authentication>
- npm provenance: <https://docs.npmjs.com/generating-provenance-statements>
- npm trusted publishing: <https://docs.npmjs.com/trusted-publishers>
- npm unpublish policy: <https://docs.npmjs.com/policies/unpublish>
- [ADR-0006](../claude-markdown-documents/ADRs/ADR-0006-nolan-capstone-infrastructure-and-rff-notebook.md) — why this doc is shaped this way (capstone deliverable 2)
- [`examples/intern-program/capstones/nolan-infrastructure/STARTER.md`](../examples/intern-program/capstones/nolan-infrastructure/STARTER.md) — the acceptance bar ("Julian would push the button using only this doc")
