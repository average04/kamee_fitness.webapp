# Local conversation regression harness

From the web app directory:

```powershell
node scripts/qa/coaching-conversations-harness.mjs --app-root D:/Projects/kamee-fitness/worktrees/coach-plan-attribution --serve
```

Open the printed loopback URL. Stop with `stop` on stdin or Ctrl+C. This builds the actual views and shared participant controller against synthetic memory ports; no private environment files, Auth session or hosted requests are used. CSP disallows connections. It is separate from deployed Next routing/auth acceptance. The 320px switch constrains the content column, not the browser viewport. Large text is a fixture class, not native Dynamic Type.

Keep recordings in ignored local QA storage only. Never upload them with the source changes.

## Recovery and consent

1. Enter multiline text; Tab to Send and press Enter. Verify exact text, Sent, matching draft cleared and focus returned.
2. Choose **Lose next send reply**, send a distinct message, edit the draft, then **Close conversation**. Retry delivery. Expanded request evidence must show the identical original key/body/revision twice; the edited draft must remain.
3. Reset. Choose **Drop next send before commit**, send, close the conversation and retry. Delivery must remain uncertain. Stop checking requires the explicit unknown/possible-duplicate warning, retains a copy and never automatically sends. A second unknown copy cannot replace the first without dismissal.
4. Block and confirm; Unblock and confirm. Sending stays unavailable until both participants consent again. With the old attempt policy displayed, choose **Rename policy coach**, then confirm sharing. It must require another review instead of accepting the newly fetched name silently.
5. Select messages/category, lose the next report reply and submit. Retry must retain the exact request; clear selection only after confirmed success. Block is a separate action.

## Viewport read regression

Use a fresh page or Reset while the toolbar is at the top. Do not first focus the composer or scroll through the last message: read cursors are monotonic.

1. Keep the transcript only partly inside the browser viewport. Inspect the actual body paragraph of the last rows and the **Synthetic request evidence**. A row header or padding sliver is insufficient; the sequence must not advance beyond message bodies that intersect the outer viewport and transcript clipping area.
2. Focusing the composer scrolls the last body on screen. The cursor may now advance to that sequence.
3. Move the page back to the toolbar. The cursor must remain monotonic, with no unnecessary busy/error reset for an already-read callback.

The original root-scoped observer marked 115 while its entire row was below an 889px viewport. The viewport observer corrected that outer clipping problem; sequence attributes belong to body paragraphs so row padding/author labels cannot admit unseen text. Actual browser geometry is the authority for this regression; static markup tests do not establish IntersectionObserver behavior.

The app checkout also has an opt-in actual-view regression:

```powershell
node --test scripts/qa/coaching-conversation-view.test.mjs
```

Run it from the sibling app worktree, or set `KAMEE_C1C_WEB_ROOT` to this web app directory. It uses the existing JSDOM package and matching web React renderer, a controlled clipping/observer model, and the actual view/pure parsers. It checks body/tombstone visibility and queued focus loss, detects deliberate root/body/guard reversions, and submits two immediately successful reports. This is repeatable controlled-API evidence, not a browser layout or device recording.

## History, roster and lifecycle

- Load older messages and compare the first visible message ID/offset before/after prepend. Add a message while pinned: show Return to latest, retain the anchor. Tombstone a retained message: refresh must replace its body.
- Clients uses generic labels and exact attempt links. Pause/Make available must refresh row statuses immediately. Same-page polling retains focused links; page changes/errors/retirement clear rows. Account switching must replace scope; retirement hides private content immediately.
- Test connection verification with the controlled runtime/lifecycle suites. This harness has no real Auth session, so it cannot establish hosted Auth/cookie/cross-tab behavior. Native pixels, IME, screen readers and OS reachability require separate device acceptance.
