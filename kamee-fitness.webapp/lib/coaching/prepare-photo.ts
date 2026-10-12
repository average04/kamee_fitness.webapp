import { checkImageFile, extensionForMimeType, type CoverExtension, type FileCheckResult } from "./storage";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = { avatar: 512, cover: 2048, gallery: 2048, "plan-cover": 2048 } as const;
type PhotoPurpose = keyof typeof MAX_EDGE;

/** Source admission is separate from the existing 5 MiB upload/storage limit. */
export function checkPhotoSource(file: { type: string; size: number }): FileCheckResult {
  if (!extensionForMimeType(file.type)) return { ok: false, message: "Please choose a JPEG, PNG, or WebP image." };
  if (file.size <= 0) return { ok: false, message: "This image is empty. Please choose another photo." };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, message: "Choose a source image of 25 MB or smaller." };
  return { ok: true };
}

type DecodedPhoto = { source: CanvasImageSource; width: number; height: number; release(): void };

async function decodePhoto(file: File): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    try {
      // Apply EXIF orientation to the pixels before resizing/re-encoding.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Older browsers can decode an image element even when bitmap decoding
      // or its options are unavailable. The element decoder honors orientation.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { img.onload = null; img.onerror = null; resolve(img); };
      img.onerror = () => { img.onload = null; img.onerror = null; reject(new Error("Could not read this image. Please choose another photo.")); };
      img.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function encode(canvas: HTMLCanvasElement, mime: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { canvas.toBlob(resolve, mime, 0.8); }
    catch { resolve(null); }
  });
}

/** Browser-only operation, called on selection (never during server rendering).
 * Only decoded canvas pixels are encoded: no source EXIF/GPS is copied and
 * failures never return the original bytes. Existing stored photos are untouched.
 */
export async function preparePhotoForUpload(
  file: File,
  purpose: PhotoPurpose,
): Promise<{ file: File; extension: CoverExtension }> {
  const sourceCheck = checkPhotoSource(file);
  if (!sourceCheck.ok) throw new Error(sourceCheck.message);
  const decoded = await decodePhoto(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    if (!Number.isFinite(decoded.width) || !Number.isFinite(decoded.height) || decoded.width <= 0 || decoded.height <= 0) {
      throw new Error("Could not read this image. Please choose another photo.");
    }
    const scale = Math.min(1, MAX_EDGE[purpose] / Math.max(decoded.width, decoded.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Could not prepare this photo. Please try another browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    let blob = await encode(canvas, "image/webp");
    let allowJpeg = false;
    if (blob?.type !== "image/webp" || blob.size === 0) {
      // Safari may silently produce PNG for an unsupported WebP request. Use
      // an explicit fallback. Even a JPEG-labelled file can contain PNG bytes,
      // so check actual alpha before choosing the lossy opaque fallback.
      if (file.type === "image/jpeg") {
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        allowJpeg = true;
        for (let i = 3; i < rgba.length; i += 4) {
          if (rgba[i] !== 255) { allowJpeg = false; break; }
        }
      }
      blob = await encode(canvas, allowJpeg ? "image/jpeg" : "image/png");
    }
    const extension = blob && extensionForMimeType(blob.type);
    if (!blob || !extension || blob.size === 0 || (!allowJpeg && blob.type === "image/jpeg")) {
      throw new Error("Could not prepare this photo. Please try another browser.");
    }
    const finalCheck = checkImageFile(blob);
    if (!finalCheck.ok) throw new Error(finalCheck.message);
    const stem = file.name.replace(/\.[^.]*$/, "") || "photo";
    return { file: new File([blob], `${stem}.${extension}`, { type: blob.type }), extension };
  } finally {
    decoded.release();
    // Release the backing pixel buffer after asynchronous encoding completes.
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
