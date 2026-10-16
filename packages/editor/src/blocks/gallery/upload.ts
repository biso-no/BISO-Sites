import type { GalleryImage } from "@/editor/types";

type UploadFile = (fd: FormData) => Promise<{ fileId: string; url: string }>;

export interface GalleryUploadResult {
  /** Uploaded in order, up to the first failure. */
  added: GalleryImage[];
  error: string | null;
}

/**
 * Upload gallery files one at a time and never throw: a rejection out of a
 * React transition reaches the editor's error boundary and blanks the whole
 * editor, and the files already in the bucket were lost from the page.
 */
export async function uploadGalleryFiles(
  files: File[],
  uploadFile: UploadFile
): Promise<GalleryUploadResult> {
  const added: GalleryImage[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { fileId, url } = await uploadFile(fd);
      added.push({ fileId, src: url });
    } catch (error) {
      return {
        added,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }
  return { added, error: null };
}
