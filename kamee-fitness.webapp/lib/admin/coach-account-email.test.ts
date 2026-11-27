import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

const m = vi.hoisted(() => ({
  server: vi.fn(),
  getUser: vi.fn(),
  client: vi.fn(),
  getUserById: vi.fn(),
  listUsers: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: m.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: m.client }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect(path: string) {
    throw Object.assign(new Error(`redirect:${path}`), {
      digest: `NEXT_REDIRECT;replace;${path};307;`,
    });
  },
  notFound() {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

import { loadCoachAccountEmail } from "@/app/admin/(panel)/coaches/queries";
import CoachDetailPage from "@/app/admin/(panel)/coaches/[id]/page";

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COACH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_EMAIL = "operator@fixtures.invalid";
const COACH_EMAIL = "coach@fixtures.invalid";

function authUser(email: string | undefined = ADMIN_EMAIL) {
  return {
    id: ACTOR,
    aud: "authenticated",
    created_at: "2026-11-28T00:00:00Z",
    email,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  };
}

function profile() {
  return {
    id: COACH,
    username: "fixture-coach",
    display_name: "Fixture coach",
    avatar_photo_path: null,
    avatar_url: null,
    role: "coach",
    coach_status: "approved",
  };
}

// The real DAL executes its profile/not-found queries against this local
// thenable; only the external Supabase transport is replaced.
function query(data: unknown) {
  const result = { data, error: null };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
  };
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ADMIN_EMAILS", ADMIN_EMAIL);
  m.server.mockResolvedValue({ auth: { getUser: m.getUser } });
  m.getUser.mockResolvedValue({ data: { user: authUser() }, error: null });
  m.client.mockReturnValue({
    auth: { admin: { getUserById: m.getUserById, listUsers: m.listUsers } },
    from: m.from,
    rpc: m.rpc,
  });
  m.getUserById.mockResolvedValue({
    data: { user: { ...authUser(COACH_EMAIL), id: COACH } },
    error: null,
  });
  m.from.mockImplementation((table: string) =>
    query(table === "profiles" ? profile() : table === "coaching_profiles" ? null : []),
  );
  m.rpc.mockResolvedValue({ data: [], error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("admin coach account email reader", () => {
  it.each([
    ["anonymous", null],
    ["member", authUser("member@fixtures.invalid")],
    ["coach", authUser("other-coach@fixtures.invalid")],
    ["missing email", { ...authUser(), email: undefined }],
    ["admin metadata", {
      ...authUser("unlisted@fixtures.invalid"),
      role: "admin",
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin", email: ADMIN_EMAIL },
    }],
  ])("runs the real admin gate for a %s before creating a service client", async (_name, user) => {
    m.getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(loadCoachAccountEmail(COACH)).rejects.toThrow("redirect:");
    expect(m.client).not.toHaveBeenCalled();
    expect(m.getUserById).not.toHaveBeenCalled();
  });

  it("awaits the real gate before creating the service client", async () => {
    let finishAuth!: (value: { data: { user: ReturnType<typeof authUser> }; error: null }) => void;
    m.getUser.mockReturnValue(new Promise((resolve) => { finishAuth = resolve; }));
    const pending = loadCoachAccountEmail(COACH);
    await Promise.resolve();
    expect(m.client).not.toHaveBeenCalled();
    finishAuth({ data: { user: authUser() }, error: null });

    expect(await pending).toEqual({ email: COACH_EMAIL });
  });

  it("preserves a gate failure instead of converting it to unavailable", async () => {
    const failure = new Error("verified auth unavailable");
    m.getUser.mockRejectedValue(failure);

    await expect(loadCoachAccountEmail(COACH)).rejects.toBe(failure);
    expect(m.client).not.toHaveBeenCalled();
  });

  it.each(["", "all", `${COACH}?page=1`, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbg"])(
    "rejects malformed target %j before service-client creation", async (id) => {
      expect(await loadCoachAccountEmail(id)).toEqual({ email: null });
      expect(m.getUser).toHaveBeenCalled();
      expect(m.client).not.toHaveBeenCalled();
      expect(m.getUserById).not.toHaveBeenCalled();
    },
  );

  it("reads only the exact target and returns only its account email", async () => {
    m.getUserById.mockResolvedValue({
      data: { user: {
        ...authUser(COACH_EMAIL),
        id: COACH,
        phone: "+639000000000",
        identities: [{ identity_data: { email: "identity@fixtures.invalid" } }],
        user_metadata: { email: "metadata@fixtures.invalid", private: "private metadata" },
        app_metadata: { providers: ["email"], internal: "private app metadata" },
        factors: [{ secret: "private factor" }],
        access_token: "private token",
      } },
      error: null,
    });

    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: COACH_EMAIL });
    expect(m.getUserById.mock.calls).toEqual([[COACH]]);
    expect(m.listUsers).not.toHaveBeenCalled();
    expect(m.from).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("does not replace absent email %j with metadata or identity email", async (email) => {
    m.getUserById.mockResolvedValue({ data: { user: {
      ...authUser(), id: COACH, email,
      user_metadata: { email: "metadata@fixtures.invalid" },
      identities: [{ identity_data: { email: "identity@fixtures.invalid" } }],
    } }, error: null });

    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: null });
  });

  it("returns unavailable when the Auth user is absent", async () => {
    m.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: null });
  });

  it("returns generic unavailable for an SDK error even if it includes a user", async () => {
    m.getUserById.mockResolvedValue({
      data: { user: { ...authUser(COACH_EMAIL), id: COACH } },
      error: { message: "provider detail: private@fixtures.invalid", status: 500 },
    });
    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: null });
  });

  it("returns generic unavailable for a thrown lookup failure", async () => {
    m.getUserById.mockRejectedValue(new Error("provider detail: private@fixtures.invalid"));
    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: null });
  });

  it("returns generic unavailable if the service client cannot be created", async () => {
    m.client.mockImplementation(() => { throw new Error("private service configuration"); });
    expect(await loadCoachAccountEmail(COACH)).toEqual({ email: null });
  });
});

describe("admin coach detail account email", () => {
  it("keeps malformed routes not found without requesting an Auth user", async () => {
    await expect(CoachDetailPage({ params: Promise.resolve({ id: "invalid" }) }))
      .rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(m.client).not.toHaveBeenCalled();
    expect(m.getUserById).not.toHaveBeenCalled();
  });

  it("keeps absent profiles not found without requesting an Auth user", async () => {
    m.from.mockImplementation((table: string) => query(table === "profiles" ? null : []));
    await expect(CoachDetailPage({ params: Promise.resolve({ id: COACH }) }))
      .rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(m.getUserById).not.toHaveBeenCalled();
  });

  it("labels the account email beside the coach identity and provides a mail link", async () => {
    const dom = new JSDOM(renderToStaticMarkup(await CoachDetailPage({ params: Promise.resolve({ id: COACH }) })));
    const label = [...dom.window.document.querySelectorAll("dt")]
      .find((node) => node.textContent === "Account email");

    expect(label).toBeDefined();
    expect(label?.nextElementSibling?.textContent).toBe(COACH_EMAIL);
    expect(label?.nextElementSibling?.querySelector("a")?.getAttribute("href"))
      .toBe("mailto:coach%40fixtures.invalid");
    expect(m.getUserById.mock.calls).toEqual([[COACH]]);
  });

  it("encodes mailto delimiters without changing the displayed account email", async () => {
    const email = "coach?subject=review#private@fixtures.invalid";
    m.getUserById.mockResolvedValue({
      data: { user: { ...authUser(email), id: COACH } },
      error: null,
    });
    const dom = new JSDOM(renderToStaticMarkup(await CoachDetailPage({ params: Promise.resolve({ id: COACH }) })));
    const link = dom.window.document.querySelector('a[href^="mailto:"]');

    expect(link?.textContent).toBe("coach?subject=review#private@fixtures.invalid");
    expect(link?.getAttribute("href"))
      .toBe("mailto:coach%3Fsubject%3Dreview%23private%40fixtures.invalid");
  });

  it("keeps the review page available with an honest unavailable email row", async () => {
    m.getUserById.mockRejectedValue(new Error("private provider failure"));
    const dom = new JSDOM(renderToStaticMarkup(await CoachDetailPage({ params: Promise.resolve({ id: COACH }) })));
    const document = dom.window.document;
    const label = [...document.querySelectorAll("dt")]
      .find((node) => node.textContent === "Account email");

    expect(document.querySelector("h1")?.textContent).toBe("Fixture coach");
    expect(label?.nextElementSibling?.textContent).toBe("Unavailable");
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.body.textContent).toContain("Review history");
    expect(document.body.textContent).not.toContain("private provider failure");
  });
});
