import { describe, expect, it } from "vitest";
import { isLocalDevelopmentAuth } from "./local-auth";

describe("local auth without a remote challenge", () => {
  it("only allows a development page using a loopback backend", () => {
    expect(isLocalDevelopmentAuth("development", "http://localhost:3000", "http://127.0.0.1:44321")).toBe(true);
  });
  it.each([
    ["production", "http://localhost:3000", "http://127.0.0.1:44321"],
    ["development", "https://kamee.fit", "http://127.0.0.1:44321"],
    ["development", "http://localhost:3000", "https://project.supabase.co"],
    ["development", "http://localhost.evil.com", "http://127.0.0.1:44321"],
    ["development", "http://localhost:3000", "invalid"],
  ])("requires verification outside local development (%s %s %s)", (mode, page, api) => {
    expect(isLocalDevelopmentAuth(mode, page, api)).toBe(false);
  });
});
