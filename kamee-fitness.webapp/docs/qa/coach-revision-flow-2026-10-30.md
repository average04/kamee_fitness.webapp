# Coach request-changes and resubmission acceptance — 2026-10-30

Status: **targeted revision flow PASS; retirement and final preservation checks DEFERRED**. The user accepted earlier QA without reruns and subsequently instructed the agent to skip checks that unavailable computer control prevented. This closes the observed request-changes/correction/resubmission path, not the deferred cleanup or full release gates.

## Target and exact fixture

Coach actions used the retained approved-coach session on `https://kamee.fit`; operator actions used `https://deploy-preview-12--kameefitness.netlify.app`, source `858458cfbe62ea7db6f91a5bd4a20ab6cf348016`, deploy `6ae3e5dd8058e786166fd6ab`. This is not full acceptance of the new Preview coach editor. No application code, account role, credentials or sales settings changed.

One new plan was necessary because the previous approval fixture is terminally retired:

- ID: `72aa11d9-7426-4b64-8b65-a9341181c173`.
- Title: **QA DISPOSABLE — Revision acceptance 2026-10-30**.
- One week, Beginner, no equipment, estimated 11 minutes. Day 1 is a run-type day labelled **QA revision fixture — do not train**, containing three easy walks of 300/60/300 seconds; Days 2–7 are rest.
- Summary explicitly identifies synthetic workflow QA, not training guidance, and states retirement without approval or enrollment. Its initial marker was `Revision marker: initial.`
- Cover upload reused the previously generated labelled QA PNG. Its printed title says **COACH APPROVAL ACCEPTANCE**; it was not renamed or treated as a new cover-conversion test. No meals or videos were attached.
- Price remained unset, No current version and Purchases are currently off were observed. No approval, purchase, enrollment, workout, price change or financial operation was performed.

## Observed revision path

1. **Initial submission:** saved the fixture and submitted it. Reload showed **Version 1 · In review**, with no editable plan-content text/number fields.
2. **Request changes:** the Preview operator explicitly selected **Request changes** and requested only this summary replacement: `Revision marker: initial.` → `Revision marker: corrected after feedback.` The feedback also required preserving the synthetic warning and schedule, resubmitting, then retiring without approval or enrollment. Saved review history contains the exact note.
3. **Coach correction:** reload showed **Changes requested**, the exact **Review feedback**, and enabled Details/Schedule/Meals/Preview and Save draft controls. The summary was editable. The coach changed only the requested marker, saved, and reloaded; the corrected summary persisted while the status remained Changes requested and feedback remained visible.
4. **Resubmission:** Submit for review returned the version to **In review**. Reload retained the corrected summary and feedback. Plan-content editing and Save/Submit controls were absent again. Pricing and the locked-preview checkbox remain separate controls; this is not a claim that every input on the page is disabled.
5. **Operator readback:** the separate Preview page shows the corrected summary, the review form available again, and exactly three history entries displayed newest first. In time order they are `submitted` → `changes_requested` with the note → `submitted`, at displayed times `10/30/2026, 12:58:28 AM`, `12:59:26 AM` and `1:00:13 AM`. These are quoted UI values, not labelled Manila timestamps.

Rendered schedule text matches exactly across initial preview, both review states and corrected/resubmitted previews. The saved UI evidence establishes cross-screen persistence and content-editing visibility; it does not establish complete database equality or server-side rejection of attempted unauthorized edits. Source inspection predicts a coach inbox notification for Request changes; delivery/read state and notification count were not checked.

## Deferred cleanup and verification

Retirement was initiated only for this fixture. The native Chrome confirmation remained open with **“Retire this plan? Its versions are kept, but you cannot edit or resume it.”** Browser dialog calls timed out, and native control repeatedly stopped because its URL verification could not establish the current Chrome destination. No successful confirmation or retirement readback was observed. The last verified server-backed UI state is **In review**; final retirement is **pending, not passed**. No unsupported control method or database cleanup was used.

The pre-test baseline has six coach cards and eighteen admin cards, including the earlier retired fixture. The new fixture appeared in the admin queue. A final full-list comparison was not completed, so this checkpoint makes no new exact-preservation claim for unrelated cards. Actions were confined to the new fixture; the previous acceptance results remain accepted and were not rerun.

Full Preview coach-editor lifecycle, avatar/profile-cover replacement, complete accessibility, physical Safari/iOS/native video, member-discovery and notification readbacks remain unverified. Real settlement/cash evidence, operator decisions and the Everyday Strength correlation hold remain prerequisites; skipping unavailable QA does not enable financial writers or public sales. No Production code release, native build, base merge or sales activation occurred.

## Local-only recording and evidence

The user's preference is to save future QA screen recordings locally where supported and not redo accepted QA merely to obtain recordings. OBS recorded a dedicated Chrome-window scene with desktop and microphone audio muted. Recording was stopped after computer control resumed; the UI returned to **Start Recording** and the file was finalized. No recording was uploaded or committed.

Local file: `C:/Users/laptop/Videos/2026-10-30 08-56-01.mp4`. Technical verification: **31:44.967**, **1280×720 at 30 fps**, H.264 video/stereo AAC 48 kHz; strict full-stream decode exited 0. All decoded audio samples are zero. File size **1,431,157,840 bytes**, SHA-256 `75c34c21e60dd582ece821a5e79fe8273e1d18525b23fcd981224d4f92edcb3c`, size/hash/mtime stable during the check. This verifies readable, silent media, not complete visual coverage of each action. The recording includes time after the interruption; retirement completion is not established by it. No playback, extracted frames or visual audit of the recording was performed.

Ignored evidence remains in the app worktree's `.superpowers/qa/coach-revision-acceptance-20261030/`: fixture and original-card JSON, `01`–`09` DOM/AX/PNG captures, event timestamps, and `recording-technical-verification.json` with supporting logs. `03-admin-feedback-ready.png` shows a blank feedback box despite the populated DOM capture; `04-admin-changes-requested` establishes the saved note. `09-admin-resubmitted` JSON/AX contains the history outside its PNG viewport. Native confirmation observations remain in the tool transcript.

No application tests were rerun for this documentation-only checkpoint. Prior implementation tests retain their original scope.

Claude reviewed the written receipt against the saved text evidence and technical recording report. Two requested corrections were applied: distinguish newest-first display from chronological event order, and omit the plan-type label that was only established by the interaction transcript. The review confirmed the other documented evidence and limits. Its response is saved locally as `claude-review.json`; no independent UI replay, media inspection or subsequent approval verdict is claimed.
