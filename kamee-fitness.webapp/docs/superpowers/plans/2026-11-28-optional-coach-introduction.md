# Optional coach introduction implementation plan

**Goal:** Make the existing optional coach video feature discoverable and manageable in the coach profile editor, feeding existing member app playback.

**Architecture:** Inline presentation around the existing owned library/TUS/finalization/intro RPC flow. Approval and signed media gates stay unchanged. No app-native or schema work is needed.

**Spec:** `docs/superpowers/specs/2026-11-28-optional-coach-introduction.md`.

- [x] Add approved/read-only optional profile section and shared introduction library mode; use TDD for attachment state, errors and pending races while retaining upload/navigation behavior.
- [x] Independently validate the generated sample MP4 against the actual local parser; inspect existing mobile visibility/player/native guards and hosted effective contract without mutations.
- [x] Run affected/full web tests, types, changed-file lint and production build; perform responsive actual-component visual checks. Obtain independent review and required Claude verdict or provider blocker for attachment/data-integrity work.
- [ ] Publish the existing web Preview branch, verify exact Netlify commit and feasible hosted smoke, and update the canonical feature map and dated QA receipt. Keep Production/backend controls and Android releases unchanged.

Final deployment closure is recorded after publishing in companion app `docs/qa/optional-coach-introduction-2026-11-28.md` and its canonical feature map. This plan's release checkbox predates that receipt.
