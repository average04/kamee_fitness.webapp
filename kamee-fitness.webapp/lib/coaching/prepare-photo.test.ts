import { afterEach, describe, expect, it, vi } from "vitest";
import { preparePhotoForUpload } from "./prepare-photo";

const MiB = 1024 * 1024;
const source = (type = "image/jpeg", size = 100) =>
  new File([new Uint8Array(size)], "holiday.original.jpg", { type });

function browser({ width = 4000, height = 3000, outputs = [new Blob(["encoded pixels"], { type: "image/webp" })] } = {}) {
  const close = vi.fn();
  const bitmap = { width, height, close };
  const decode = vi.fn().mockResolvedValue(bitmap);
  const drawImage = vi.fn();
  const context = { drawImage, getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })), imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
  const canvas = {
    width: 0, height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn<(callback: BlobCallback, type: string, quality: number) => void>((callback) => callback(outputs.shift() ?? null)),
  };
  vi.stubGlobal("createImageBitmap", decode);
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  return { bitmap, decode, canvas, context, close };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("photo preparation", () => {
  it.each([
    ["avatar", 4000, 3000, 512, 384],
    ["cover", 4000, 3000, 2048, 1536],
    ["gallery", 3000, 4000, 1536, 2048],
    ["plan-cover", 320, 240, 320, 240],
  ] as const)("sizes %s from oriented pixels without upscaling", async (purpose, width, height, wantedWidth, wantedHeight) => {
    const b = browser({ width, height });
    const input = source();
    const result = await preparePhotoForUpload(input, purpose);
    expect(b.decode).toHaveBeenCalledWith(input, { imageOrientation: "from-image" });
    expect(b.context.drawImage).toHaveBeenCalledWith(b.bitmap, 0, 0, wantedWidth, wantedHeight);
    expect(b.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.8);
    expect(result.file.name).toBe("holiday.original.webp");
    expect(result.file.type).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(await result.file.text()).toBe("encoded pixels");
    expect(result.file).not.toBe(input);
    expect(b.close).toHaveBeenCalledOnce();
    expect(b.canvas.width).toBe(0);
    expect(b.canvas.height).toBe(0);
  });

  it("accepts a source above 5 MiB when the re-encoded result fits", async () => {
    browser();
    const result = await preparePhotoForUpload(source("image/jpeg", 6 * MiB), "cover");
    expect(result.file.size).toBeLessThan(5 * MiB);
  });

  it.each([source("image/jpeg", 25 * MiB + 1), source("application/pdf"), source("image/jpeg", 0)])("rejects unsupported/oversized/empty sources before decoding", async (input) => {
    const b = browser();
    await expect(preparePhotoForUpload(input, "cover")).rejects.toThrow();
    expect(b.decode).not.toHaveBeenCalled();
  });

  it.each(["image/png", "image/webp"])("uses an explicit PNG fallback for %s to preserve alpha", async (type) => {
    const b = browser({ outputs: [new Blob(["silent PNG"], { type: "image/png" }), new Blob(["transparent pixels"], { type: "image/png" })] });
    const result = await preparePhotoForUpload(source(type), "gallery");
    expect(b.canvas.getContext).toHaveBeenCalledWith("2d", { alpha: true });
    expect(b.canvas.toBlob.mock.calls.map((call) => call[1])).toEqual(["image/webp", "image/png"]);
    expect(result.file.type).toBe("image/png");
    expect(result.file.name).toBe("holiday.original.png");
    expect(result.extension).toBe("png");
  });

  it("falls back to JPEG for an opaque JPEG source when WebP is unavailable", async () => {
    const b = browser({ outputs: [new Blob(["silent PNG"], { type: "image/png" }), new Blob(["JPEG pixels"], { type: "image/jpeg" })] });
    const result = await preparePhotoForUpload(source(), "cover");
    expect(b.canvas.toBlob.mock.calls.map((call) => call[1])).toEqual(["image/webp", "image/jpeg"]);
    expect(result.file.type).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
  });

  it("uses the actual fallback Blob MIME even when the requested JPEG encoder returns PNG", async () => {
    browser({ outputs: [new Blob([], { type: "image/png" }), new Blob(["PNG pixels"], { type: "image/png" })] });
    const result = await preparePhotoForUpload(source(), "cover");
    expect(result.file.type).toBe("image/png");
    expect(result.file.name).toBe("holiday.original.png");
  });

  it("keeps transparency even when a source is mislabeled as JPEG", async () => {
    const b = browser({ outputs: [new Blob([], { type: "image/png" }), new Blob(["alpha"], { type: "image/png" })] });
    b.context.getImageData.mockReturnValue({ data: new Uint8ClampedArray([0, 0, 0, 128]) });
    const result = await preparePhotoForUpload(source("image/jpeg"), "cover");
    expect(b.canvas.toBlob.mock.calls.map((call) => call[1])).toEqual(["image/webp", "image/png"]);
    expect(result.file.type).toBe("image/png");
  });

  it("never accepts a JPEG fallback for a potentially transparent input", async () => {
    browser({ outputs: [new Blob([], { type: "image/jpeg" }), new Blob(["opaque pixels"], { type: "image/jpeg" })] });
    await expect(preparePhotoForUpload(source("image/png"), "cover")).rejects.toThrow();
  });

  it("checks the final encoded size and releases decoded resources on failure", async () => {
    const b = browser({ outputs: [new Blob([new Uint8Array(5 * MiB + 1)], { type: "image/webp" })] });
    await expect(preparePhotoForUpload(source(), "cover")).rejects.toThrow(/5 MB/);
    expect(b.close).toHaveBeenCalledOnce();
    expect(b.canvas.width).toBe(0);
  });

  it("rejects a failed canvas encode without returning original metadata-bearing bytes", async () => {
    const b = browser({ outputs: [] });
    await expect(preparePhotoForUpload(source(), "cover")).rejects.toThrow(/prepare|convert/i);
    expect(b.close).toHaveBeenCalledOnce();
  });

  it("falls back to a decoded image element and releases its temporary URL", async () => {
    const b = browser();
    b.decode.mockRejectedValue(new Error("bitmap unavailable"));
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    class DecodedImage {
      naturalWidth = 200;
      naturalHeight = 300;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", DecodedImage);
    const input = source();
    await preparePhotoForUpload(input, "avatar");
    expect(createUrl).toHaveBeenCalledWith(input);
    expect(b.context.drawImage).toHaveBeenCalledWith(expect.any(DecodedImage), 0, 0, 200, 300);
    expect(revokeUrl).toHaveBeenCalledWith("blob:source");
  });

  it("releases its temporary URL when image decoding fails", async () => {
    browser();
    vi.stubGlobal("createImageBitmap", undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:broken");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    class BrokenImage {
      onerror: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal("Image", BrokenImage);
    await expect(preparePhotoForUpload(source(), "cover")).rejects.toThrow(/read|decode/i);
    expect(revoke).toHaveBeenCalledWith("blob:broken");
  });
});
