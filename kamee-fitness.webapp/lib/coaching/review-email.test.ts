import { describe, expect, it } from "vitest";
import { adminCoachUrl, buildReviewReadyEmail } from "./review-email";

const UID = "11111111-1111-4111-8111-111111111111";

describe("adminCoachUrl", () => {
  it("links to the admin coach detail page", () => {
    expect(adminCoachUrl(UID)).toBe(`https://kamee.fit/admin/coaches/${UID}`);
  });
});

describe("buildReviewReadyEmail", () => {
  it("uses the fixed subject", () => {
    expect(buildReviewReadyEmail("Ana", UID).subject).toBe("Coach profile ready for review");
  });

  it("names the coach and links to their admin page in both bodies", () => {
    const email = buildReviewReadyEmail("Ana Reyes", UID);
    expect(email.text).toContain("Ana Reyes");
    expect(email.text).toContain(`https://kamee.fit/admin/coaches/${UID}`);
    expect(email.html).toContain("Ana Reyes");
    expect(email.html).toContain(`href="https://kamee.fit/admin/coaches/${UID}"`);
  });

  it("HTML-escapes the display name (attacker-controlled profile field)", () => {
    const email = buildReviewReadyEmail(`<img src=x onerror="alert(1)">&'`, UID);
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;");
  });

  it("falls back to a neutral name when the display name is blank", () => {
    expect(buildReviewReadyEmail(null, UID).text).toContain("A coach");
    expect(buildReviewReadyEmail("   ", UID).html).toContain("A coach");
  });
});
