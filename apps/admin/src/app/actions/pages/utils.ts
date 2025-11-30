import type { PageDocument, PageRecord } from "@repo/api/page-builder";
import type { PageBuilderDocument } from "@repo/editor";
import { revalidatePath } from "next/cache";

export const ADMIN_LIST_PATH = "/admin/pages";

export function cloneDocument(
  document: PageBuilderDocument | null | undefined
): PageDocument | null {
  if (!document) {
    return null;
  }

  return JSON.parse(JSON.stringify(document)) as PageDocument;
}

export function revalidateForPage(page: PageRecord) {
  revalidatePath(ADMIN_LIST_PATH);
  revalidatePath(`${ADMIN_LIST_PATH}/${page.id}`);
  if (page.slug) {
    revalidatePath(`/${page.slug}`);
  }
}
