import { describe, expect, it } from "vitest";
import { buildInviteEmail, inviteUrl, siteOrigin } from "./invite";

describe("inviteUrl", () => {
  it("builds the public invite link", () => {
    expect(inviteUrl("abc")).toBe("https://kamee.fit/coaching/invite/abc");
  });
  it("uses the given origin, e.g. a local dev server", () => {
    expect(inviteUrl("abc", "http://localhost:3000")).toBe("http://localhost:3000/coaching/invite/abc");
  });
});

describe("siteOrigin", () => {
  it("defaults to production", () => {
    expect(siteOrigin(undefined)).toBe("https://kamee.fit");
    expect(siteOrigin("")).toBe("https://kamee.fit");
  });
  it("accepts a bare http(s) origin, trailing slash included", () => {
    expect(siteOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(siteOrigin("https://kamee.fit/")).toBe("https://kamee.fit");
  });
  it("falls back to production for anything else", () => {
    for (const v of ["localhost:3000", "javascript:alert(1)", "https://kamee.fit/x", "https://a@b.c", "ftp://x.y"]) {
      expect(siteOrigin(v)).toBe("https://kamee.fit");
    }
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
