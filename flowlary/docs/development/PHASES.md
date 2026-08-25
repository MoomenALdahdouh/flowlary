# Flowlary Implementation Phases

| Phase | Name | Status |
|-------|------|--------|
| **0** | Forensic audit (`FL0_AUDIT.md`) | ✅ Complete |
| **1** | Foundation — monorepo, core scaffold, build, tests | ✅ Complete |
| **2** | DOM / Safety / FieldSession hardening | ✅ Complete |
| **3** | InputEngine + CommandRouter wired to events | ✅ Complete |
| **4** | Port Layfix layout module (local-first) | ✅ Complete |
| **5** | Port Lingo manual translation | ✅ Complete |
| **6** | Port Lingo live translation (default OFF) | ✅ Complete |
| **7** | Port EWA correction + BYOK Groq | ✅ Complete |
| **8** | CorrectionCard + direct-edit integration | ✅ Complete |
| **9** | Unified popup UX | Pending |
| **10** | Unified storage + migration from legacy keys | Pending |
| **11** | Unified history | Pending |
| **12** | Performance / cost optimization (CacheCoordinator persistent) | Pending |
| **13** | Security / privacy review | Pending |
| **14** | Full regression testing | Pending |

## Phase 1 Deliverables

- New `flowlary/` monorepo (independent of source repos)
- ONE manifest, ONE content script, ONE service worker, ONE popup
- Core types, FieldSession, InputEngine, CommandRouter (infrastructure only)
- Unified DOM + safety abstractions (tested, no feature AI)
- Storage namespace foundation
- CacheCoordinator interface
- Messaging layer + minimal popup shell
- Unit/integration tests + documentation

## Rules Between Phases

After each major phase:

1. Build
2. Run tests
3. Fix errors
4. Verify behavior
5. Commit

Do not proceed if the previous phase is broken.

## Source Repositories (Read-Only)

- `english-writing-assistant` → correction
- `ai-writing-translator` → translation
- `autofix-layout` → layout

Never modify these repos during Flowlary development.
