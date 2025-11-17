"use server";

import { createSessionClient } from "@repo/api/server";
import { getStorageFileUrl } from "@repo/api/storage";

/**
 * Upload an image to Appwrite content bucket
 * Max file size: 10MB
 * Returns file ID and URL
 */
export async function uploadImage(formData: FormData) {
  try {
    const { storage } = await createSessionClient();
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      throw new Error("File size exceeds 10MB limit");
    }

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    const uploaded = await storage.createFile("content", "unique()", file);
    const url = getStorageFileUrl("content", uploaded.$id);

    return {
      success: true,
      data: {
        id: uploaded.$id,
        url,
      },
    };
  } catch (error) {
    console.error("Image upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete an image from Appwrite content bucket
 */
export async function deleteImage(fileId: string) {
  try {
    const { storage } = await createSessionClient();
    await storage.deleteFile("content", fileId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Image deletion failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Deletion failed",
    };
  }
}


