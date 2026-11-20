import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { saveUploadedImage } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder") === "teachers" ? "teachers" : "students";

    if (!(file instanceof File)) {
      return jsonError("No image file uploaded.", 400);
    }

    const relativePath = await saveUploadedImage(file, folder);
    return jsonOk({ path: relativePath, url: `/uploads/${relativePath}` }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed.", 400);
  }
}
