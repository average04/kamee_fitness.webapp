# Clear introduction video upload

The owner could not recognize the native file picker, clicked Upload first, and finds the whole upload/selection flow confusing. Use one explicit path: choose a local video, preview it, then **Upload and use as introduction**. A ready library video remains a separate **Choose from library** path with its own preview and **Use this video** confirmation.

Keep current intro visible until the replacement is validated and the existing expected-owner action succeeds. Empty profiles show the chooser immediately; existing intros expose Change introduction video. The file chooser is a real prominent button, with selected filename/size, local controls-only preview, a sensible editable title default and optional caption. Upload is visibly unavailable until valid MP4 up to50MiB and nonblank title. Every upload/validation/assignment error preserves the previous intro and provides a retry path. Blob previews are revoked on replacement/unmount. No autoplay.

Retain shared TUS upload, generation/account locks, current parser/size/duration/ownership/server action and authenticated media rules. Library-mode uploads remain independent assets, without automatic intro assignment. No backend/schema/mobile change or hosted fixture. Publish the existing web Preview branch only and record exact source, verification and proof limits in the canonical app feature map.

Approach: improve the existing VideoLibrary controller and shared chooser, retaining one upload pipeline. A purely styled native input would leave the confusing upload-then-select step; an automatic upload on file selection would remove the user's preview and confirmation. The combined explicit Upload/use action addresses both reported problems.
