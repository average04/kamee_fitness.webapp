# Optional coach gallery implementation plan

**Goal:** Let coaches continue from Gallery with no photos and submit a complete profile through the existing review process.

**Architecture:** Next-link/optional-copy/checklist web changes plus a surgical removal of the3-photo arm from the existing private completeness function. Existing upload and authorization remain.

**Spec:** `docs/superpowers/specs/2026-11-28-optional-coach-gallery.md`.

- [x] Web: Optional copy/counts and accessible Next: Profile preview; local gallery failure retains progression without mutation controls. Meaningful page/completion tests pass.
- [x] Backend: CLI-created additive migration + rollback; exact catalog/ACL baseline; local rollback-only RED/GREEN for gallery-free submission and retained requirements/status/access checks.
- [x] Independent security review CLEAR; Claude provider timed out without a verdict. Reviewed single-function migration applied as hosted20261127182138; exact post-definition/ACL/wrappers and unchanged data/status hashes verified.
- [x] Full web tests/types/changed lint/build and responsive actual-page checks pass. Publish this reviewed commit through the existing Preview branch; final exact deployment and hosted smoke are recorded in the app canonical feature map and `docs/qa/optional-coach-gallery-2026-11-28.md`.
