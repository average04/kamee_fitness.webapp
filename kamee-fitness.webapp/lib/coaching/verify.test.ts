import { describe, expect, it, vi } from "vitest";
import { CREDENTIAL_EVIDENCE_CHANGED_MESSAGE, type CredentialEvidence } from "./admin";
import { buildVerifyRpcArgs, runCredentialVerification, type VerifyDeps, type VerifyRpcArgs } from "./verify";

const CRED = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const COACH = "33333333-3333-4333-8333-333333333333";
const DOC = `${COACH}/${CRED}/44444444-4444-4444-8444-444444444444.pdf`;

const reviewed: CredentialEvidence = {
  documentPath: DOC,
  title: "CPT",
  issuer: "NASM",
  issuedYear: 2021,
  expiresOn: "2027-01-31",
};

/**
 * An in-memory stand-in for one coaching_credentials row plus a verify RPC
 * that follows the database contract of admin_verify_coaching_credential
 * (migration 20260913100400): compare the expected evidence with the current
 * row and either verify or raise evidence_changed. The SQL side of that
 * contract, including the row lock, is covered by
 * supabase/tests/coaching_review_freeze_verification.sql [V3]-[V7] and
 * supabase/tests/coaching_verify_race.sh in the app repository.
 */
function fakeDb(initial: CredentialEvidence) {
  const row = { ...initial, isVerified: false };
  const rpcCalls: VerifyRpcArgs[] = [];
  const hooks: { afterDownload?: () => void; beforeRpc?: () => void } = {};
  const deps: VerifyDeps = {
    readEvidence: vi.fn(async () => ({
      evidence: {
        documentPath: row.documentPath,
        title: row.title,
        issuer: row.issuer,
        issuedYear: row.issuedYear,
        expiresOn: row.expiresOn,
      },
      coachId: COACH,
    })),
    downloadDocument: vi.fn(async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      hooks.afterDownload?.();
      return bytes;
    }),
    sha256: vi.fn(() => "a".repeat(64)),
    callVerifyRpc: vi.fn(async (args: VerifyRpcArgs) => {
      hooks.beforeRpc?.();
      rpcCalls.push(args);
      const matches =
        args.p_expected_title === row.title &&
        args.p_expected_issuer === row.issuer &&
        args.p_expected_issued_year === row.issuedYear &&
        args.p_expected_expires_on === row.expiresOn &&
        args.p_expected_document_path === row.documentPath;
      if (!matches) return { errorMessage: "evidence_changed" };
      row.isVerified = true;
      return { errorMessage: null };
    }),
  };
  return { row, deps, rpcCalls, hooks };
}

describe("buildVerifyRpcArgs", () => {
  it("sends the reviewed evidence and the digest to the 8-argument function", () => {
    expect(buildVerifyRpcArgs(CRED, ACTOR, reviewed, "b".repeat(64))).toEqual({
      p_id: CRED,
      p_actor: ACTOR,
      p_document_sha256: "b".repeat(64),
      p_expected_title: "CPT",
      p_expected_issuer: "NASM",
      p_expected_issued_year: 2021,
      p_expected_expires_on: "2027-01-31",
      p_expected_document_path: DOC,
    });
  });

  it("sends expiry as a date and passes nulls through", () => {
    const args = buildVerifyRpcArgs(CRED, ACTOR, { ...reviewed, expiresOn: "2027-01-31T00:00:00+00:00", documentPath: null, issuedYear: null }, null);
    expect(args.p_expected_expires_on).toBe("2027-01-31");
    expect(args.p_expected_document_path).toBeNull();
    expect(args.p_expected_issued_year).toBeNull();
    expect(args.p_document_sha256).toBeNull();
  });
});

describe("runCredentialVerification", () => {
  it("regression: a coach edit after the action's final read is refused, not verified", async () => {
    const db = fakeDb(reviewed);
    // The coach edits the title after the action's last read (while the
    // document downloads) -- the window the old two-step flow left open.
    db.hooks.afterDownload = () => {
      db.row.title = "CPT (edited)";
    };

    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });

    expect(outcome).toEqual({ ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE });
    expect(db.row.isVerified).toBe(false);
    // The action forwarded what the admin reviewed, so the database compared
    // against that -- not against a later read.
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0].p_expected_title).toBe("CPT");
  });

  it("regression: an edit landing between the last read and the RPC is refused too", async () => {
    const db = fakeDb(reviewed);
    db.hooks.beforeRpc = () => {
      db.row.issuer = "Someone else";
    };
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(outcome).toEqual({ ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE });
    expect(db.row.isVerified).toBe(false);
  });

  it("verifies unchanged evidence with the downloaded document's digest", async () => {
    const db = fakeDb(reviewed);
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(outcome).toEqual({ ok: true, coachId: COACH });
    expect(db.row.isVerified).toBe(true);
    expect(db.deps.downloadDocument).toHaveBeenCalledWith(DOC);
    expect(db.rpcCalls[0].p_document_sha256).toBe("a".repeat(64));
  });

  it("stops before downloading when the page is already stale", async () => {
    const db = fakeDb({ ...reviewed, title: "Changed before click" });
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(outcome).toEqual({ ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE });
    expect(db.deps.downloadDocument).not.toHaveBeenCalled();
    expect(db.deps.callVerifyRpc).not.toHaveBeenCalled();
  });

  it("skips the download and sends no digest when there is no document", async () => {
    const noDoc = { ...reviewed, documentPath: null };
    const db = fakeDb(noDoc);
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: noDoc });
    expect(outcome.ok).toBe(true);
    expect(db.deps.downloadDocument).not.toHaveBeenCalled();
    expect(db.rpcCalls[0].p_document_sha256).toBeNull();
  });

  it("does not call the RPC when the download fails", async () => {
    const db = fakeDb(reviewed);
    db.deps.downloadDocument = vi.fn(async () => null);
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(outcome).toEqual({ ok: false, error: "Document download failed." });
    expect(db.deps.callVerifyRpc).not.toHaveBeenCalled();
  });

  it("reports a missing credential", async () => {
    const db = fakeDb(reviewed);
    db.deps.readEvidence = vi.fn(async () => null);
    const outcome = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(outcome).toEqual({ ok: false, error: "That credential could not be found." });
  });

  it("maps database errors to admin copy without leaking raw text", async () => {
    const db = fakeDb(reviewed);
    db.deps.callVerifyRpc = vi.fn(async () => ({ errorMessage: "bad_digest" }));
    const digest = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(digest).toEqual({ ok: false, error: "The document could not be checked. Reload and try again." });

    db.deps.callVerifyRpc = vi.fn(async () => ({ errorMessage: 'duplicate key value violates unique constraint "x"' }));
    const other = await runCredentialVerification(db.deps, { credentialId: CRED, actorId: ACTOR, expected: reviewed });
    expect(other).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
