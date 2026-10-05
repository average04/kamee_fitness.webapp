import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("uses Netlify's client-connection header when present", () => {
    expect(clientIp(h({ "x-nf-client-connection-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("ignores a spoofed cf-connecting-ip when Netlify's header is present", () => {
    expect(
      clientIp(h({ "x-nf-client-connection-ip": "198.51.100.7", "cf-connecting-ip": "203.0.113.77" })),
    ).toBe("198.51.100.7");
  });

  it("never trusts cf-connecting-ip, which clients can set (no Cloudflare in front)", () => {
    expect(clientIp(h({ "cf-connecting-ip": "203.0.113.77" }))).toBe("unknown");
  });

  it("ignores a client-supplied x-forwarded-for when Netlify's header is present", () => {
    expect(
      clientIp(h({ "x-nf-client-connection-ip": "198.51.100.7", "x-forwarded-for": "203.0.113.1, 10.0.0.1" })),
    ).toBe("198.51.100.7");
  });

  it("falls back to x-forwarded-for only off Netlify (local dev)", () => {
    expect(clientIp(h({ "x-forwarded-for": "127.0.0.1, 10.0.0.1" }))).toBe("127.0.0.1");
  });

  it("returns 'unknown' with no usable header", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("trims whitespace", () => {
    expect(clientIp(h({ "x-nf-client-connection-ip": "  198.51.100.7  " }))).toBe("198.51.100.7");
  });
});
