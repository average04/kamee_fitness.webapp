# Coach submission and operator approval acceptance — 2026-10-30

Status: **bounded hosted create → save/reload → submit → approve → pause → retire PASS (coach on Production, admin on Preview)**. Existing admin access is now verified through the Preview admin UI; Production admin sign-in was not completed. The preceding coach-account denial remains correct and is no longer a blocker to this workflow. No application code or permission changed.

## Targets and authorization

The user approved checking the existing owner/admin account and using a disposable plan for approval-flow acceptance, then supplied the requested one-time sign-in code. Preview admitted that existing account to the admin dashboard and coaching review queue. No role, allowlist or credential was created or changed. Authentication codes were not saved in QA artifacts.

Admin review used web Preview source `4d11ddb79b782313b075e5c0dc2b44fe083a20b7`, Netlify deploy `6ae3d386a8f72900267ec0e1`. Coach authoring and retirement used the separately retained approved-coach session on `https://kamee.fit`. These origins allowed both roles to remain signed in. The compared admin coaching-plan route files are unchanged from main `83b3af115e7a8160693b2f03a56040039023156d`; the receipt does not claim that the new Preview coach editor or WebP converter was exercised on the Production coach page.

The initial Production login attempt remained at its client-side human-verification message and sent no code. Preview's automatic verification completed and one email request succeeded. The user-provided code admitted the owner. A subsequent verification-widget error after the email request did not prevent the supported code-verification flow. No CAPTCHA was solved manually, security setting altered or alternate authentication token minted.

## Exact disposable fixture

- Plan ID: `4f744c3d-121e-4607-8caf-b3ea52a94128`.
- Title: **QA DISPOSABLE — Approval acceptance 2026-10-30**.
- Explicit synthetic summary states this is workflow acceptance, not training guidance, and must be retired without enrollment.
- Outdoor plan, one week, Beginner, no equipment, estimated 11 minutes. Day 1 is labelled **QA fixture — do not train**, a run-type day containing three easy walk intervals of 300, 60 and 300 seconds. Days 2–7 are rest. No attached meals or videos.
- Newly generated 1200×800 PNG cover visibly says **QA DISPOSABLE / COACH APPROVAL ACCEPTANCE / NOT FOR TRAINING / 2026-10-30**. Input SHA-256: `68cdb8e9bd53866e88ec74874fc49da62352c89af26cb885b52c53a6cb6e28d2`.
- Price remained unset; no store offer, purchase, enrollment, workout or financial operation was performed.

## Observed lifecycle

1. **Create and cover upload:** the coach created exactly one new draft and uploaded only the labelled synthetic cover. The upload completed normally. No pre-existing plan or photo was replaced.
2. **Save/reload:** after filling the summary, minutes, explicit Beginner level and single Day 1 schedule, Save returned **Saved.** Reload preserved those details and the schedule, and no local-backup notice remained. The initial `saved-qa-details.json` caught the cover still loading (`complete:false`, 0×0). A later pre-submission DOM check in the tool transcript confirmed it loaded at 1200×800; the saved `qa-saved-preview.png` shows the cover, and post-submission `qa-in-review.json` also records its loaded dimensions. This proves the existing cover-upload path, not new Preview WebP conversion.
3. **Submit/freeze:** Submit returned **Submitted for review.** After reload, the plan was **In review**, with zero editable content text/number inputs and no Save draft or Submit control. Pricing remains a separate listing panel and was untouched.
4. **Admin review:** the exact new ID appeared in the Preview queue as In review. Its cover, synthetic summary, 11-minute schedule and three walking intervals matched the coach preview. The default decision was Request changes; the operator explicitly chose Approve and entered a note identifying this as workflow QA, not a coach or clinical endorsement.
5. **Approval readback:** Save review appended one visible approved history entry alongside the submitted entry, and the decision form disappeared. The implementation's transient `Review saved.` message was not observed because the form unmounted; success is established by review-history and owner reload instead. The coach saw **Approved**, the exact review note, read-only content and current listing Version 1.
6. **Pause:** the coach immediately paused the newly approved listing. Reload exposed Resume plan, proving persisted paused state. Price not set and Purchases are currently off remained visible. Approval may have briefly made this active listing discoverable before pause; no claim of zero third-party visibility is made.
7. **Retire:** the browser extension's click/dialog-accept calls timed out on the native confirmation. Native Chrome control then brought the owned coach tab into view. A fresh screenshot showed the QA plan's coach URL and the generic confirmation text: “Retire this plan? Its versions are kept, but you cannot edit or resume it.” Its OK button was clicked. This native screenshot is transcript-only and was not saved. The browser reported no remaining dialog and **Plan retired.** Reload confirmed **Retired**, zero editable content inputs, no Plan options, no Resume and no Create next version. No user click was required.

## Preservation and retained records

The coach list now has six cards: the original five plus this retired fixture. The admin list has eighteen: the original seventeen plus this retired fixture. Comparing cards by their plan path, every original card's visible text exactly matches baseline (coach: title/type/weeks/version/status/price; admin: title/version/status). Both lists independently show the new fixture as Retired. This is UI card preservation, not a fresh complete database snapshot comparison.

Retirement is terminal but does not delete records. The synthetic listing/version and submitted/approved review history remain intentionally retained. No cover deletion was performed; cover rendering after retirement was not confirmed. Source inspection shows approval inserts a deduplicated coach inbox notification; its actual delivery/read state and any hosted notification hooks were not inspected. No exact notification-count claim is made. Retirement excludes the listing under the implemented discovery status predicate; an independent member discovery request was not performed here.

The five original coach plans, original gallery and existing commerce settings were not edited by this test. No app/web Production deployment, native build, base merge, public-sales activation or new purchase occurred. Preview remains signed into the existing admin; the separate Production coach session remains available.

## Evidence and remaining scope

Ignored evidence is in the app worktree's `.superpowers/qa/coach-admin-acceptance-20261030/`: `fixture-created.json`, original/final coach/admin card JSON, saved detail/preview captures, in-review JSON/screenshot, `qa-admin-review-before.png`, admin/owner approval AX records, persisted pause JSON/screenshot, retired JSON/screenshot, and `qa-preservation.json`. The synthetic cover and generator are in the web checkout's ignored `.superpowers/qa-admin-acceptance-20261030/`. Native dialog observations remain in the tool transcript. The earlier preflight is historical; its pending-code status is superseded by this completed receipt.

Claude's read-only evidence/source review returned **APPROVE** after six documentation corrections clarified origin scope, cover evidence timing, the generic native dialog, post-retirement cover uncertainty, card fields and the run-type day. Review responses are `claude-qa-review.json` and `claude-qa-review-r2.json` in the evidence directory. Claude did not independently replay the UI. The two optional wording/evidence-list nits from the approved review were also applied.

No code tests were rerun because this checkpoint changes documentation only and exercises unchanged deployed code. Earlier implementation tests retain their original source scope. This closes the bounded positive create/plan-cover/submit/approve/retire gate. Request-changes/resubmit, full Preview coach-editor lifecycle, avatar/profile-cover replacement, complete accessibility, physical Safari/iOS and native-video acceptance are not inferred. Settlement/payout evidence and the Everyday Strength correlation hold remain separate prerequisites.
