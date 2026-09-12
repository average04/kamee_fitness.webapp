import {
  CREDENTIAL_EVIDENCE_CHANGED_MESSAGE,
  credentialEvidenceMatches,
  describeRpcError,
  type CredentialEvidence,
} from "./admin";

/**
 * Credential verification flow for the admin console, kept free of Next and
 * Supabase imports so it can be unit tested with injected dependencies.
 *
 * The database is the authority. `admin_verify_coaching_credential`
 * (migration 20260913100400) receives the evidence the admin reviewed plus
 * the digest of the document the admin's session downloaded, locks the
 * credential row, compares, and verifies in one transaction -- a coach edit
 * at any point after the page loaded makes it raise `evidence_changed`. The
 * pre-download comparison here is only an early exit so a stale page does
 * not download a document for nothing; it is not what makes this safe.
 */

export type VerifyRpcArgs = {
  p_id: string;
  p_actor: string;
  p_document_sha256: string | null;
  p_expected_title: string;
  p_expected_issuer: string;
  p_expected_issued_year: number | null;
  p_expected_expires_on: string | null;
  p_expected_document_path: string | null;
};

/** Builds the 8-argument RPC payload from the evidence the admin reviewed -- never from a later read. */
export function buildVerifyRpcArgs(
  credentialId: string,
  actorId: string,
  expected: CredentialEvidence,
  documentSha256: string | null,
): VerifyRpcArgs {
  return {
    p_id: credentialId,
    p_actor: actorId,
    p_document_sha256: documentSha256,
    p_expected_title: expected.title,
    p_expected_issuer: expected.issuer,
    p_expected_issued_year: expected.issuedYear,
    // The column is a `date`; send YYYY-MM-DD even if the page rendered a timestamp.
    p_expected_expires_on: expected.expiresOn === null ? null : expected.expiresOn.slice(0, 10),
    p_expected_document_path: expected.documentPath,
  };
}

export type VerifyDeps = {
  /** Fresh read of the credential's evidence and owner; null when it does not exist. */
  readEvidence(credentialId: string): Promise<{ evidence: CredentialEvidence; coachId: string } | null>;
  /** Downloads a private credential document; null on failure. */
  downloadDocument(path: string): Promise<Uint8Array | null>;
  sha256(bytes: Uint8Array): string;
  /** Calls admin_verify_coaching_credential; returns the database error message, if any. */
  callVerifyRpc(args: VerifyRpcArgs): Promise<{ errorMessage: string | null }>;
};

export type VerifyOutcome = { ok: true; coachId: string } | { ok: false; error: string };

export async function runCredentialVerification(
  deps: VerifyDeps,
  input: { credentialId: string; actorId: string; expected: CredentialEvidence },
): Promise<VerifyOutcome> {
  const current = await deps.readEvidence(input.credentialId);
  if (!current) return { ok: false, error: "That credential could not be found." };
  if (!credentialEvidenceMatches(input.expected, current.evidence)) {
    return { ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE };
  }

  let sha: string | null = null;
  if (input.expected.documentPath) {
    const bytes = await deps.downloadDocument(input.expected.documentPath);
    if (!bytes) return { ok: false, error: "Document download failed." };
    sha = deps.sha256(bytes);
  }

  const { errorMessage } = await deps.callVerifyRpc(
    buildVerifyRpcArgs(input.credentialId, input.actorId, input.expected, sha),
  );
  if (errorMessage) return { ok: false, error: describeRpcError(errorMessage, "verify") };
  return { ok: true, coachId: current.coachId };
}
