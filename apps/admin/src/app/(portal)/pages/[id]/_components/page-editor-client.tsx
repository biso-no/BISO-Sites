"use client";

import { EditorShell } from "@repo/editor";
import type { PageDoc, EditorDepartment } from "@repo/editor";
import "@repo/editor/theme/styles.css";
import type { Campus } from "@repo/api/types/appwrite";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePageEditorDoc, publishPageAction, unpublishPageAction } from "../../../_actions/pages";
import { uploadMediaFile } from "../../../_actions/upload";

interface PageEditorClientProps {
  initial: PageDoc | null;
  pageId: string | null;
  campuses: Campus[];
  defaultCampusId: string;
  departments: EditorDepartment[];
  labels: {
    back: string;
    save: string;
    saveDraft: string;
    publish: string;
    unpublish: string;
    saving: string;
    saved: string;
    error: string;
    saveSuccess: string;
    saveError: string;
    publishSuccess: string;
    publishError: string;
  };
}

export function PageEditorClient({
  initial,
  pageId,
  departments,
  labels,
}: PageEditorClientProps) {
  const router = useRouter();

  async function handleSave(doc: PageDoc) {
    const result = await savePageEditorDoc({ id: pageId, doc, locale: "no" });
    if ("error" in result) throw new Error(result.error);
    // On first save (new page), redirect to the created page's edit URL
    if (!pageId && "pageId" in result) {
      router.replace(`/pages/${result.pageId}`);
    }
  }

  async function handleUpload(fd: FormData): Promise<{ fileId: string; url: string }> {
    const result = await uploadMediaFile(fd);
    if ("error" in result) throw new Error(result.error);
    return { fileId: result.fileId, url: result.url };
  }

  return (
    <div className="pe-scope">
      <EditorShell
        initial={initial}
        savePage={handleSave}
        uploadFile={handleUpload}
        departments={departments}
      />
    </div>
  );
}
