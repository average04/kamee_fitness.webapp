import { isInvitable } from "./admin";

type Candidate = { id: string; role: string; coach_status: string };
export async function resolveInviteRecipient(email: unknown, deps: {
  find(email: string): Promise<{ candidate: Candidate | null; capped: boolean }>;
  create(email: string): Promise<string>;
}): Promise<string> {
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Enter a valid email address.");
  }
  const normalized = email.trim().toLowerCase();
  const { candidate, capped } = await deps.find(normalized);
  if (candidate) {
    if (!isInvitable(candidate.role, candidate.coach_status)) throw new Error("This account cannot be invited. Check their existing coach profile.");
    return candidate.id;
  }
  if (capped) throw new Error("The account search could not complete. Try their username in the existing-account search.");
  return deps.create(normalized);
}
