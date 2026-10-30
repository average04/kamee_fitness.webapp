import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";

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
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
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

// Explicitly opt in only after the owning C1b verifier has admitted its disposable
// local target and provisioned genuine Auth users, admin role, purchase and policy.
// This HTTP adapter exercises the real gate + Auth + service client + RPCs. It does
// not claim to test Next's production cookie transport or Server Action routing.
// Task6 case-path HTTP acceptance is explicitly deferred to Task7's admitted
// selected-case fixture. This existing grant/revoke scenario supplies no case
// self-participant or selected-message SQL authorization evidence.
describe.skipIf(process.env.C1B_WEB_LOCAL_ADAPTER !== "1")(
  "owned local HTTP/Auth adapter",
  () => {
    it("denies anonymous, nonallowlisted and forged-actor calls before service construction, then grants and revokes as the actual operator", async () => {
      const required = (name: string): string => {
        const value = process.env[name];
        if (!value)
          throw new Error(`Missing owned local fixture variable: ${name}`);
        return value;
      };
      const url = new URL(required("C1B_LOCAL_SUPABASE_URL"));
      if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        !url.port ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error(
          "Owned local adapter requires an explicit loopback Supabase URL",
        );
      }
      const anonKey = required("C1B_LOCAL_ANON_KEY");
      const serviceKey = required("C1B_LOCAL_SERVICE_ROLE_KEY");
      const adminToken = required("C1B_LOCAL_ADMIN_TOKEN");
      const memberToken = required("C1B_LOCAL_MEMBER_TOKEN");
      const adminEmail = required("C1B_LOCAL_ADMIN_EMAIL");
      if (!/^[^,\s@]+@[^,\s@]+$/.test(adminEmail)) {
        throw new Error(
          "Owned local adapter requires one explicit synthetic operator email",
        );
      }
      const input = {
        enrollmentAttemptId: required("C1B_LOCAL_ATTEMPT_ID"),
        policyVersion: required("C1B_LOCAL_POLICY_VERSION"),
        contentHash: required("C1B_LOCAL_POLICY_HASH"),
      };
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url.origin);
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
      vi.stubEnv("ADMIN_EMAILS", adminEmail);
      const { createClient } = await import("@supabase/supabase-js");
      const verifier = createClient(url.origin, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const actual = await vi.importActual<
        typeof import("@/lib/supabase/admin")
      >("@/lib/supabase/admin");
      mocks.client.mockImplementation(actual.createAdminSupabase);

      const server = createServer(async (request, response) => {
        const send = (status: number, body: unknown) => {
          response.writeHead(status, { "content-type": "application/json" });
          response.end(JSON.stringify(body));
        };
        try {
          if (request.method !== "POST") {
            send(405, { error: "Method not allowed" });
            return;
          }
          const token =
            request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
          mocks.server.mockResolvedValue({
            auth: {
              getUser: () =>
                token
                  ? verifier.auth.getUser(token)
                  : Promise.resolve({ data: { user: null }, error: null }),
            },
          });
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            const bytes = Buffer.from(chunk);
            size += bytes.length;
            if (size > 8192) {
              send(413, { error: "Input too large" });
              return;
            }
            chunks.push(bytes);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            action?: unknown;
            input?: unknown;
          };
          if (body.action !== "grant" && body.action !== "revoke") {
            send(400, { error: "Invalid action" });
            return;
          }
          const result =
            body.action === "grant"
              ? await grantConversation(body.input)
              : await revokeConversation(body.input);
          send(result.ok ? 200 : 400, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          send(
            message === "redirect:/admin/login"
              ? 401
              : message === "redirect:/admin/login?error=not-authorized"
                ? 403
                : 500,
            { error: "Request denied" },
          );
        }
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      try {
        const address = server.address();
        if (!address || typeof address === "string")
          throw new Error("Local adapter did not bind TCP");
        const post = (action: string, value: unknown, token?: string) =>
          fetch(`http://127.0.0.1:${address.port}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ action, input: value }),
          });
        expect((await post("grant", input)).status).toBe(401);
        expect(mocks.client).not.toHaveBeenCalled();
        expect((await post("grant", input, memberToken)).status).toBe(403);
        expect(mocks.client).not.toHaveBeenCalled();
        expect(
          (await post("grant", { ...input, actorId: OTHER }, adminToken))
            .status,
        ).toBe(400);
        expect(mocks.client).not.toHaveBeenCalled();

        const granted = await post("grant", input, adminToken);
        expect(granted.status).toBe(200);
        const grant = (await granted.json()) as {
          ok: boolean;
          data: {
            grantId: string;
            enrollmentAttemptId: string;
            revision: string;
          };
        };
        expect(grant.ok).toBe(true);
        expect(grant.data.enrollmentAttemptId).toBe(
          input.enrollmentAttemptId.toLowerCase(),
        );
        expect(mocks.client).toHaveBeenCalledTimes(1);
        const revoked = await post(
          "revoke",
          {
            grantId: grant.data.grantId,
            expectedRevision: grant.data.revision,
          },
          adminToken,
        );
        expect(revoked.status).toBe(200);
        const revoke = (await revoked.json()) as {
          ok: boolean;
          data: { grantId: string; revision: string };
        };
        expect(revoke.ok).toBe(true);
        expect(revoke.data.grantId).toBe(grant.data.grantId);
        expect(revoke.data.revision).toBe(
          (BigInt(grant.data.revision) + BigInt(1)).toString(),
        );
        expect(mocks.client).toHaveBeenCalledTimes(2);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }, 30000);
  },
);
