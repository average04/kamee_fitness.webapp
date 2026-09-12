import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./sign-in-errors";

describe("signInErrorMessage", () => {
  it("explains an email with no account (shouldCreateUser: false)", () => {
    expect(signInErrorMessage("Signups not allowed for otp")).toMatch(/no Kamee account/);
  });
  it("explains rate limits", () => {
    expect(signInErrorMessage("email rate limit exceeded")).toMatch(/Too many attempts/);
    expect(signInErrorMessage("For security purposes, you can only request this after 42 seconds.")).toMatch(
      /Too many attempts/,
    );
  });
  it("explains a wrong or expired code", () => {
    expect(signInErrorMessage("Token has expired or is invalid")).toMatch(/wrong or has expired/);
  });
  it("explains a captcha failure", () => {
    expect(signInErrorMessage("captcha protection: request disallowed")).toMatch(/human/);
  });
  it("passes anything else through, and never returns empty", () => {
    expect(signInErrorMessage("Database error")).toBe("Database error");
    expect(signInErrorMessage(undefined)).toMatch(/try again/);
  });
});
