# Hosted coach authoring acceptance — 2026-10-30

Status: hosted draft save, gallery upload/caption and video upload/playback exercised. A legacy-level save defect was found and corrected; the corrected Preview save/reload check passes. Synthetic gallery cleanup and original-photo preservation are verified.

## Target and evidence

The signed-in, authorized coach session used PR #12 at `https://deploy-preview-12--kameefitness.netlify.app`. The authoring checks observed Netlify deploy `6ae3bca98d770818414db6f6`, revision `167b54aaf8b8a18faf60228f43961d4dc6a9d7be`; public deploy metadata confirmed `ready` and `deploy-preview`. This differs from the earlier read-only receipt's deploy. No fresh login or authentication-code retrieval was needed.

Evidence is local and ignored under the app checkout's `.superpowers/qa/coach-hosted-write-acceptance-20261030/`. Synthetic fixtures and their generation/probe records are in this checkout's `.superpowers/qa-workspace-acceptance-20261030/media-prep/`. No personal photo or video was uploaded.

## Hosted observations

| Workflow | Observed result |
| --- | --- |
| Existing `test1` draft save/reload | A temporary summary saved and survived reload. The initial legacy empty level displayed **Any level**, but the summary-only save silently changed it to **Beginner**. Explicitly selecting **Any level** and restoring the empty summary then saved and survived reload. All 47 visible form controls match the captured baseline. The level is now the explicit `none` value; this is not a claim that the original raw null or draft revision was restored. No submission, price, approved-version or schedule mutation occurred. |
| Corrupt photo | The deployed gallery rejected the synthetic `corrupt.jpg` with “Could not read this image. Please choose another photo.” The gallery retained four photos. |
| Photo preparation/upload | A clearly labelled synthetic 320×180 PNG (38,445 bytes) uploaded as a fifth gallery item. The hosted object returned HTTP 200, `image/webp`, 7,812 bytes and actual `RIFF`/`WEBP` signatures; SHA-256 `9edbe6433da46e88e523c19d2f97ac6e7549a807798a8d74c07759f64a2b9b8e`. The decoded image was 320×180. This exercises the deployed preparation/upload path for this fixture, not the entire earlier local codec matrix. |
| Caption/reload/cleanup | The synthetic item's caption saved and survived reload. After the user completed the native confirmation, a fresh reload returned four photos; original image URLs/order/decoded dimensions and all captions exactly matched the pre-upload baseline. The synthetic object's public GET returned HTTP 400 with `not_found`, `Object not found`, and body status code `404`. No original photo was deleted or reordered. |
| Video upload/finalize | A labelled, silent synthetic four-second H.264 MP4 (84,554 bytes, 320×180) uploaded, reached **Video ready**, and remained `ready · 4 sec` after reload. No plan attachment or profile intro was set. |
| Video playback | The signed player decoded 320×180 video without an error. Native keyboard playback advanced from 0.130267 seconds while playing to `currentTime=duration=4`, `ended=true`, `error=null`. |
| Video retirement | On the resumed browser pass, the test video was absent; reload confirmed an empty library. The manual/native confirmation action during the tooling interruption was not observed. Retirement hides the row and retains the underlying video for existing references/retention rules; no immediate storage erasure is claimed. |

Chrome file inputs represented as visually hidden accessible buttons did not open a chooser through those locators. Clicking the visible `+ Select photos` label did. Native JavaScript confirmations repeatedly caused browser-tool timeouts; the user completed the cleanup confirmation. Earlier reads still showed five items, so those were not treated as successful cleanup. Final fresh readback and byte-object absence confirm cleanup on deploy `6ae3c6183ebf56538e1bcfb2`, documentation-only revision `0767a5e0f9dfe9df911b419160d1bb6cd8a5c51d`; public deploy metadata confirms ready and the exact revision. This is a tooling limitation, not an application validation failure or fully automated confirmation proof. Temporary readback tabs are closed.

## Save defect and verification

`PlanEditor` originally retained a legacy null level while the HTML selector displayed its first option, **Any level** (`none`). `draftPayload` sent null unchanged; the existing SQL writer defaulted null to `beginner`. Initial editor state, restored local drafts and the server-action payload now normalize only null/undefined to `none`. Explicit values remain unchanged. No database function or schema changed.

The two null/undefined regression cases failed before the fix. All 20 affected tests then passed (`plan-validation`, `plans`, `pricing-routes`); TypeScript and scoped ESLint passed. Claude independently **APPROVED the web implementation** after tracing the server-action path and recovery behavior. This approval is for code review, not a Production release.

Commit `cfe37ab4d8c67ba339d9da4fb45196970a869046` is pushed to the existing branch. Netlify deploy `6ae3c394f3c65d08d0675268` returned `ready` for that exact revision and was observed in the test tab. A new summary-only save survived reload with **Any level** unchanged. The empty original summary was saved again; after another reload all 47 controls matched the captured visible baseline. The hosted round trip uses the draft's now-explicit `none` value; the null/undefined reproduction is covered by the failing-then-passing payload regression, not by resetting live data to null. The temporary verification tab is disposable. No broad test rerun was needed for unchanged photo/video code.

The existing web PR #12 remains draft. Public coach sales stay disabled. Cover/avatar upload, plan creation/submission/operator review, stale-tab conflicts, physical Safari/iOS and full accessibility acceptance remain outside this receipt's completed scope. No financial writer, purchase, payout, backend deployment or Production publication occurred.
