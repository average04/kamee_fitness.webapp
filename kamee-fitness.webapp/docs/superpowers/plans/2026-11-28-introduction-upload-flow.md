# Introduction video upload flow implementation plan

> **For agentic workers:** execute the existing-worktree UI change and independent final review without further permission loops, following the owner's autonomous implementation preference.

**Goal:** Make choosing, previewing and setting a coach introduction one clear flow.

**Architecture:** Retain VideoLibrary and its owner/generation-guarded upload/controller. Add a button-led shared chooser and separate intro upload/library choices; auto-assign only after successful explicit Upload/use and validation.

**Tech Stack:** installed Next16/React19, Tailwind workspace styles, existing TUS.

**Spec:** `docs/superpowers/specs/2026-11-28-introduction-upload-flow.md`.

**Constraints:** Preview only; current intro survives errors; current limits/actions/locks unchanged; no new dependencies, backend writes or mobile release.

**Review focus:** late callbacks/account switch; successful validation but failed assignment; duplicate uploads; local preview lifetime/long filenames at320px; library-only uploads never auto-assign.

- [x] Real React/JSDOM behavior coverage observed RED then GREEN, including the review findings and retained errors/guards.
- [x] Chooser, local preview, metadata/readiness and separate library path; explicit operation intent and owner/generation locks retained across upload/validation/assignment.
- [x] Focused45/full1,434 tests, TypeScript, changed lint, production build and responsive actual-component/native-filechooser checks pass.
- [x] Independent critical findings corrected with RED/GREEN regressions; Claude90s provider timeout recorded with zero source drift. Publish this reviewed commit to the existing Preview branch; final exact deployment and canonical feature-map/QA release record follow publication.
