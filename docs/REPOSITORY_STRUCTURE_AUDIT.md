# Repository Structure Audit

**Date:** 2026-08-25  
**Auditor:** automated forensic inventory (Phase 16 repository repair)  
**Canonical path (determined):** `/Users/moomen/Projects/flowlary`

---

## A. Current filesystem structure (before repair)

```
~/Projects/flowlary/                    ← ROOT Git repository (canonical)
├── .git/
├── package.json
├── extension/
├── backend/
├── packages/
├── tests/
├── docs/
├── scripts/
├── release/
├── PHASE*_REPORT.md
├── flowlary/                           ← NESTED duplicate Git repository (problem)
│   ├── .git/
│   ├── package.json
│   ├── extension/
│   ├── backend/
│   └── ... (full monorepo copy)
└── node_modules/
```

---

## B. Root Git repository

| Property | Value |
|----------|-------|
| Path | `/Users/moomen/Projects/flowlary` |
| `git rev-parse --show-toplevel` | `/Users/moomen/Projects/flowlary` |
| HEAD | `61f3498` — `feat: add production readiness audit and entitlement gating` |
| Branch | `main` (ahead of `origin/main` by 2 commits) |
| Remote | `https://github.com/MoomenALdahdouh/flowlary.git` |
| Uncommitted | 23 modified + 10 untracked (Phase 16.1/16.2 work) |
| Nested `flowlary/` in git | **Untracked** (`?? flowlary/`) |

---

## C. Nested Git repository

| Property | Value |
|----------|-------|
| Path | `/Users/moomen/Projects/flowlary/flowlary` |
| `git rev-parse --show-toplevel` | `/Users/moomen/Projects/flowlary/flowlary` |
| HEAD | `a6b428a` — `fix: correct Flowlary repository root structure` |
| Branch | `main` (matches `origin/main`) |
| Remote | `https://github.com/MoomenALdahdouh/flowlary.git` (same) |
| Uncommitted | `package-lock.json` only (+6 lines) |
| Size | ~117MB (115MB `node_modules`, 664KB `.git`) |

---

## D. Remotes

Both repositories point to the **same** remote:

```
origin  https://github.com/MoomenALdahdouh/flowlary.git
```

---

## E. Branches

| Repo | Branch | Tracking |
|------|--------|----------|
| Root | `main` | `origin/main` (+2 local commits) |
| Nested | `main` | `origin/main` (at remote HEAD) |

---

## F. HEAD commits

| Repo | Commit | Description |
|------|--------|-------------|
| **Root** | `61f3498` | Phase 16 production readiness + entitlement gating |
| **Root** | `f9da997` | Phase 16 AI gateway (not in nested) |
| **Nested** | `a6b428a` | Last shared commit — repo root structure fix |

Root is **2 commits newer** than nested. Nested is frozen at pre–Phase 16 state.

---

## G. Modified / uncommitted files

### Root (critical — preserve)

- **Modified (23):** domain migration, entitlement hardening, docs, manifests, tests
- **Untracked (10+):** `PHASE16_*_REPORT.md`, `backend/src/middleware/{cors,entitlement}.ts`, new docs/tests, `flowlary/` nested dir

### Nested (low value)

- **Modified (1):** `package-lock.json` (+6 lines) — lockfile drift only

**No unique uncommitted source in nested** beyond lockfile noise.

---

## H. Identical files (overlap checksum match)

| Metric | Count |
|--------|-------|
| Root files (excl. `node_modules`, `.git`, `dist`, nested tree) | 312 |
| Nested files (excl. skips) | 266 |
| Overlapping paths | 266 |
| **Identical (SHA256)** | **229** |
| Different | 37 |
| Root only | 46 |
| **Nested only** | **0** |

---

## I. Different files (root newer / canonical)

All 37 differing overlap files have **root versions ahead** of nested (Phase 16+ work). Examples:

| File | Root | Nested |
|------|------|--------|
| `extension/src/config/endpoints.ts` | `api.flowlary.com` unified | `lingo-api.zaixos.com` / `flowlary-api.zaixos.com` |
| `package.json` | includes `dev:api`, backend in test script | no backend test, no `dev:api` |
| `backend/` | full AI gateway | placeholder `index.ts` only |
| `extension/src/background/*.ts` | managed AI via Flowlary API | legacy split APIs |

Full different-file list: 37 paths (see forensic script output in repair report).

---

## J. Root-only files (not in nested)

46 files exist only in root, including:

- `PHASE16_REPORT.md`, `PHASE16_1_REPORT.md`, `PHASE16_2_REPORT.md`
- Entire Phase 16 backend gateway (`backend/src/gateway/`, providers, middleware)
- `extension/src/config/auth.ts`, `extension/src/entitlement/`
- `docs/production/*` (AI architecture, domain, readiness)
- Phase 16 tests (`phase16-ai-gateway.test.ts`, etc.)

---

## K. Nested-only files

**None.** Zero files exist in nested that are absent from root (excluding nested's own `.git` and duplicate `node_modules`).

---

## L. Canonical tree determination

**Canonical: `/Users/moomen/Projects/flowlary` (root)**

Evidence:

1. Connected to GitHub remote with **2 additional commits** (Phase 16)
2. Contains all Phase 16.1/16.2 uncommitted work
3. Newer extension, backend, docs, tests
4. Nested is a **stale snapshot** at `origin/main` before Phase 16
5. Nested has **zero unique source files**

### Likely cause of nested duplicate

Commit `a6b428a` ("fix: correct Flowlary repository root structure") and related install docs suggest a prior agent or install step cloned/copied the repo **into** the project directory instead of **as** the project directory — creating `flowlary/flowlary/`.

---

## M. Recommended safe consolidation plan

1. ✅ Complete forensic inventory (this document)
2. Move nested tree to external backup:  
   `~/Projects/flowlary-backup-20260825-HHMMSS/flowlary/`
3. Verify root has no `flowlary/flowlary/` subdirectory
4. Run `npm test`, `npm run build`, `npm run build:release` from root
5. **Do not delete backup** automatically — owner may remove after confirmation
6. **Do not** run `git reset`, `git clean`, or `rm -rf`
7. **Do not** merge nested lockfile change (root lockfile is authoritative)

**Risk assessment:** **LOW** — nested contains no unique source; root is strictly superset.
