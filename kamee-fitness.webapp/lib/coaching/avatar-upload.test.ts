import { describe, expect, it } from "vitest";
import { buildAvatarPath, isOwnAvatarPath } from "./storage";
const uid = "597c01e2-3c12-4cd6-87e5-0e7f813d4840";
describe("avatar upload paths", () => {
  it.each(["jpg", "png", "webp"] as const)("accepts its own %s upload", (ext) => {
    expect(isOwnAvatarPath(buildAvatarPath(uid, ext, 123), uid)).toBe(true);
  });
  it.each([null, {}, "avatars/other/123.jpg", `avatars/${uid}/../other/123.jpg`, `coaching/${uid}/cover/123.jpg`, `avatars/${uid}/123.svg`, `avatars/${uid}/123.jpg/extra`])("rejects malformed or foreign path %s", (path) => {
    expect(isOwnAvatarPath(path, uid)).toBe(false);
  });
});
