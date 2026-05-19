"use client";

import { EditorShell } from "@repo/editor";
import type { PageDoc, EditorDepartment } from "@repo/editor";
import "@repo/editor/theme/styles.css";
import { useRouter } from "next/navigation";
import { savePageEditorDoc } from "@/app/(portal)/_actions/pages";
import { uploadMediaFile } from "@/app/(portal)/_actions/upload";

interface PageEditorClientProps {
  initial: PageDoc | null;
  pageId: string | null;
  departments: EditorDepartment[];
}

export function PageEditorClient({
  initial,
  pageId,
  departments,
}: PageEditorClientProps) {
  const router = useRouter();

  async function handleSave(doc: PageDoc) {
    const result = await savePageEditorDoc({ id: pageId, doc, locale: "no" });
    if ("error" in result) throw new Error(result.error);
    if (!pageId && "pageId" in result) {
      router.replace(`/pages/${result.pageId}`);
    }
  }

  async function handleUpload(fd: FormData): Promise<{ fileId: string; url: string }> {
    const result = await uploadMediaFile(fd);
    if ("error" in result) throw new Error(result.error);
    return { fileId: result.fileId, url: result.url };
  }

  function handleExit() {
    router.push("/pages");
  }

  return (
    <EditorShell
      initial={initial}
      savePage={handleSave}
      uploadFile={handleUpload}
      departments={departments}
      onExit={handleExit}
    />
  );
}
