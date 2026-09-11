import { describe, expect, it } from "vitest";
import { buildInviteEmail, inviteUrl } from "./invite";

describe("inviteUrl", () => {
  it("builds the public invite link", () => {
    expect(inviteUrl("abc")).toBe("https://kamee.fit/coaching/invite/abc");
  });
});

describe("buildInviteEmail", () => {
  it("greets by name and includes the link in text and html", () => {
    const e = buildInviteEmail("Jo", "https://kamee.fit/coaching/invite/abc");
    expect(e.subject).toBe("You're invited to coach on Kamee");
    expect(e.text).toContain("Hi Jo");
    expect(e.text).toContain("https://kamee.fit/coaching/invite/abc");
    expect(e.html).toContain('href="https://kamee.fit/coaching/invite/abc"');
  });

  it("falls back to a neutral greeting", () => {
    expect(buildInviteEmail(null, "u").text).toContain("Hi there");
  });

  it("includes the brand slogan, never the wrong wording", () => {
    const e = buildInviteEmail("Jo", "https://kamee.fit/coaching/invite/abc");
    expect(e.text).toContain("STRONG and steady wins the race.");
    expect(e.text.toLowerCase()).not.toContain("slow and steady");
  });

  it("escapes an HTML-unsafe display name in the html body", () => {
    const e = buildInviteEmail(
      '<script>alert("x")</script>',
      "https://kamee.fit/coaching/invite/abc",
    );
    expect(e.html).not.toContain("<script>alert(\"x\")</script>");
    expect(e.html).toContain("&lt;script&gt;");
  });
});
