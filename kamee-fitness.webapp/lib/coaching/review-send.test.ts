import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as invite-send.test.ts: the real "server-only" throws outside
// the react-server condition.
vi.mock("server-only", () => ({}));

import { sendReviewReadyEmail } from "./review-send";

const EMAIL = { subject: "s", text: "t", html: "<p>h</p>" };

describe("sendReviewReadyEmail", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalAdmins = process.env.ADMIN_EMAILS;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdmins;
  });

  it('returns "skipped" without RESEND_API_KEY, never calling fetch', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.ADMIN_EMAILS = "ops@kamee.fit";
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendReviewReadyEmail(EMAIL)).resolves.toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns "skipped" when ADMIN_EMAILS is empty, never calling fetch', async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.ADMIN_EMAILS = " , ";
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendReviewReadyEmail(EMAIL)).resolves.toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one email per admin from the pinned sender", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.ADMIN_EMAILS = "Ops@Kamee.fit, second@kamee.fit";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendReviewReadyEmail(EMAIL)).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recipients = fetchMock.mock.calls.map(
      (call) => JSON.parse((call[1] as RequestInit).body as string).to,
    );
    expect(recipients).toEqual([["ops@kamee.fit"], ["second@kamee.fit"]]);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.from).toBe("KAMEE Fitness <noreply@kamee.fit>");
    expect(body.subject).toBe("s");
  });

  it('never throws: a Resend failure or a network error resolves "failed"', async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.ADMIN_EMAILS = "a@kamee.fit,b@kamee.fit";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error("offline")) as unknown as typeof fetch;

    await expect(sendReviewReadyEmail(EMAIL)).resolves.toBe("failed");
  });
});
