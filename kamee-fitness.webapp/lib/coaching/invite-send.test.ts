import { afterEach, describe, expect, it, vi } from "vitest";

// `invite-send.ts` starts with `import "server-only"`, whose real
// implementation unconditionally throws when imported outside the
// "react-server" bundler condition (which vitest's default node
// environment never sets) -- mock it to a no-op so the module under test
// can load at all.
vi.mock("server-only", () => ({}));

import { sendInviteEmail } from "./invite-send";

const EMAIL = { subject: "s", text: "t", html: "<p>h</p>" };

describe("sendInviteEmail", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it('returns "skipped" without RESEND_API_KEY, never calling fetch', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendInviteEmail("a@b.com", EMAIL)).resolves.toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends via Resend with the pinned From address and returns "sent" on a 2xx response', async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendInviteEmail("a@b.com", EMAIL)).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("KAMEE Fitness <noreply@kamee.fit>");
    expect(body.to).toEqual(["a@b.com"]);
    expect(body.subject).toBe(EMAIL.subject);
  });

  it("throws on a non-2xx response", async () => {
    process.env.RESEND_API_KEY = "test-key";
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(sendInviteEmail("a@b.com", EMAIL)).rejects.toThrow();
  });
});
