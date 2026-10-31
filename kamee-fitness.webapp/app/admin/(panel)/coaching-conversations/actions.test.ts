import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  getUser: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.server,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: mocks.client }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    unstable_rethrow: actual.unstable_rethrow,
    redirect: (path: string) => {
      throw Object.assign(new Error(`redirect:${path}`), {
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      });
    },
  };
});
// The real requireAdmin gate (including Auth getUser and ADMIN_EMAILS) is exercised here.
import {
  grantConversation,
  revokeConversation,
  listConversationCases,
  readConversationCase,
  resolveConversationCase,
} from "./actions";

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GRANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMAIL = "c1b-operator@fixtures.invalid";
const HASH = "a".repeat(64);
const grantInput = () => ({
  enrollmentAttemptId: ATTEMPT,
  policyVersion: "local-v1",
  contentHash: HASH,
});
const revokeInput = () => ({
  grantId: GRANT,
  expectedRevision: "9007199254740993",
});
const grantData = () => ({
  grantId: GRANT,
  enrollmentAttemptId: ATTEMPT,
  revision: "0",
});
const revokeData = () => ({ grantId: GRANT, revision: "9007199254740994" });
const CASE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NEXT_CASE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CREATED = "2026-10-31T10:15:20.123456789+00:00";
const caseItem = () => ({
  caseId: CASE,
  category: "unsafe_advice",
  status: "open",
  createdAt: CREATED,
});
const caseListData = () => ({ items: [caseItem()], nextAfterId: null });
const selectedMessage = () => ({
  id: GRANT,
  sequence: "9007199254740993",
  createdAt: CREATED,
  kind: "text",
  author: "coach",
  body: " Preserve selected text 📘\n",
});
const caseData = () => ({
  caseId: CASE,
  category: "unsafe_advice",
  status: "open",
  messages: [selectedMessage()],
});
const caseAck = () => ({ caseId: CASE, status: "resolved" });
const caseActions = [
  {
    action: listConversationCases,
    input: () => ({ afterId: null }),
    rpc: "admin_list_coaching_conversation_cases",
    data: caseListData,
  },
  {
    action: readConversationCase,
    input: () => ({ caseId: CASE }),
    rpc: "admin_read_coaching_conversation_case",
    data: caseData,
  },
  {
    action: resolveConversationCase,
    input: () => ({ caseId: CASE, action: "remove" }),
    rpc: "admin_resolve_coaching_conversation_case",
    data: caseAck,
  },
];
const retryActions = [
  ...caseActions,
  { action: grantConversation, input: grantInput, rpc: "admin_grant_coaching_conversation" },
  { action: revokeConversation, input: revokeInput, rpc: "admin_revoke_coaching_conversation" },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ADMIN_EMAILS", EMAIL);
  mocks.server.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: ACTOR, email: EMAIL } },
    error: null,
  });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      caseActions.find((entry) => entry.rpc === name)?.data() ??
      (name === "admin_grant_coaching_conversation"
        ? grantData()
        : revokeData()),
    error: null,
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("selected conversation case Server Actions", () => {
  it.each(caseActions)(
    "gates $rpc using verified Auth and ADMIN_EMAILS before service construction",
    async ({ action, input }) => {
      for (const user of [
        null,
        {
          id: ACTOR,
          email: "member@fixtures.invalid",
          user_metadata: { role: "admin" },
        },
      ]) {
        mocks.getUser.mockResolvedValue({ data: { user }, error: null });
        await expect(action(input())).rejects.toThrow("redirect:/admin/login");
        expect(mocks.client).not.toHaveBeenCalled();
        expect(mocks.rpc).not.toHaveBeenCalled();
      }
    },
  );

  it.each(caseActions)(
    "keeps SQL's actual admin-role/self-case denial for $rpc and hides diagnostics",
    async ({ action, input }) => {
      for (const code of ["42501", "PT403"]) {
        mocks.rpc.mockResolvedValue({
          data: { body: "private selected text" },
          error: {
            code,
            message: "self-case or nonadmin identity",
            details: "private transcript",
          },
        });
        expect(await action(input())).toEqual({
          ok: false,
          error: "Conversation action is not permitted.",
        });
      }
      expect(mocks.rpc).toHaveBeenCalledTimes(2);
      expect(
        mocks.rpc.mock.calls.every((call) => call[1].p_actor_id === ACTOR),
      ).toBe(true);
    },
  );

  it("lists only the exact case metadata with an explicit bound cursor", async () => {
    expect(
      await listConversationCases({ afterId: OTHER.toUpperCase() }),
    ).toEqual({ ok: true, data: caseListData() });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_list_coaching_conversation_cases",
      { p_actor_id: ACTOR, p_after_id: OTHER },
    );
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.client.mock.invocationCallOrder[0],
    );
    expect(await listConversationCases({ afterId: null })).toEqual({
      ok: true,
      data: caseListData(),
    });
    expect(mocks.rpc.mock.lastCall?.[1].p_after_id).toBeNull();
  });

  it("reads only the requested case and preserves selected messages without transcript sorting", async () => {
    const data = {
      ...caseData(),
      messages: [
        selectedMessage(),
        {
          id: OTHER,
          sequence: "1",
          createdAt: CREATED,
          kind: "system",
          event: "opened",
        },
      ],
    };
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await readConversationCase({ caseId: CASE.toUpperCase() })).toEqual({
      ok: true,
      data,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_read_coaching_conversation_case",
      { p_actor_id: ACTOR, p_case_id: CASE },
    );
  });

  it.each(["remove", "restrict", "resolve"])(
    "passes exactly the admitted %s remediation and server-derived actor",
    async (action) => {
      expect(await resolveConversationCase({ caseId: CASE, action })).toEqual({
        ok: true,
        data: caseAck(),
      });
      expect(mocks.rpc).toHaveBeenCalledWith(
        "admin_resolve_coaching_conversation_case",
        { p_actor_id: ACTOR, p_case_id: CASE, p_action: action },
      );
    },
  );

  it.each([
    ["list", null],
    ["list", {}],
    ["list", { afterId: "bad" }],
    ["list", { afterId: null, body: "private" }],
    ["list", { afterId: null, actorId: OTHER }],
    ["list", { afterId: null, role: "admin" }],
    ["read", {}],
    ["read", { caseId: `${CASE}\n` }],
    ["read", { caseId: CASE, p_actor_id: OTHER }],
    ["read", { caseId: CASE, messageIds: [GRANT] }],
    ["read", { caseId: CASE, conversationId: ATTEMPT }],
    ["resolve", { caseId: CASE, action: "delete" }],
    ["resolve", { caseId: CASE, action: "remove\n" }],
    ["resolve", { caseId: CASE, action: "remove", actorId: OTHER }],
    [
      "resolve",
      { caseId: CASE, action: "remove", messages: [selectedMessage()] },
    ],
  ])(
    "rejects malformed or widened %s inputs before service access: %j",
    async (name, input) => {
      const action =
        name === "list"
          ? listConversationCases
          : name === "read"
            ? readConversationCase
            : resolveConversationCase;
      expect(await action(input)).toEqual({
        ok: false,
        error: "Invalid conversation input.",
      });
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...caseListData(), messages: [selectedMessage()] },
    { ...caseListData(), items: [{ ...caseItem(), snippet: "private" }] },
    { ...caseListData(), items: [{ ...caseItem(), buyerId: ACTOR }] },
    { ...caseListData(), items: [{ ...caseItem(), status: "closed" }] },
    { ...caseListData(), items: [{ ...caseItem(), category: "spam" }] },
    { ...caseListData(), items: [caseItem(), caseItem()] },
    {
      ...caseListData(),
      items: [{ ...caseItem(), caseId: NEXT_CASE }, caseItem()],
    },
    { items: [], nextAfterId: CASE },
    { ...caseListData(), nextAfterId: OTHER },
    { ...caseListData(), items: Array.from({ length: 51 }, caseItem) },
  ])(
    "rejects widened, oversized or unordered case metadata %j",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await listConversationCases({ afterId: null })).toEqual({
        ok: false,
        error: "Conversation action could not be confirmed.",
      });
    },
  );

  it("enforces an exclusive case cursor and binds the continuation to the last returned case", async () => {
    expect(await listConversationCases({ afterId: CASE })).toMatchObject({
      ok: false,
    });
    mocks.rpc.mockResolvedValue({
      data: {
        items: [caseItem(), { ...caseItem(), caseId: NEXT_CASE }],
        nextAfterId: NEXT_CASE,
      },
      error: null,
    });
    expect(await listConversationCases({ afterId: OTHER })).toMatchObject({
      ok: true,
    });
    mocks.rpc.mockResolvedValue({
      data: { items: [], nextAfterId: null },
      error: null,
    });
    expect(await listConversationCases({ afterId: NEXT_CASE })).toEqual({
      ok: true,
      data: { items: [], nextAfterId: null },
    });
  });

  it.each([
    null,
    { ...caseData(), caseId: OTHER },
    { ...caseData(), transcript: [selectedMessage()] },
    { ...caseData(), buyerId: ACTOR },
    { ...caseData(), body: "unselected" },
    { ...caseData(), category: "spam" },
    { ...caseData(), status: "closed" },
    { ...caseData(), messages: [] },
    { ...caseData(), messages: Array.from({ length: 21 }, selectedMessage) },
    { ...caseData(), messages: [selectedMessage(), selectedMessage()] },
    {
      ...caseData(),
      messages: [selectedMessage(), { ...selectedMessage(), id: OTHER }],
    },
    ...[
      { author: "admin" },
      { kind: "unknown" },
      { authorId: ACTOR },
      { event: "opened" },
      { sequence: "0" },
      { sequence: "01" },
      { sequence: 1 },
      { sequence: "9223372036854775808" },
      { body: "\uFEFF \n" },
      { body: "\0" },
      { body: "\ud800" },
      { body: "x".repeat(2001) },
      { body: "📘".repeat(2001) },
      { createdAt: "2026-02-30T00:00:00Z" },
      { createdAt: "2026-10-31T24:00:00Z" },
      { createdAt: "2026-10-31T00:00:00+08:00" },
      { createdAt: `${CREATED}\n` },
    ].map((patch) => ({
      ...caseData(),
      messages: [{ ...selectedMessage(), ...patch }],
    })),
    {
      ...caseData(),
      messages: [
        {
          id: GRANT,
          sequence: "1",
          createdAt: CREATED,
          kind: "removed",
          body: "removed body must not escape",
        },
      ],
    },
    {
      ...caseData(),
      messages: [
        {
          id: GRANT,
          sequence: "1",
          createdAt: CREATED,
          kind: "system",
          event: "removed",
        },
      ],
    },
  ])("refuses unbound or malformed selected-case output %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await readConversationCase({ caseId: CASE })).toEqual({
      ok: false,
      error: "Conversation action could not be confirmed.",
    });
  });

  it("accepts exact C1a text boundaries, UTC precision and body-free tombstones", async () => {
    for (const body of ["📘".repeat(2000), "\u0085", " Preserve\n"]) {
      const data = {
        ...caseData(),
        messages: [
          { ...selectedMessage(), body },
          {
            id: OTHER,
            sequence: "2",
            createdAt: "2026-10-31T00:00:00Z",
            kind: "removed",
          },
        ],
      };
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await readConversationCase({ caseId: CASE })).toEqual({
        ok: true,
        data,
      });
    }
  });

  it.each([
    { ...caseAck(), caseId: OTHER },
    { ...caseAck(), status: "closed" },
    { ...caseAck(), body: "private" },
  ])(
    "refuses unbound or widened remediation acknowledgements %j",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(
        await resolveConversationCase({ caseId: CASE, action: "restrict" }),
      ).toEqual({
        ok: false,
        error: "Conversation action could not be confirmed.",
      });
    },
  );

  it.each(caseActions)(
    "retries $rpc at most twice with frozen input and a verified actor before every attempt",
    async ({ action, input: makeInput, data: makeData }) => {
      vi.useFakeTimers();
      const input = makeInput(),
        data = makeData();
      mocks.rpc
        .mockResolvedValueOnce({ data: null, error: { code: "55P03" } })
        .mockResolvedValueOnce({ data: null, error: { code: "PT503" } })
        .mockResolvedValue({ data, error: null });
      const pending = action(input);
      await vi.advanceTimersByTimeAsync(0);
      Object.assign(input, {
        caseId: OTHER,
        afterId: OTHER,
        action: "resolve",
      });
      await vi.runAllTimersAsync();
      expect(await pending).toEqual({ ok: true, data });
      expect(mocks.rpc).toHaveBeenCalledTimes(3);
      expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
      expect(mocks.rpc.mock.calls[2]).toEqual(mocks.rpc.mock.calls[0]);
      expect(mocks.getUser).toHaveBeenCalledTimes(4);
    },
  );

  it.each(caseActions)(
    "stops $rpc retry after the verified account changes",
    async ({ action, input }) => {
      vi.useFakeTimers();
      mocks.rpc.mockResolvedValue({ data: null, error: { code: "55P03" } });
      const pending = action(input());
      await vi.advanceTimersByTimeAsync(0);
      mocks.getUser.mockResolvedValue({
        data: { user: { id: OTHER, email: EMAIL } },
        error: null,
      });
      await vi.runAllTimersAsync();
      expect(await pending).toMatchObject({ ok: false });
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["PT403", "PT409", "57014", "UNKNOWN_COMMIT"])(
    "never retries uncertain or denied case resolution (%s)",
    async (code) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code, details: "private selected message" },
      });
      const result = await resolveConversationCase({
        caseId: CASE,
        action: "remove",
      });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private");
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    },
  );
});

describe("conversation operator Server Actions", () => {
  it.each(retryActions)("preserves the framework login redirect when verified Auth disappears during $rpc backoff", async ({ action, input }) => {
    vi.useFakeTimers();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "55P03" } });
    const pending = action(input()).then(value => ({ value }), error => ({ error }));
    await vi.advanceTimersByTimeAsync(0);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await vi.runAllTimersAsync();
    const outcome = await pending;
    expect("error" in outcome && outcome.error instanceof Error && outcome.error.message).toBe("redirect:/admin/login");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([grantConversation, revokeConversation])(
    "denies anonymous and nonallowlisted users before constructing a service client",
    async (action) => {
      for (const user of [
        null,
        {
          id: ACTOR,
          email: "member@fixtures.invalid",
          user_metadata: { role: "admin" },
        },
      ]) {
        mocks.getUser.mockResolvedValue({ data: { user }, error: null });
        await expect(action(grantInput())).rejects.toThrow(
          "redirect:/admin/login",
        );
        expect(mocks.client).not.toHaveBeenCalled();
        expect(mocks.rpc).not.toHaveBeenCalled();
      }
    },
  );

  it("derives grant actor only from the verified gate and returns the exact projection", async () => {
    expect(await grantConversation(grantInput())).toEqual({
      ok: true,
      data: grantData(),
    });
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.client.mock.invocationCallOrder[0],
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_grant_coaching_conversation",
      {
        p_actor_id: ACTOR,
        p_attempt_id: ATTEMPT,
        p_policy_version: "local-v1",
        p_policy_hash: HASH,
      },
    );
  });

  it("passes the exact int64 revoke revision and binds the returned grant", async () => {
    expect(await revokeConversation(revokeInput())).toEqual({
      ok: true,
      data: revokeData(),
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_revoke_coaching_conversation",
      {
        p_actor_id: ACTOR,
        p_grant_id: GRANT,
        p_expected_revision: "9007199254740993",
      },
    );
  });

  it.each([
    null,
    [],
    {},
    { ...grantInput(), actorId: OTHER },
    { ...grantInput(), p_actor_id: OTHER },
    { ...grantInput(), role: "admin" },
    { ...grantInput(), enrollmentAttemptId: `${ATTEMPT}\n` },
    { ...grantInput(), policyVersion: "v1\n" },
    { ...grantInput(), policyVersion: "v".repeat(81) },
    { ...grantInput(), contentHash: HASH.toUpperCase() },
    { ...grantInput(), contentHash: `${HASH}\n` },
    { ...grantInput(), body: "copied policy" },
  ])(
    "rejects malformed grant input and caller-supplied authority %j",
    async (input) => {
      expect(await grantConversation(input)).toEqual({
        ok: false,
        error: "Invalid conversation input.",
      });
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    {},
    { ...revokeInput(), actorId: OTHER },
    { ...revokeInput(), grantId: "bad" },
    ...["01", "-1", "1\n", "9223372036854775808", 1].map(
      (expectedRevision) => ({ ...revokeInput(), expectedRevision }),
    ),
  ])(
    "rejects malformed revoke input before service access %j",
    async (input) => {
      expect(await revokeConversation(input)).toEqual({
        ok: false,
        error: "Invalid conversation input.",
      });
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("normalizes UUID identity while preserving exact policy version and hash", async () => {
    expect(
      await grantConversation({
        ...grantInput(),
        enrollmentAttemptId: ATTEMPT.toUpperCase(),
      }),
    ).toEqual({ ok: true, data: grantData() });
    expect(mocks.rpc.mock.calls[0][1].p_attempt_id).toBe(ATTEMPT);
  });

  it.each([
    { ...grantData(), enrollmentAttemptId: OTHER },
    { ...grantData(), revision: "01" },
    { ...grantData(), buyerName: "private" },
    { ...grantData(), grantId: `${GRANT}\n` },
    null,
  ])("refuses unbound or widened grant results %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await grantConversation(grantInput())).toEqual({
      ok: false,
      error: "Conversation action could not be confirmed.",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses an unrelated or widened revoke result", async () => {
    for (const data of [
      { ...revokeData(), grantId: OTHER },
      { ...revokeData(), revoked: true },
    ]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await revokeConversation(revokeInput())).toEqual({
        ok: false,
        error: "Conversation action could not be confirmed.",
      });
    }
  });

  it.each([grantConversation, revokeConversation])(
    "retries only a definitive busy rollback with frozen actor and input",
    async (action) => {
      vi.useFakeTimers();
      const input = action === grantConversation ? grantInput() : revokeInput();
      const data = action === grantConversation ? grantData() : revokeData();
      mocks.rpc
        .mockResolvedValueOnce({ data: null, error: { code: "55P03" } })
        .mockResolvedValueOnce({ data: null, error: { code: "PT503" } })
        .mockResolvedValue({ data, error: null });
      const result = action(input);
      await vi.advanceTimersByTimeAsync(0);
      if ("policyVersion" in input) input.policyVersion = "mutated";
      else input.expectedRevision = "0";
      await vi.runAllTimersAsync();
      expect(await result).toEqual({ ok: true, data });
      expect(mocks.rpc).toHaveBeenCalledTimes(3);
      expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
      expect(mocks.rpc.mock.calls[2]).toEqual(mocks.rpc.mock.calls[0]);
      expect(mocks.getUser).toHaveBeenCalledTimes(4);
    },
  );

  it("stops a delayed retry after the verified actor changes", async () => {
    vi.useFakeTimers();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "55P03" } });
    const result = grantConversation(grantInput());
    await vi.advanceTimersByTimeAsync(0);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: OTHER, email: EMAIL } },
      error: null,
    });
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: "PT403" },
    { code: "PT409" },
    { code: "57014" },
    { status: 503 },
    { message: "timeout with unknown commit" },
  ])(
    "does not retry nonbusy errors or leak raw diagnostics %j",
    async (error) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { ...error, message: "sensitive database detail" },
      });
      const result = await grantConversation(grantInput());
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("data");
      expect(JSON.stringify(result)).not.toContain("sensitive");
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    },
  );
});

const ownedWebProofNames = [
  "anonymous_before_service", "nonallowlisted_before_service",
  "allowlisted_nonadmin_sql_denial", "actor_derived_after_verified_auth",
  "member_direct_operator_rpc_denied", "self_case_sql_denial",
  "grant_revoke_roundtrip", "selected_case_read_remove_resolve",
] as const;

const ownedContextShapeFixture = () => ({
  relayOrigin: "http://127.0.0.1:45678", anonKey: "unit-anon", serviceKey: "unit-service",
  operator: { userId: ACTOR, email: "operator@fixtures.invalid", accessToken: "unit.operator" },
  nonAllowlisted: { userId: ATTEMPT, email: "coach@fixtures.invalid", accessToken: "unit.coach" },
  allowlistedNonadmin: { userId: GRANT, email: "member@fixtures.invalid", accessToken: "unit.member" },
  selfOperator: { userId: OTHER, email: "self@fixtures.invalid", accessToken: "unit.self" },
  grantTarget: grantInput(), selectedCase: { caseId: CASE, messageIds: [GRANT] },
  requiredProofNames: [...ownedWebProofNames],
});

describe("owned adapter private input boundary (pure)", () => {
  it("accepts the exact child-environment contract with one explicit loopback relay", () => {
    const input = ownedContextShapeFixture();
    expect(parseOwnedWebContext(JSON.stringify(input))).toEqual(input);
  });
  it("rejects remote, credentialed, widened and unbound contexts without echoing input", () => {
    const invalid: unknown[] = [undefined, "{", JSON.stringify(null), JSON.stringify([])];
    for (const relayOrigin of ["https://127.0.0.1:45678", "http://localhost:45678", "http://example.invalid:45678",
      "http://private-value@127.0.0.1:45678", "http://127.0.0.1", "http://127.0.0.1:45678/rest/v1", "http://127.0.0.1:45678?x=1"])
      invalid.push(JSON.stringify({ ...ownedContextShapeFixture(), relayOrigin }));
    invalid.push(JSON.stringify({ ...ownedContextShapeFixture(), rawToken: "private-value" }));
    invalid.push(JSON.stringify({ ...ownedContextShapeFixture(), requiredProofNames: [] }));
    const duplicate = ownedContextShapeFixture(); duplicate.selfOperator = { ...duplicate.operator };
    invalid.push(JSON.stringify(duplicate));
    const newlineId = ownedContextShapeFixture(); newlineId.operator.userId += "\n";
    invalid.push(JSON.stringify(newlineId));
    for (const raw of invalid) {
      let message = "";
      try { parseOwnedWebContext(raw as string); } catch (error) { message = error instanceof Error ? error.message : ""; }
      expect(message).toBe("Invalid owned web acceptance context");
    }
  });
});

type OwnedWebContext = ReturnType<typeof ownedContextShapeFixture>;
function parseOwnedWebContext(raw: string | undefined): OwnedWebContext {
  // Never include a parser value or exception cause in diagnostics: raw contains
  // four real access tokens and the owned synthetic service/anon keys.
  try {
    const check = (condition: unknown): void => { if (!condition) throw new Error(); };
    const object = (value: unknown, keys: string[]): Record<string, unknown> => {
      check(value && typeof value === "object" && !Array.isArray(value));
      const record = value as Record<string, unknown>;
      check(Object.keys(record).length === keys.length && Object.keys(record).every(key => keys.includes(key)));
      return record;
    };
    const uuid = (value: unknown) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
    const token = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 16384
      && /^[A-Za-z0-9._~-]+$/.exec(value)?.[0] === value;
    check(typeof raw === "string" && raw.length > 0 && raw.length <= 32768);
    const value = object(JSON.parse(raw!), ["relayOrigin", "anonKey", "serviceKey", "operator", "nonAllowlisted",
      "allowlistedNonadmin", "selfOperator", "grantTarget", "selectedCase", "requiredProofNames"]);
    check(typeof value.relayOrigin === "string");
    const url = new URL(value.relayOrigin as string);
    check(url.protocol === "http:" && url.hostname === "127.0.0.1" && /^[1-9][0-9]*$/.test(url.port)
      && Number(url.port) <= 65535 && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
      && value.relayOrigin === url.origin);
    check(token(value.anonKey) && token(value.serviceKey) && value.anonKey !== value.serviceKey);
    const actors = ["operator", "nonAllowlisted", "allowlistedNonadmin", "selfOperator"].map(key => {
      const actor = object(value[key], ["userId", "email", "accessToken"]);
      check(uuid(actor.userId) && token(actor.accessToken));
      check(typeof actor.email === "string" && /^[^,\s@]+@[^,\s@]+\.invalid$/.exec(actor.email)?.[0] === actor.email);
      return actor;
    });
    check(new Set(actors.map(actor => actor.userId)).size === actors.length);
    check(new Set(actors.map(actor => String(actor.email).toLowerCase())).size === actors.length);
    check(new Set(actors.map(actor => actor.accessToken)).size === actors.length);
    const grant = object(value.grantTarget, ["enrollmentAttemptId", "policyVersion", "contentHash"]);
    check(uuid(grant.enrollmentAttemptId));
    check(typeof grant.policyVersion === "string" && grant.policyVersion.length <= 80
      && /^[A-Za-z0-9._-]+$/.exec(grant.policyVersion)?.[0] === grant.policyVersion);
    check(typeof grant.contentHash === "string" && /^[a-f0-9]{64}$/.exec(grant.contentHash)?.[0] === grant.contentHash);
    const selected = object(value.selectedCase, ["caseId", "messageIds"]);
    check(uuid(selected.caseId) && Array.isArray(selected.messageIds));
    check((selected.messageIds as unknown[]).length >= 1 && (selected.messageIds as unknown[]).length <= 20
      && (selected.messageIds as unknown[]).every(uuid)
      && new Set(selected.messageIds as unknown[]).size === (selected.messageIds as unknown[]).length);
    check(JSON.stringify(value.requiredProofNames) === JSON.stringify(ownedWebProofNames));
    return structuredClone(value) as OwnedWebContext;
  } catch { throw new Error("Invalid owned web acceptance context"); }
}

// Explicit opt-in after root admits the disposable fixture and loopback relay.
// The real requireAdmin/actions, Auth getUser, service factory and SDK RPCs run.
// The supplied server factory is the request-identity boundary; this does not
// attest Next's production cookie or Server Action wire protocol.
const ownedWebSuite = "owned local HTTP/Auth adapter";
type OwnedProofName = (typeof ownedWebProofNames)[number];
type OwnedActorKey = "operator" | "nonAllowlisted" | "allowlistedNonadmin" | "selfOperator";
type OwnedObservation = { path: string; method: string; status: number; code: string | null; actorId: string | null };
const ownedRpcPaths = new Set([
  "admin_grant_coaching_conversation", "admin_revoke_coaching_conversation",
  "admin_list_coaching_conversation_cases", "admin_read_coaching_conversation_case",
  "admin_resolve_coaching_conversation_case",
].map(name => "/rest/v1/rpc/" + name));
function ownedCheck(condition: unknown): asserts condition {
  if (!condition) throw new Error("Owned web acceptance condition failed");
}
function assertOwnedRelayRequest(origin: string, request: Request): void {
  const url = new URL(request.url);
  ownedCheck(url.origin === origin && !url.username && !url.password && !url.search && !url.hash);
  ownedCheck((request.method === "GET" && url.pathname === "/auth/v1/user")
    || (request.method === "POST" && ownedRpcPaths.has(url.pathname)));
}

// No helper or client is created by the default pure test path.
async function withOwnedWebAcceptance(work: (fixture: {
  context: OwnedWebContext;
  observations: OwnedObservation[];
  verifiedIds: string[];
  invoke<T>(actor: OwnedActorKey | undefined, action: () => Promise<T>): Promise<T>;
  directMemberDenial(): Promise<{ code: string | null; status: number }>;
}) => Promise<void>): Promise<void> {
  const context = parseOwnedWebContext(process.env.C1B_WEB_PRIVATE_CONTEXT_JSON);
  const nativeFetch = globalThis.fetch;
  const observations: OwnedObservation[] = [], verifiedIds: string[] = [];
  const closedFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    assertOwnedRelayRequest(context.relayOrigin, request);
    const url = new URL(request.url);
    let actorId: string | null = null;
    if (request.method === "POST") {
      const bytes = await request.clone().text();
      ownedCheck(Buffer.byteLength(bytes, "utf8") <= 8192);
      const args = JSON.parse(bytes) as Record<string, unknown>;
      ownedCheck(args && typeof args === "object" && !Array.isArray(args));
      actorId = typeof args.p_actor_id === "string" ? args.p_actor_id : null;
    }
    const response = await nativeFetch(request, { redirect: "error", signal: AbortSignal.timeout(15000) });
    let code: string | null = null;
    if (response.status >= 400) {
      const detail = await response.clone().json().catch(() => null) as { code?: unknown } | null;
      if (typeof detail?.code === "string" && /^[A-Z0-9]{5,8}$/.test(detail.code)) code = detail.code;
    }
    observations.push({ path: url.pathname, method: request.method, status: response.status, code, actorId });
    return response;
  };
  vi.stubGlobal("fetch", closedFetch);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", context.relayOrigin);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", context.anonKey);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", context.serviceKey);
  vi.stubEnv("ADMIN_EMAILS", [context.operator.email, context.allowlistedNonadmin.email, context.selfOperator.email].join(","));
  const { createClient } = await import("@supabase/supabase-js");
  const verifier = createClient(context.relayOrigin, context.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: closedFetch },
  });
  const clients: Array<{ auth: { stopAutoRefresh(): Promise<void> } }> = [verifier];
  let actor: OwnedWebContext[OwnedActorKey] | undefined;
  mocks.getUser.mockImplementation(async () => {
    // The SDK's missing-session result supplies anonymous identity. Every
    // supplied token is verified by real Auth, never a caller-authored User.
    const result = await verifier.auth.getUser(actor?.accessToken);
    if (actor) {
      ownedCheck(!result.error && result.data.user?.id === actor.userId
        && result.data.user.email?.toLowerCase() === actor.email.toLowerCase());
      verifiedIds.push(result.data.user.id);
    } else ownedCheck(result.data.user === null);
    return result;
  });
  mocks.server.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  const actual = await vi.importActual<typeof import("@/lib/supabase/admin")>("@/lib/supabase/admin");
  mocks.client.mockImplementation(() => {
    const client = actual.createAdminSupabase(); clients.push(client); return client;
  });
  // mocks.rpc is deliberately not installed on any actual client.
  try {
    await work({ context, observations, verifiedIds,
      async invoke(next, action) { actor = next ? context[next] : undefined; return action(); },
      async directMemberDenial() {
        const member = context.allowlistedNonadmin;
        const verified = await verifier.auth.getUser(member.accessToken);
        ownedCheck(!verified.error && verified.data.user?.id === member.userId);
        const result = await verifier.rpc("admin_list_coaching_conversation_cases", {
          p_actor_id: context.operator.userId, p_after_id: null,
        }).setHeader("Authorization", "Bearer " + member.accessToken);
        return { code: result.error?.code ?? null, status: result.status };
      },
    });
    ownedCheck(mocks.rpc.mock.calls.length === 0);
  } finally {
    await Promise.all(clients.map(client => client.auth.stopAutoRefresh()));
  }
}

describe("owned adapter relay request boundary (pure)", () => {
  it("admits only the exact Auth lookup and five operator POST paths at the selected loopback origin", () => {
    const origin = "http://127.0.0.1:45678";
    expect(() => assertOwnedRelayRequest(origin, new Request(origin + "/auth/v1/user"))).not.toThrow();
    for (const path of ownedRpcPaths) expect(() => assertOwnedRelayRequest(origin,
      new Request(origin + path, { method: "POST", body: "{}" }))).not.toThrow();
    for (const [url, method] of [[origin + "/auth/v1/admin/users", "GET"], [origin + "/rest/v1/profiles", "GET"],
      [origin + "/auth/v1/user?redirect=elsewhere", "GET"], [origin + "/rest/v1/rpc/admin_list_coaching_conversation_cases", "DELETE"],
      ["http://127.0.0.1:45679/auth/v1/user", "GET"], ["https://example.invalid/auth/v1/user", "GET"]])
      expect(() => assertOwnedRelayRequest(origin, new Request(url, { method }))).toThrow("Owned web acceptance condition failed");
  });
});

describe.skipIf(process.env.C1B_WEB_LOCAL_ADAPTER !== "1")(ownedWebSuite, () => {
  const completed = new Set<OwnedProofName>();
  for (const proofName of ownedWebProofNames) {
    it(proofName, async () => {
      // Redact assertion/SDK failure diagnostics before Vitest can serialize a
      // mock's real-token arguments, request context, or a selected case body.
      try {
        await withOwnedWebAcceptance(async h => {
          const input = h.context.grantTarget, caseId = h.context.selectedCase.caseId;
          const rpcObservations = () => h.observations.filter(row => row.method === "POST");
          switch (proofName) {
            case "anonymous_before_service": {
              for (const action of [() => grantConversation(input), () => readConversationCase({ caseId })]) {
                await expect(h.invoke<unknown>(undefined, action)).rejects.toThrow("redirect:/admin/login");
              }
              ownedCheck(mocks.getUser.mock.calls.length === 2 && mocks.client.mock.calls.length === 0 && rpcObservations().length === 0);
              break;
            }
            case "nonallowlisted_before_service": {
              for (const action of [() => grantConversation(input), () => readConversationCase({ caseId })])
                await expect(h.invoke<unknown>("nonAllowlisted", action)).rejects.toThrow("redirect:/admin/login?error=not-authorized");
              ownedCheck(h.verifiedIds.length === 2 && h.verifiedIds.every(id => id === h.context.nonAllowlisted.userId));
              ownedCheck(mocks.client.mock.calls.length === 0 && rpcObservations().length === 0);
              break;
            }
            case "allowlisted_nonadmin_sql_denial": {
              const result = await h.invoke("allowlistedNonadmin", () => listConversationCases({ afterId: null }));
              ownedCheck(!result.ok && result.error === "Conversation action is not permitted.");
              ownedCheck(mocks.client.mock.calls.length === 1);
              const rows = rpcObservations(); ownedCheck(rows.length === 1 && rows[0].status === 403
                && rows[0].code === "PT403" && rows[0].actorId === h.context.allowlistedNonadmin.userId);
              break;
            }
            case "actor_derived_after_verified_auth": {
              for (const extra of [{ actorId: h.context.selfOperator.userId }, { p_actor_id: h.context.selfOperator.userId }, { role: "admin" }]) {
                const denied = await h.invoke("operator", () => grantConversation({ ...input, ...extra }));
                ownedCheck(!denied.ok && denied.error === "Invalid conversation input.");
              }
              ownedCheck(mocks.client.mock.calls.length === 0 && rpcObservations().length === 0);
              const listed = await h.invoke("operator", () => listConversationCases({ afterId: null }));
              ownedCheck(listed.ok && listed.data.items.some(item => item.caseId === caseId));
              ownedCheck(h.verifiedIds.length >= 5 && h.verifiedIds.every(id => id === h.context.operator.userId));
              ownedCheck(mocks.getUser.mock.invocationCallOrder[0] < mocks.client.mock.invocationCallOrder[0]);
              ownedCheck(rpcObservations().length === 1 && rpcObservations()[0].actorId === h.context.operator.userId);
              break;
            }
            case "member_direct_operator_rpc_denied": {
              const denied = await h.directMemberDenial();
              ownedCheck(denied.code === "42501" && denied.status === 403);
              ownedCheck(mocks.client.mock.calls.length === 0);
              ownedCheck(rpcObservations().length === 1 && rpcObservations()[0].code === "42501");
              break;
            }
            case "self_case_sql_denial": {
              const listed = await h.invoke("selfOperator", () => listConversationCases({ afterId: null }));
              ownedCheck(listed.ok && !listed.data.items.some(item => item.caseId === caseId));
              const read = await h.invoke("selfOperator", () => readConversationCase({ caseId }));
              const remove = await h.invoke("selfOperator", () => resolveConversationCase({ caseId, action: "remove" }));
              ownedCheck(!read.ok && read.error === "Conversation action is not permitted.");
              ownedCheck(!remove.ok && remove.error === "Conversation action is not permitted.");
              const denied = rpcObservations().filter(row => row.status === 403);
              ownedCheck(denied.length === 2 && denied.every(row => row.code === "PT403" && row.actorId === h.context.selfOperator.userId));
              break;
            }
            case "grant_revoke_roundtrip": {
              const grant = await h.invoke("operator", () => grantConversation(input));
              ownedCheck(grant.ok && grant.data.enrollmentAttemptId === input.enrollmentAttemptId);
              const again = await h.invoke("operator", () => grantConversation(input));
              ownedCheck(again.ok && JSON.stringify(again.data) === JSON.stringify(grant.data));
              const revokeInput = { grantId: grant.data.grantId, expectedRevision: grant.data.revision };
              const revoked = await h.invoke("operator", () => revokeConversation(revokeInput));
              ownedCheck(revoked.ok && revoked.data.grantId === grant.data.grantId
                && revoked.data.revision === (BigInt(grant.data.revision) + BigInt(1)).toString());
              const replay = await h.invoke("operator", () => revokeConversation(revokeInput));
              ownedCheck(replay.ok && JSON.stringify(replay.data) === JSON.stringify(revoked.data));
              ownedCheck(rpcObservations().length === 4 && rpcObservations().every(row => row.status === 200 && row.actorId === h.context.operator.userId));
              break;
            }
            case "selected_case_read_remove_resolve": {
              const selected = await h.invoke("operator", () => readConversationCase({ caseId }));
              ownedCheck(selected.ok && selected.data.caseId === caseId && selected.data.status === "open");
              const selectedIds = [...h.context.selectedCase.messageIds].sort();
              ownedCheck(JSON.stringify(selected.data.messages.map(message => message.id).sort()) === JSON.stringify(selectedIds)
                && selected.data.messages.every(message => message.kind === "text"));
              const removed = await h.invoke("operator", () => resolveConversationCase({ caseId, action: "remove" }));
              ownedCheck(removed.ok && removed.data.status === "open");
              const reread = await h.invoke("operator", () => readConversationCase({ caseId }));
              ownedCheck(reread.ok && JSON.stringify(reread.data.messages.map(message => message.id).sort()) === JSON.stringify(selectedIds)
                && reread.data.messages.every(message => message.kind === "removed" && !Object.hasOwn(message, "body")
                  && !Object.hasOwn(message, "author") && !Object.hasOwn(message, "event")));
              const resolved = await h.invoke("operator", () => resolveConversationCase({ caseId, action: "resolve" }));
              ownedCheck(resolved.ok && resolved.data.status === "resolved");
              const conflict = await h.invoke("operator", () => resolveConversationCase({ caseId, action: "remove" }));
              ownedCheck(!conflict.ok && conflict.error === "Conversation changed. Refresh and try again.");
              const rows = rpcObservations();
              ownedCheck(rows.length === 5 && rows.at(-1)?.status === 409 && rows.at(-1)?.code === "PT409"
                && rows.every(row => row.actorId === h.context.operator.userId));
              break;
            }
          }
        });
        completed.add(proofName);
      } catch { throw new Error("Owned web acceptance failed: " + proofName); }
    }, 45000);
  }
  afterAll(() => {
    if (completed.size !== ownedWebProofNames.length) return;
    // Only these constant names/booleans escape. No IDs, Auth objects, raw
    // private context, tokens, keys, SQL diagnostics or selected bodies.
    console.log("C1B_WEB_ACCEPTANCE_JSON=" + JSON.stringify({
      testNames: ownedWebProofNames.map(name => ownedWebSuite + " > " + name),
      proofs: ownedWebProofNames.map(name => ({ name, passed: true })),
    }));
  });
});
