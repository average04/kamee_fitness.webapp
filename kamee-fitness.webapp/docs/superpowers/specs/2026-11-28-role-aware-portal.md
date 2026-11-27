# Role-aware portal

The owner requested that coach/member logins stop returning to an unauthorized admin screen, that each account land on its appropriate dashboard, that portal navigation use a sidebar filtered by role, and that admins see coach account emails.

Use the existing Next16 portal and Kamee visual language. Keep existing member `/me`, approved-coach `/coaching/dashboard`, lifecycle setup/invitation routes, and allowlisted-admin `/admin` destinations. One server-verified role/capability reader supplies landing and navigation. Explicit safe continuation paths remain available only when the signed-in account can use them; public invitation/terms and account-erasure flows remain intact. Both OTP and magic-link completion use this resolver. Signed-in accounts reaching another role's panel go to their own dashboard without the misleading admin-login error.

Keep current admin email allowlist authorization and coach lifecycle gates. Navigation visibility is presentation, never authorization. Every privileged data/action gate remains enforced. Do not grant roles, change RLS/schema, or infer privileges from user-editable metadata.

Reuse existing typography, dark/leaf palette and guarded coach navigation. Desktop gets a persistent sidebar with role-relevant groups; small screens get a labelled Menu disclosure, visible focus, 44px controls and no horizontal overflow. Existing coach section navigation and unsaved-work/recovery/sign-out boundaries remain. Member activity/records are common; approved coaches additionally get their current workspace; admins additionally get administration. Nonapproved coaches see appropriate setup/status pages.

Show a labelled Account email on the admin coach-detail page. Read exactly that target through server-only Auth Admin after the real admin gate. Return only email or generic unavailable state; do not enumerate users or expose emails in public/member/coach APIs, navigation DTOs, or public coach profiles.

Implementation choices above follow the owner's request to proceed and the existing architecture. Preview remains the release scope; the halted Production rollout and backend controls stay unchanged.
