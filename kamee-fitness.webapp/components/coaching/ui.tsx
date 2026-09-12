/**
 * Small shared presentation bits for the Coaching Hub's forms and views.
 * Fix round 1 minor: de-duplicated out of ProfileForm/CredentialsManager/
 * CoachProfileView, which had each grown their own copy.
 */

export const inputClass =
  "coach-input";

export function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${className}`}>{children}</span>
  );
}
