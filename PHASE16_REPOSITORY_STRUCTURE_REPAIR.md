# Phase 16 — Repository Structure Repair

**Date:** 2026-08-25  
**Canonical path:** `/Users/moomen/Projects/flowlary`

---

## BEFORE: actual structure

```
~/Projects/flowlary/                 ← Git repo (HEAD 61f3498, ahead 2)
├── .git/
├── extension/, backend/, packages/, tests/, docs/, ...
├── PHASE16_1_REPORT.md, PHASE16_2_REPORT.md (uncommitted)
└── flowlary/                        ← Nested Git repo (HEAD a6b4288, stale)
    ├── .git/
    ├── extension/, backend/, ...     (pre–Phase 16 snapshot)
    └── node_modules/ (~115MB)
```

Both pointed to `https://github.com/MoomenALdahdouh/flowlary.git`.

---

## PROBLEM: why nested `flowlary/` existed

Forensic evidence:

1. Nested repo HEAD = `a6b428a` (`fix: correct Flowlary repository root structure`) — matches `origin/main` **before** Phase 16 commits.
2. Root repo HEAD = `61f3498` — **2 commits ahead** with Phase 16 AI gateway + entitlement work.
3. Nested was **untracked** in root Git (`?? flowlary/`).
4. **Zero nested-only source files** — nested was a complete but stale duplicate.
5. Commit history includes install/relocation docs (`7656a8c`, `386bf8b`, `7a3ed04`) suggesting an install step cloned or copied the repo **into** the project directory instead of **as** the project directory.

Most likely: accidental nested clone/copy during macOS path repair (`~/Moomen/Projects` → `~/Projects`).

---

## ROOT: canonical repository

| Property | Value |
|----------|-------|
| Path | `/Users/moomen/Projects/flowlary` |
| Remote | `https://github.com/MoomenALdahdouh/flowlary.git` |
| HEAD | `61f3498` |
| Branch | `main` (ahead 2) |
| Phase 16 source | ✅ Present |
| Domain migration | ✅ `api.flowlary.com` |
| Uncommitted work | Preserved (23 modified + new files) |

---

## NESTED: what it contained

| Property | Value |
|----------|-------|
| Path (was) | `/Users/moomen/Projects/flowlary/flowlary` |
| HEAD | `a6b428a` (pre–Phase 16) |
| Size | ~117MB |
| Unique source files | **0** |
| Uncommitted | `package-lock.json` (+6 lines) only |
| Endpoints | Stale zaixos hosts (`lingo-api`, `flowlary-api`) |
| Backend | Placeholder (no AI gateway) |

---

## COMPARISON

| Category | Count |
|----------|-------|
| Overlapping paths | 266 |
| Identical (SHA256) | 229 |
| Different (root newer) | 37 |
| Root only | 46 |
| Nested only | **0** |

All 37 differing files: root version is **newer/canonical** (Phase 16+).

Full inventory: [docs/REPOSITORY_STRUCTURE_AUDIT.md](./docs/REPOSITORY_STRUCTURE_AUDIT.md)

---

## ACTION: exactly what was moved

**No files deleted. No `rm -rf`. No git reset/clean.**

```bash
mv ~/Projects/flowlary/flowlary \
   ~/Projects/flowlary-backup-20260825-100200/flowlary
```

- Nested duplicate moved to external backup (outside project root)
- Root source files: **unchanged**
- Root uncommitted work: **preserved**
- Nested lockfile drift: **not merged** (root lockfile authoritative)

---

## SAFETY: what was preserved

| Item | Status |
|------|--------|
| Root uncommitted Phase 16.1/16.2 changes | ✅ Intact |
| Root Git history | ✅ Unchanged |
| Nested full tree | ✅ In backup |
| Nested `.git` | ✅ In backup |
| Nested `node_modules` | ✅ In backup |

**Backup location (do not delete yet):**

```
/Users/moomen/Projects/flowlary-backup-20260825-100200/flowlary/
```

Remove manually only after confirming backup is not needed.

---

## VALIDATION

From `/Users/moomen/Projects/flowlary`:

| Check | Result |
|-------|--------|
| `git rev-parse --show-toplevel` | `/Users/moomen/Projects/flowlary` |
| No `flowlary/flowlary/` | ✅ Confirmed |
| `npm test` | **489 / 489 PASS** |
| `npm run build` | **PASS** |
| `npm run build:release` | **PASS** |
| `extension/dist/manifest.json` | ✅ Exists |

---

## FINAL: exact canonical project path

```
/Users/moomen/Projects/flowlary
```

Desired structure restored:

```
~/Projects/
├── flowlary/                          ← canonical repo
│   ├── .git/
│   ├── package.json
│   ├── extension/
│   ├── backend/
│   ├── packages/
│   ├── tests/
│   ├── docs/
│   ├── scripts/
│   └── release/
│
└── flowlary-backup-20260825-100200/   ← safety backup
    └── flowlary/                      ← former nested duplicate
```

**No nested `flowlary/flowlary/` remains.**

---

## Git status after repair

- Branch: `main` (ahead 2 of origin)
- Uncommitted work unchanged + new audit docs
- Backup **not** committed to Git (external to repo)

---

## Next steps

1. Review backup at `~/Projects/flowlary-backup-20260825-100200/` when convenient; delete if confirmed unnecessary
2. Commit Phase 16.1/16.2 + structure audit when ready
3. Continue Phase 17 (deploy `api.flowlary.com`)
