"use server";

import { ID, InputFile, getStorageFileUrl } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { getUserAuthContext } from "@/lib/authorization";
import { redirect } from "next/navigation";
import { MEDIA_BUCKET_ID } from "./schemas";


export async function uploadMediaFile(formData: FormData): Promise<{
  url: string;
  fileId: string;
  error?: never;
} | {
  url?: never;
  fileId?: never;
  error: string;
}> {
  const ctx = await getUserAuthContext();
  if (!ctx) redirect("/auth/login");

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) return { error: "File too large (max 10 MB)" };

  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return { error: "Unsupported file type. Allowed: JPG, PNG, GIF, WEBP, SVG" };
  }

  try {
    const { storage } = await createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const inputFile = InputFile.fromBuffer(buffer, file.name);

    const uploaded = await storage.createFile(
      MEDIA_BUCKET_ID,
      ID.unique(),
      inputFile
    );

    const url = getStorageFileUrl(MEDIA_BUCKET_ID, uploaded.$id);
    return { url, fileId: uploaded.$id };
  } catch (err) {
    console.error("Upload error:", err);
    return { error: "Upload failed. Please try again." };
  }
}
