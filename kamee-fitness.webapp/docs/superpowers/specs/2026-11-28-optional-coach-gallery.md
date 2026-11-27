# Optional coach photo gallery

The owner reports no next step on Gallery and explicitly requests making gallery photos optional. Add a visible Next: Profile preview link using the existing guarded CoachLink and focus/touch styling. Label Gallery Optional and allow0-12 photos; keep existing photos, uploads, captions, reorder, removal, file limits and in-review freeze intact.

The shared backend currently requires3 gallery rows in private.coaching_profile_missing(uuid). Remove only that requirement with an additive migration and exact rollback; preserve profile existence, headline,80-character About and current terms acceptance checks, function owner/ACL/search path, submission lifecycle, admin review, storage and all user data. This intended policy change affects the existing shared completeness check; no profile is automatically submitted or approved.

Remove gallery from the web required checklist and derived counts. Keep legacy gallery error mapping readable and do not filter unknown/core server blockers out of SubmitBlock. Gallery-query failure must show a localized unavailable state with the next link still present, without pretending inventory is empty or mounting mutation controls.

Validate with local rollback-only actual-schema SQL tests for0/1/2 photos, remaining requirements and normal submission/status/access gates; independently review and request Claude before applying the single-function hosted migration. Web goes to the existing Preview branch; Production web/mobile releases stay halted, no app update or paid resources. No existing gallery photo is deleted or detached by this change.
