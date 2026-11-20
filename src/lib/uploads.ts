import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_BYTES = 2 * 1024 * 1024;

export async function saveUploadedImage(
  file: File,
  folder: "students" | "teachers",
): Promise<string> {
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    throw new Error("Only JPG, PNG, WebP, or GIF images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image size must be 2MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const relativePath = `${folder}/${filename}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return relativePath;
}
