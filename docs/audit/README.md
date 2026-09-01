# Historical audits and experiments

**These files are not the current architecture specification.**

They record investigations, phase implementations, provider evaluations, and design studies. Many conclusions were true at the time they were written and are now superseded by code plus:

- [../README.md](../README.md) (documentation index)
- [../architecture/ARCHITECTURE_FREEZE.md](../architecture/ARCHITECTURE_FREEZE.md)

Treat a conflict as: **code + freeze docs win**. Keep these files for provenance; do not implement new systems from them without checking the freeze.

Notable historical studies that remain useful as *evidence*, not as runtime design:

- `LOCAL_AI_MODEL_SELECTION_REPORT.md` — local SLMs were measured and rejected for production understanding.
- `WRITING_REVIEW_PRODUCTION_PATH.md` — superseded by [../architecture/WRITING_REVIEW.md](../architecture/WRITING_REVIEW.md).
- `_experiments/` — holdout / shim experiments, not production code.
